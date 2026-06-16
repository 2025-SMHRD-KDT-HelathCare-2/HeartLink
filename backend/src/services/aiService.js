import axios from 'axios';
import FormData from 'form-data';

export const analyze = ({ fileBuffer, fileName, measurementId, userId, age, gender, medicalHistory }) => {
  const form = new FormData();
  form.append('file', fileBuffer, fileName);
  form.append('measurement_id', measurementId.toString());
  form.append('user_id', userId.toString());
  form.append('age', String(age ?? 70));
  form.append('gender', gender ?? 'F');
  form.append('medical_history', (medicalHistory ?? []).join(','));

  return axios.post(`${process.env.AI_SERVER_URL}/analyze`, form, {
    headers: form.getHeaders(),
    timeout: 0,
  });
};

export const generateReport = ({
  analysisId, userId, age, gender, medicalHistory,
  arrhythmiaClass, arrhythmiaProb, afDetected, afProb,
  hrvRmssd, hrvSdnn, hrvLfhf, anomalyDetected,
  riskScore, riskLevel, heartRate,
}) => {
  const form = new FormData();
  form.append('analysis_id',      analysisId.toString());
  form.append('user_id',          userId.toString());
  form.append('age',              String(age ?? 70));
  form.append('gender',           gender ?? 'F');
  form.append('medical_history',  (medicalHistory ?? []).join(','));
  form.append('arrhythmia_class', arrhythmiaClass ?? 'N');
  form.append('arrhythmia_prob',  String(arrhythmiaProb ?? 0));
  form.append('af_detected',      String(afDetected ?? false));
  form.append('af_prob',          String(afProb ?? 0));
  form.append('hrv_rmssd',        String(hrvRmssd ?? 0));
  form.append('hrv_sdnn',         String(hrvSdnn ?? 0));
  form.append('hrv_lfhf',         String(hrvLfhf ?? 1));
  form.append('anomaly_detected', String(anomalyDetected ?? false));
  form.append('risk_score',       String(riskScore ?? 0));
  form.append('risk_level',       riskLevel ?? 'low');
  form.append('heart_rate',       String(heartRate ?? 75));

  return axios.post(`${process.env.AI_SERVER_URL}/report`, form, {
    headers: form.getHeaders(),
    timeout: 60000,
  });
};

export const tts = ({ text, speed = 1 }) => {
  const form = new FormData();
  form.append('text',  text);
  form.append('speed', String(speed));

  return axios.post(`${process.env.AI_SERVER_URL}/tts`, form, {
    headers: form.getHeaders(),
    responseType: 'arraybuffer',
    timeout: 30000,
  });
};
