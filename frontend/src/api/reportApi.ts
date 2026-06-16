import api from "./authApi";

/** 내 리포트 목록 조회 */
export const getReportList = async () => {
  const { data } = await api.get("/reports");
  return data;
};

/** 특정 분석 결과의 리포트 조회 */
export const getReport = async (analysisId: string) => {
  const { data } = await api.get(`/reports/${analysisId}`);
  return data;
};

/** 리포트 생성 (Gemini 연동) */
export const generateReport = async (analysisId: string) => {
  const { data } = await api.post(`/reports/${analysisId}/generate`);
  return data;
};

/** 보호자가 환자의 리포트 목록 조회 */
export const getPatientReportList = async (userId: string) => {
  const { data } = await api.get(`/reports/patient/${userId}`);
  return data;
};

/** 보호자가 환자의 특정 리포트 조회 */
export const getPatientReport = async (userId: string, analysisId: string) => {
  const { data } = await api.get(`/reports/patient/${userId}/${analysisId}`);
  return data;
};
