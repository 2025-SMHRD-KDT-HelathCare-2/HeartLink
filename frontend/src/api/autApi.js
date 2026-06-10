// src/api/authApi.js
// HeartLink 인증 관련 API 모듈 (axios 기반)

import axios from "axios";

// Vite 환경변수(VITE_API_BASE_URL)가 있으면 사용하고,
// 없으면 백엔드 기본 포트(3000)로 연결
const API_BASE_URL =
  import.meta.env?.VITE_API_BASE_URL ?? "http://localhost:3000";

// 공통 axios 인스턴스
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
      error.response?.data?.message ??
      "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
    const normalized = new Error(message);
    normalized.status = error.response?.status;
    normalized.data = error.response?.data;
    return Promise.reject(normalized);
  }
);

/**
 * 회원가입 (간단 모드 / 상세 모드 공용)
 *
 * 간단 모드 payload:
 *   { email, password, nickname, role }
 *
 * 상세 모드 payload:
 *   { email, password, nickname, role,
 *     age, gender, medical_history, medications }
 *
 * @param {Object} payload 회원가입 정보
 * @returns {Promise<{ message: string, userId: string }>}
 */
export async function register(payload) {
  const { data } = await api.post("/auth/register", payload);
  return data;
}

/**
 * 로그인
 * @param {{ email: string, password: string }} credentials
 * @returns {Promise<{ token: string, role: "user" | "guardian" }>}
 */
export async function login(credentials) {
  const { data } = await api.post("/auth/login", credentials);
  return data;
}

export default api;
