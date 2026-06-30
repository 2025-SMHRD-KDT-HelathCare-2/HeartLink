// authApi.ts
// frontend/src/api/authApi.ts
// =============================================================================
// 서버와 통신하는 axios 인스턴스 + 인증(토큰) 자동 관리
//
// [보안 설계 핵심]
//   - Access Token : "메모리에만" 보관합니다. (tokenStore.ts)
//       → localStorage/쿠키에 두지 않으므로 XSS 로 탈취당할 위험이 낮습니다.
//   - Refresh Token: 서버가 HttpOnly 쿠키로 관리합니다. (자바스크립트가 못 읽음)
//       → withCredentials: true 로 모든 요청에 쿠키가 자동으로 실려 갑니다.
//
// [자동 토큰 재발급 흐름]
//   1) 어떤 요청이 401(인증 만료)로 실패합니다.
//   2) 인터셉터가 가로채서 /auth/refresh 를 한 번 호출합니다.
//      (쿠키의 Refresh Token 으로 새 Access Token 을 받아옵니다.)
//   3) 새 토큰을 메모리에 저장하고, "실패했던 원래 요청"을 다시 보냅니다.
//   4) 동시에 여러 요청이 401 이 나도, refresh 는 "한 번만" 하고
//      나머지는 큐(failedQueue)에서 기다렸다가 새 토큰으로 함께 재시도합니다.
//   5) refresh 마저 실패하면 → 세션 정리 + 'auth:logout' 이벤트 발생(→ 로그인 화면).
// =============================================================================

import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { getAccessToken, setAccessToken } from "./tokenStore";

const API_BASE_URL =
  import.meta.env?.VITE_API_BASE_URL ?? "http://localhost:3000";

// -----------------------------------------------------------------------------
// 메인 axios 인스턴스
//   - 앱의 모든 API 요청은 이 인스턴스(api)를 통해 나갑니다.
//   - withCredentials: HttpOnly 쿠키(refreshToken)를 자동으로 함께 보냅니다. (필수)
// -----------------------------------------------------------------------------
const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// -----------------------------------------------------------------------------
// [요청 인터셉터] 나가는 요청마다 메모리의 Access Token 을 Authorization 에 붙입니다.
//   - 토큰이 없으면(로그인 전/부팅 직후) 그냥 헤더 없이 보냅니다.
// -----------------------------------------------------------------------------
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    // headers 가 비어있을 수도 있으니 안전하게 보장한 뒤 할당합니다.
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// -----------------------------------------------------------------------------
// [동시성 큐]
//   - 여러 요청이 "동시에" 401 이 나면, refresh 를 여러 번 하면 안 됩니다.
//   - 첫 요청만 refresh 를 진행하고(isRefreshing=true),
//     나머지는 failedQueue 에 "기다리는 약속(Promise)"으로 쌓아둡니다.
//   - refresh 가 끝나면(processQueue) 기다리던 요청들을 한꺼번에 깨워
//     새 토큰으로 재시도하게 합니다.
// -----------------------------------------------------------------------------
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(err: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (err || !token) reject(err ?? new Error("토큰 재발급에 실패했습니다."));
    else resolve(token);
  });
  failedQueue = [];
}

// 세션을 모두 비우고 "로그아웃" 이벤트를 알립니다.
//   - AuthContext 등에서 이 이벤트를 듣고 로그인 화면으로 보냅니다.
function forceLogout() {
  setAccessToken(null);
  try {
    localStorage.removeItem("role");
    localStorage.removeItem("user");
  } catch {
    /* 프라이빗 모드 등에서 localStorage 가 막혀 있어도 무시 */
  }
  window.dispatchEvent(new Event("auth:logout"));
}

// 401 응답이 "토큰 만료/누락"으로 인한 것인지 판단합니다.
//   - 서버가 code 를 정확히 내려주면 그걸 우선 신뢰하고,
//   - code 가 없더라도 401 자체면 일단 재발급을 시도해 봅니다.
//   - 단, refresh 요청 자체의 401 은 여기서 거릅니다(아래에서 url 로 차단).
function shouldTryRefresh(error: AxiosError): boolean {
  return error?.response?.status === 401;
}

