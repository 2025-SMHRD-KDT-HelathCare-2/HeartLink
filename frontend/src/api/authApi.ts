import axios from "axios";

const API_BASE_URL =
  import.meta.env?.VITE_API_BASE_URL ?? "http://localhost:3000";

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: { "Content-Type": "application/json" },
});

// 요청 인터셉터: 저장된 토큰이 있으면 Authorization 헤더 자동 첨부
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
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

// 응답 인터셉터: TOKEN_EXPIRED → 자동 재발급 후 원본 요청 재시도
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
        const storedRT = localStorage.getItem("refreshToken");
        if (!storedRT) throw new Error("no_refresh_token");

        const { data } = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
          refreshToken: storedRT,
        });

        localStorage.setItem("token", data.token);
        localStorage.setItem("refreshToken", data.refreshToken);

        processQueue(null, data.token);
        originalRequest.headers.Authorization = `Bearer ${data.token}`;
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
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

export async function sendVerificationCode(phone: string) {
  const { data } = await api.post("/auth/phone/send", { phone });
  return data;
}

export async function verifyPhoneCode(phone: string, code: string) {
  const { data } = await api.post("/auth/phone/verify", { phone, code });
  return data;
}

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
  const { data } = await api.post("/auth/login", credentials);
  return data;
}

// 인터셉터 순환 방지를 위해 raw axios 사용
export async function callLogout(refreshToken: string) {
  try {
    await axios.post(`${API_BASE_URL}/api/auth/logout`, { refreshToken });
  } catch {
    // 서버 오류와 무관하게 로컬 상태는 항상 초기화
  }
}

export default api;
