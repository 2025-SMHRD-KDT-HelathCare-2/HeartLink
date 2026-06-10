import api from "./axios";

/**
 * 리포트 생성 (LLM)
 * POST /api/report/generate
 * @param {string} ecgId - 분석된 ECG ID
 */
export const generateReport = async (ecgId) => {
  const res = await api.post("/api/report/generate", { ecgId });
  return res.data;
};

/**
 * 리포트 단건 조회
 * GET /api/report/:reportId
 */
export const getReport = async (reportId) => {
  const res = await api.get(`/api/report/${reportId}`);
  return res.data;
};

/**
 * 유저 리포트 목록 조회
 * GET /api/report/list/:userId
 */
export const getReportList = async (userId) => {
  const res = await api.get(`/api/report/list/${userId}`);
  return res.data;
};

/**
 * 보호자용 리포트 조회
 * GET /api/report/guardian/:memberId
 */
export const getGuardianReport = async (memberId) => {
  const res = await api.get(`/api/report/guardian/${memberId}`);
  return res.data;
};

/**
 * 리포트 PDF 다운로드 URL 조회
 * GET /api/report/pdf/:reportId
 */
export const getReportPDF = async (reportId) => {
  const res = await api.get(`/api/report/pdf/${reportId}`, {
    responseType: "blob",
  });
  return res.data;
};