// -----------------------------------------------------------------------------
// [응답 인터셉터] 401 이면 자동 재발급 → 원래 요청 재시도
// -----------------------------------------------------------------------------
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    // config 가 없으면(네트워크 차단 등) 더 처리할 수 없으므로 그대로 던집니다.
    if (!originalRequest) return Promise.reject(error);

    // refresh 엔드포인트 자체가 401 이면, 재귀/무한루프를 막기 위해 바로 로그아웃.
    const isRefreshCall = (originalRequest.url ?? "").includes("/auth/refresh");

    if (shouldTryRefresh(error) && !originalRequest._retry && !isRefreshCall) {
      // 이미 다른 요청이 refresh 중이면, 큐에 줄을 서서 새 토큰을 기다립니다.
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers = originalRequest.headers ?? {};
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      // 이 요청이 "refresh 를 책임지는" 첫 요청이 됩니다.
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // refreshToken 은 HttpOnly 쿠키에 있으므로 body 가 필요 없습니다.
        // ★ 인터셉터를 타지 않는 "순수 axios" 로 호출 → refresh 가 또 401 나도
        //   여기로 다시 들어오지 않아 무한루프를 방지합니다.
        const { data } = await axios.post(
          `${API_BASE_URL}/api/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newToken: string | undefined = data?.token;
        if (!newToken) throw new Error("재발급 응답에 토큰이 없습니다.");

        setAccessToken(newToken);
        processQueue(null, newToken); // 기다리던 요청들 깨우기

        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest); // 원래 요청 재시도
      } catch (refreshErr) {
        // 재발급 실패 → 줄 서 있던 요청들도 모두 실패 처리 + 세션 정리
        processQueue(refreshErr, null);
        forceLogout();
        return Promise.reject(
          new Error("로그인이 만료되었습니다. 다시 로그인해 주세요.")
        );
      } finally {
        isRefreshing = false;
      }
    }

    // ── 그 외 일반 에러 가공 ──────────────────────────────────────────────
    // 사용자에게 보여줄 메시지는 너무 구체적이지 않게(정보 노출 최소화),
    // 디버깅용 원본 응답은 customError.response 로 따로 보존합니다.
    const userMessage =
      error?.response?.data &&
      typeof (error.response.data as { message?: unknown }).message === "string"
        ? (error.response.data as { message: string }).message
        : "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";

    const customError = new Error(userMessage) as Error & {
      status?: number;
      response?: AxiosError["response"];
    };
    customError.status = error?.response?.status;
    customError.response = error?.response;
    return Promise.reject(customError);
  }
);

// ───────────────── 휴대폰 인증 (회원가입용) ─────────────────
export async function sendVerificationCode(phone: string) {
  const { data } = await api.post("/auth/phone/send", { phone });
  return data;
}

export async function verifyPhoneCode(phone: string, code: string) {
  const { data } = await api.post("/auth/phone/verify", { phone, code });
  return data;
}

// ───────────────── 아이디 찾기 OTP ─────────────────
export async function sendFindEmailCode(phone: string) {
  const { data } = await api.post("/auth/find-email/send", { phone });
  return data;
}

export async function verifyFindEmailCode(phone: string, code: string) {
  const { data } = await api.post("/auth/find-email/verify", { phone, code });
  return data;
}

// ───────────────── 일반 회원가입 / 로그인 ─────────────────
// 회원가입 시 서버로 보내는 데이터의 "형태(타입)" 정의
//   - 'birthDate'(생년월일, "YYYY-MM-DD")만 받고, 만 나이는 서버가 자동 계산합니다.
export interface RegisterPayload {
  email: string;
  password: string;
  nickname: string;
  role: "user" | "guardian";
  phone: string;
  birthDate?: string;        // 생년월일 "YYYY-MM-DD" (선택)
  gender?: "M" | "F";
  medical_history?: string[];
}

export async function register(payload: RegisterPayload) {
  const { data } = await api.post("/auth/register", payload);
  return data;
}

export async function login(credentials: { email: string; password: string }) {
  // 응답: { token(AccessToken), user: { email, role } }  / RefreshToken은 Set-Cookie
  const { data } = await api.post("/auth/login", credentials);
  return data;
}

// 로그아웃: 서버가 RefreshToken 쿠키를 만료시키고 DB의 RT를 무효화
export async function callLogout() {
  try {
    const { data } = await api.post("/auth/logout");
    return data;
  } catch (err) {
    // 서버 응답이 실패해도 클라이언트 측 로그아웃은 계속 진행되어야 합니다.
    console.error("로그아웃 요청 실패", err);
    return null;
  }
}

// ───────────────── 내 정보(프로필) 조회 / 수정 ─────────────────
// 서버에서 내려주는 '내 정보'의 형태
export interface MeResponse {
  _id: string;
  email: string;
  nickname: string;
  role: "user" | "guardian";
  phone?: string;
  birthDate?: string;          // "YYYY-MM-DD..." (ISO 날짜 문자열)
  age?: number;                // 서버가 birthDate로 자동 계산한 만 나이(virtual)
  gender?: "M" | "F";
  medicalHistory?: string[];   // 질병 목록
}

// 프로필 수정 시 서버로 보내는 값의 형태 (모두 선택)
export interface UpdateMePayload {
  medical_history?: string[];  // 질병 목록 (서버 필드명: medicalHistory)
  phone?: string;
  birthDate?: string;          // "YYYY-MM-DD"
  gender?: "M" | "F";
}

// 내 정보 불러오기 (프로필 화면 첫 진입 시 사용)
export async function getMe() {
  const { data } = await api.get<MeResponse>("/auth/me");
  return data;
}

// 내 정보 저장하기 (프로필 화면 저장 버튼에서 사용)
export async function updateMe(payload: UpdateMePayload) {
  const { data } = await api.patch<MeResponse>("/auth/me", payload);
  return data;
}

// ───────────────── 소셜 로그인 ─────────────────
// 백엔드 OAuth 진입점으로 브라우저 이동 (role 함께 전달)
export function startSocialLogin(
  provider: "google" | "naver" | "kakao",
  role: "user" | "guardian"
) {
  const url = `${API_BASE_URL}/api/auth/${provider}?role=${encodeURIComponent(role)}`;
  window.location.href = url;
}

// 쿠키의 RefreshToken으로 AccessToken + 사용자 정보 획득 (부팅/콜백 시)
export async function exchangeToken() {
  const { data } = await api.post("/auth/token");
  return data; // { token, user: { email, role } }
}

// 신규 소셜 가입자: 역할 + 인증된 휴대폰번호로 가입 완료 → 정식 토큰 발급
export async function completeSocialSignup(payload: {
  role: "user" | "guardian";
  phone: string;
}) {
  const { data } = await api.post("/auth/social/complete", payload);
  return data; // { token, user: { email, role } }
}

export default api;
