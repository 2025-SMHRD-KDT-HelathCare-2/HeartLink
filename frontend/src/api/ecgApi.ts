import api from "./authApi";

/** ECG 파일 업로드 (측정 생성) */
export const uploadECG = async (
  file: File,
  measuredAt?: string,
  deviceType: string = "apple_watch"
) => {
  const formData = new FormData();
  formData.append("ecg_file", file);
  formData.append("device_type", deviceType);
  if (measuredAt) formData.append("measured_at", measuredAt);
  const { data } = await api.post("/measurements", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

/** 내 측정 목록 조회 (분석 결과 포함) */
export const getMeasurements = async () => {
  const { data } = await api.get("/measurements");
  return data;
};

/** 특정 측정 단건 조회 */
export const getMeasurement = async (measurementId: string) => {
  const { data } = await api.get(`/measurements/${measurementId}`);
  return data;
};

/** 보호자가 환자의 측정 목록 조회 */
export const getPatientMeasurements = async (userId: string) => {
  const { data } = await api.get(`/measurements/patient/${userId}`);
  return data;
};

/** 보호자가 환자의 특정 측정 단건 조회 */
export const getPatientMeasurement = async (userId: string, measurementId: string) => {
  const { data } = await api.get(`/measurements/patient/${userId}/${measurementId}`);
  return data;
};