import api from "./authApi";

/** 내 리포트 목록 조회 */
export const getReportList = async () => {
  const { data } = await api.get("/reports");
  return data;
};

/** 특정 리포트 단건 조회 (aggregated chart data 포함) */
export const getReport = async (reportId: string) => {
  const { data } = await api.get(`/reports/${reportId}`);
  return data;
};

/** 리포트 생성 (type: 'daily'|'weekly', analysisId 기준 날짜 범위 필터링) */
export const generateReport = async (type: "daily" | "weekly", analysisId: string, measurementId: string) => {
  const { data } = await api.post("/reports/generate", { type, analysisId, measurementId });
  return data;
};

/** 보호자가 환자의 리포트 목록 조회 */
export const getPatientReportList = async (userId: string) => {
  const { data } = await api.get(`/reports/patient/${userId}`);
  return data;
};

/** 보호자가 환자의 특정 리포트 조회 */
export const getPatientReport = async (userId: string, reportId: string) => {
  const { data } = await api.get(`/reports/patient/${userId}/${reportId}`);
  return data;
};
