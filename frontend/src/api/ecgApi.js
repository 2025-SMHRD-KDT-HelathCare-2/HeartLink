import api from "./axios";

/**
 * ECG 파일 업로드
 * POST /api/ecg/upload
 * @param {File} file - 업로드할 ECG 파일 (CSV, EDF, DAT)
 * @param {number} userId - 대상 어르신 ID
 */
export const uploadECG = async (file, userId) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("userId", userId);
  const res = await api.post("/api/ecg/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

/**
 * ECG 분석 요청 (AI 서버)
 * POST /api/ecg/analyze
 * @param {string} ecgId - 업로드된 ECG ID
 */
export const analyzeECG = async (ecgId) => {
  const res = await api.post("/api/ecg/analyze", { ecgId });
  return res.data;
};

/**
 * ECG 분석 결과 조회
 * GET /api/ecg/result/:ecgId
 */
export const getECGResult = async (ecgId) => {
  const res = await api.get(`/api/ecg/result/${ecgId}`);
  return res.data;
};

/**
 * 유저의 ECG 목록 조회
 * GET /api/ecg/list/:userId
 */
export const getECGList = async (userId) => {
  const res = await api.get(`/api/ecg/list/${userId}`);
  return res.data;
};
