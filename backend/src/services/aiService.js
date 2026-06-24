import axios from 'axios';
import FormData from 'form-data';

export const preview = ({ fileBuffer, fileName, measurementId, userId, samplingRate }) => {
  const form = new FormData();
  form.append('file', fileBuffer, fileName);
  form.append('measurement_id', measurementId.toString());
  form.append('user_id', userId.toString());
  form.append('sampling_rate', String(samplingRate ?? 250));

  return axios.post(`${process.env.AI_SERVER_URL}/analyze/preview`, form, {
    headers: form.getHeaders(),
    timeout: 30000,
  });
};

export const analyze = ({ fileBuffer, fileName, measurementId, userId, age, gender, medicalHistory, samplingRate }) => {
  const form = new FormData();
  form.append('file', fileBuffer, fileName);
  form.append('measurement_id', measurementId.toString());
  form.append('user_id', userId.toString());
  form.append('age', String(age ?? 70));
  form.append('gender', gender ?? 'F');
  form.append('medical_history', (medicalHistory ?? []).join(','));
  form.append('sampling_rate', String(samplingRate ?? 250));

  return axios.post(`${process.env.AI_SERVER_URL}/analyze`, form, {
    headers: form.getHeaders(),
    timeout: 0,
  });
};

export const generateReport = ({
  analysisId, userId, age, gender, medicalHistory,
  reportPeriod, measurementCount,
  arrhythmiaClass, arrhythmiaProb, afDetected, afProb,
  hrvRmssd, hrvSdnn, hrvLfhf, anomalyDetected,
  riskScore, riskLevel, heartRate,
  avgHeartRate, maxRiskLevel, afDetectedDays, totalArrhythmiaCount, riskDistribution,
  target = 'both',
}) => {
  const form = new FormData();
  form.append('analysis_id',      analysisId.toString());
  form.append('user_id',          userId.toString());
  form.append('age',              String(age ?? 70));
  form.append('gender',           gender ?? 'F');
  form.append('medical_history',  (medicalHistory ?? []).join(','));
  // 리포트 기간 정보
  form.append('report_period',    reportPeriod ?? 'daily');
  form.append('measurement_count', String(measurementCount ?? 1));
  // 최신 측정값
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
  // 기간 종합 요약값 (daily=1건이면 최신값과 동일, weekly는 집계값)
  form.append('avg_heart_rate',          String(avgHeartRate ?? heartRate ?? 75));
  form.append('max_risk_level',          maxRiskLevel ?? riskLevel ?? 'low');
  form.append('af_detected_days',        String(afDetectedDays ?? 0));
  form.append('total_arrhythmia_count',  String(totalArrhythmiaCount ?? 0));
  form.append('risk_distribution_low',   String(riskDistribution?.low  ?? 100));
  form.append('risk_distribution_mid',   String(riskDistribution?.mid  ?? 0));
  form.append('risk_distribution_high',  String(riskDistribution?.high ?? 0));
  form.append('target',           target);

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
