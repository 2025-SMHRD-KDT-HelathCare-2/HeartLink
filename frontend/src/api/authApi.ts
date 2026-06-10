// src/api/authApi.ts
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

// 응답 인터셉터: 서버 에러 메시지를 일관된 형태의 Error로 변환
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error?.response?.data?.message ??
      "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
    const normalized = new Error(message);
    return Promise.reject(normalized);
  }
);

/**
 * 회원가입 payload
 * - 필수(NN): email, password, nickname, role
 * - 선택: age, gender, medical_history, medications
 */
export interface RegisterPayload {
  email: string;
  password: string;
  nickname: string;
  role: "user" | "guardian";
  age?: number;
  gender?: "M" | "F";
  medical_history?: string[];
  medications?: string[];
}

export async function register(payload: RegisterPayload) {
  const { data } = await api.post("/auth/register", payload);
  return data;
}

export async function login(credentials: {
  email: string;
  password: string;
}) {
  const { data } = await api.post("/auth/login", credentials);
  return data;
}

export default api;
