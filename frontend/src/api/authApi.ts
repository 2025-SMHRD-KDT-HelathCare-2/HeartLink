// frontend/src/api/authApi.ts
import axios from "axios";
import { getAccessToken, setAccessToken } from "./tokenStore";

const API_BASE_URL =
  import.meta.env?.VITE_API_BASE_URL ?? "http://localhost:3000";

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // httpOnly 쿠키(refreshToken) 자동 전송 — 필수
});

// 요청 인터셉터: 메모리의 Access Token을 Authorization 헤더에 첨부
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 동시 401 요청들이 각자 refresh를 중복 호출하지 않도록 큐 관리
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(err: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (err) reject(err);
    else resolve(token!);
  });
  failedQueue = [];
}

// 응답 인터셉터: TOKEN_EXPIRED → 쿠키 RT로 자동 재발급 후 원본 요청 재시도
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };

    if (
      error?.response?.status === 401 &&
      error?.response?.data?.code === "TOKEN_EXPIRED" &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // refreshToken은 httpOnly 쿠키에 있으므로 body 불필요 (withCredentials로 자동 전송)
        const { data } = await axios.post(
          `${API_BASE_URL}/api/auth/refresh`,
          {},
          { withCredentials: true }
        );

        setAccessToken(data.token);
        processQueue(null, data.token);
        originalRequest.headers.Authorization = `Bearer ${data.token}`;
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        setAccessToken(null);
        localStorage.removeItem("role");
        localStorage.removeItem("user");
        window.dispatchEvent(new Event("auth:logout"));
        return Promise.reject(new Error("로그인이 만료되었습니다. 다시 로그인해 주세요."));
      } finally {
        isRefreshing = false;
      }
    }

    const message =
      error?.response?.data?.message ??
      "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";

      // 가공된 Error 에도 HTTP 상태코드를 실어 보내, 호출하는 쪽에서
      // err.status 로 404 등을 구분할 수 있게 합니다. (원본 응답도 함께 보존)
      const customError = new Error(message) as Error & {
        status?: number;
      response?: typeof error.response;
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
//   - 'medications'(복용 약)은 더 이상 사용하지 않습니다.
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
    // 서버 응답 실패해도 클라이언트 측 로그아웃은 계속 진행되어야 함
    console.error("로그아웃 요청 실패", err);
    return null;
  }
}

// ───────────────── 내 정보(프로필) 조회 / 수정 ─────────────────
// -----------------------------------------------------------------------
// [추가] 프로필 화면에서 사용할 두 가지 함수입니다.
//   - getMe()   : 로그인한 사용자의 현재 정보를 서버에서 불러옵니다.
//   - updateMe(): 사용자가 수정한 정보를 서버에 저장합니다.
//
//   백엔드(authController.js)의 getMe / updateMe 와 짝을 이룹니다.
//   현재 백엔드 updateMe 는 'medicalHistory'(질병 목록)와 'phone'만 수정하며,
//   필요 시 birthDate / gender 도 받을 수 있도록 아래 타입에 포함해 두었습니다.
//   (서버에서 무시되는 값은 그냥 저장되지 않을 뿐 에러가 나지 않습니다.)
// -----------------------------------------------------------------------

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
// 백엔드 OAuth 진입점으로 브라우저 이동
// role을 함께 전달 (소셜 신규 가입 시 사용자가 선택한 역할을 백엔드로 넘김)
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
// (서버는 콜백 시 심어둔 임시 가입 쿠키로 소셜 계정을 식별)
export async function completeSocialSignup(payload: {
  role: "user" | "guardian";
  phone: string;
}) {
  const { data } = await api.post("/auth/social/complete", payload);
  return data; // { token, user: { email, role } }
}


export default api;
