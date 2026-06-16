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
    return Promise.reject(new Error(message));
  }
);

// ───────────────── 휴대폰 인증 ─────────────────
export async function sendVerificationCode(phone: string) {
  const { data } = await api.post("/auth/phone/send", { phone });
  return data;
}

export async function verifyPhoneCode(phone: string, code: string) {
  const { data } = await api.post("/auth/phone/verify", { phone, code });
  return data;
}

// ───────────────── 일반 회원가입 / 로그인 ─────────────────
export interface RegisterPayload {
  email: string;
  password: string;
  nickname: string;
  role: "user" | "guardian";
  phone: string;
  age?: number;
  gender?: "M" | "F";
  medical_history?: string[];
  medications?: string[];
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

// ───────────────── 소셜 로그인 ─────────────────
// 백엔드 OAuth 진입점으로 브라우저 이동 (state 생성·인가URL 리다이렉트는 백엔드가 처리)
export function startSocialLogin(provider: "google" | "naver" | "kakao") {
  window.location.href = `${API_BASE_URL}/api/auth/${provider}`;
}

// 쿠키의 RefreshToken으로 AccessToken + 사용자 정보 획득 (앱 부팅/소셜 콜백 시 사용)
export async function exchangeToken() {
  // 응답: { token, user: { email, role } }
  const { data } = await api.post("/auth/token");
  return data;
}

// ───────────────── 로그아웃 ─────────────────
// 인터셉터 순환 방지를 위해 raw axios 사용 (쿠키 만료 + 서버 RT 무효화)
export async function callLogout() {
  try {
    await axios.post(`${API_BASE_URL}/api/auth/logout`, {}, { withCredentials: true });
  } catch {
    // 서버 오류와 무관하게 로컬 상태는 항상 초기화
  }
}

export default api;
