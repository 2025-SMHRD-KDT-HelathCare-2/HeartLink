import Measurement from '../models/Measurement.js';
import AnalysisResult from '../models/AnalysisResult.js';
import Report from '../models/Report.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import GuardianRelation from '../models/GuardianRelation.js';
import * as aiService from '../services/aiService.js';
import { sendHighRiskSMS } from './internalController.js';
import { sendPushNotification } from '../utils/notification.js';

const RISK_MESSAGES = {
  high: '심장이 불규칙하게 뛰는 증상이 감지됐어요. 병원 방문을 권해 드려요.',
  mid:  '심장 박동이 평소보다 조금 빨랐어요. 무리하지 말고 쉬어 주세요.',
  low:  '오늘 심장 상태는 양호했어요. 좋은 컨디션을 유지하고 계세요.',
};

// CSV를 직접 파싱해서 경량 파형과 R-peak를 추출하는 임시 함수
// (AI 서버 완성 전까지 사용, AI 서버 연동 시 이 부분 제거하고 fire-and-forget으로 복구)
function parseCSV(buffer) {
  const text = buffer.toString('utf-8');
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error('CSV 데이터가 너무 적습니다.');

  // 애플워치 CSV: 상단에 한글 메타데이터, 이후 숫자 한 줄씩
  // 데이터 시작 줄 인덱스와 샘플링 레이트 자동 감지
  let dataStartIdx = -1;
  let detectedSampleRate = 250;

  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const line = lines[i].trim();
    // 샘플링 레이트 추출: "심박수,512헤르츠" 형태
    const hrMatch = line.match(/(\d+)\s*헤르츠/);
    if (hrMatch) detectedSampleRate = parseInt(hrMatch[1], 10);
    // 순수 숫자 줄이면 데이터 시작
    if (dataStartIdx === -1 && /^-?\d+(\.\d+)?$/.test(line)) {
      dataStartIdx = i;
    }
  }

  const raw = [];

  if (dataStartIdx !== -1) {
    // 애플워치 포맷: 숫자 한 줄씩
    for (let i = dataStartIdx; i < lines.length; i++) {
      const y = parseFloat(lines[i].trim());
      if (!isNaN(y)) raw.push(y);
    }
  } else {
    // MIT-BIH 포맷: 컬럼 헤더 CSV
    const headers = lines[0].split(',').map(h => h.trim().replace(/^['"]|['"]$/g, '').toLowerCase());
    const candidates = ['ecg', 'y', 'value', 'signal', 'mv', 'mlii', 'v5', 'v1', 'v2', 'v6'];
    let yIdx = headers.findIndex(h => candidates.includes(h));
    if (yIdx === -1) {
      const sampleIdx = headers.findIndex(h => h.includes('sample'));
      yIdx = sampleIdx !== -1 ? sampleIdx + 1 : 1;
    }
    if (yIdx === -1 || yIdx >= headers.length) throw new Error('ECG 데이터 컬럼을 찾을 수 없습니다.');
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const y = parseFloat(cols[yIdx]);
      if (!isNaN(y)) raw.push(y);
    }
  }

  if (raw.length < 10) throw new Error('유효한 데이터가 너무 적습니다.');

  // 정규화: 평균을 빼고 -1~1 범위로 스케일링
  const mean = raw.reduce((a, b) => a + b, 0) / raw.length;
  const centered = raw.map(v => v - mean);
  const maxAbs = centered.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  const waveform = centered.map(v => Math.round((v / maxAbs) * 1000) / 1000);

  const sampleRate = detectedSampleRate;

  const max = waveform.reduce((m, v) => Math.max(m, v), -Infinity);
  const threshold = max * 0.6;
  const rPeaks = [];
  for (let i = 1; i < waveform.length - 1; i++) {
    if (waveform[i] > threshold && waveform[i] > waveform[i-1] && waveform[i] > waveform[i+1]) {
      const idx = i;
      if (rPeaks.length === 0 || (idx - rPeaks[rPeaks.length - 1]) > sampleRate * 0.3) {
        rPeaks.push(idx);
      }
    }
  }

  // 시각화용 다운샘플링 (최대 5000개)
  const MAX_POINTS = 5000;
  let finalWaveform = waveform;
  let finalRPeaks = rPeaks;
  let finalSampleRate = sampleRate;

  if (waveform.length > MAX_POINTS) {
    const step = Math.ceil(waveform.length / MAX_POINTS);
    finalWaveform = waveform.filter((_, i) => i % step === 0);
    finalRPeaks = rPeaks.map(idx => Math.round(idx / step)).filter((v, i, arr) => arr.indexOf(v) === i);
    finalSampleRate = Math.round(sampleRate / step);
  }

  return { waveform: finalWaveform, rPeaks: finalRPeaks, sampleRate: finalSampleRate, originalSampleRate: detectedSampleRate };
}

export const uploadECG = async (req, res, next) => {
  try {
    const { measured_at } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: '파일이 전송되지 않았습니다. 다시 시도해 주세요.' });
    }

    const user = await User.findById(req.user.id).select('age gender medicalHistory deviceToken');

    const measurement = await Measurement.create({
      userId: req.user.id,
      fileName: file.originalname,
      fileExt: file.originalname.split('.').pop().toUpperCase(),
      fileSize: file.size,
      status: 'processing',
      measuredAt: measured_at || new Date(),
    });

    // CSV 파형 추출 후 AI 서버로 분석 요청
    let samplingRate = 512;
    try {
      if (measurement.fileExt === 'CSV') {
        const { waveform, rPeaks, sampleRate, originalSampleRate } = parseCSV(file.buffer);
        samplingRate = originalSampleRate;
        await Measurement.findByIdAndUpdate(measurement._id, {
          ecgWaveformLite: waveform,
          rPeaks,
          samplingRate: sampleRate,
        });
      }
    } catch (parseErr) {
      console.error('CSV 파싱 실패:', parseErr.message);
      await Measurement.findByIdAndUpdate(measurement._id, { status: 'failed' });
      return res.status(201).json({ measurementId: measurement._id, status: 'failed' });
    }

    // AI 서버 분석 요청 (fire-and-forget)
    aiService.analyze({
      fileBuffer: file.buffer,
      fileName: file.originalname,
      measurementId: measurement._id,
      userId: req.user.id,
      age: user?.age,
      gender: user?.gender,
      medicalHistory: user?.medicalHistory,
      samplingRate,
    }).then(async ({ data }) => {
      const score = data.risk_score ?? 0;
      const riskLevel = data.risk_level ?? (score >= 67 ? 'high' : score >= 34 ? 'mid' : 'low');
      
      // 분석 결과 저장
      const analysis = await AnalysisResult.findOneAndUpdate(
        { measurementId: measurement._id },
        {
          measurementId: measurement._id,
          userId: req.user.id,
          arrhythmiaClass: data.arrhythmia_class,
          arrhythmiaProb: data.arrhythmia_prob,
          afDetected: data.af_detected,
          afProb: data.af_prob,
          hrvRmssd: data.hrv_rmssd,
          hrvSdnn: data.hrv_sdnn,
          hrvLfhf: data.hrv_lfhf,
          anomalyDetected: data.anomaly_detected,
          arrhythmiaCount: data.arrhythmia_count,
          riskScore: data.risk_score,
          riskLevel: data.risk_level,
          heartRate: data.heart_rate,
          analyzedAt: new Date(),
        },
        { upsert: true, new: true }
      );

      await Measurement.findByIdAndUpdate(measurement._id, { status: 'completed' });

      // 수락된 보호자 목록 조회 (deviceToken 포함)
      const guardianRelations = await GuardianRelation.find({
        userId: req.user.id,
        relationStatus: 'accepted',
      }).populate('guardianId', 'deviceToken');

      // 보호자 알림: 중/상일 때만 DB 기록 + FCM push
      if ((riskLevel === 'high' || riskLevel === 'mid') && guardianRelations.length > 0) {
        await Notification.insertMany(
          guardianRelations.map(rel => ({
            analysisId:  analysis._id,
            userId:      req.user.id,
            guardianId:  rel.guardianId._id ?? rel.guardianId,
            riskLevel,
            channel:     'push',
            message:     RISK_MESSAGES[riskLevel] ?? RISK_MESSAGES.low,
            sendStatus:  'success',
            isRead:      false,
            sentAt:      new Date(),
          }))
        );

        for (const rel of guardianRelations) {
          const token = rel.guardianId?.deviceToken;
          if (token) {
            sendPushNotification(token, '보호 중인 분에게 이상이 감지됐어요', RISK_MESSAGES[riskLevel] ?? RISK_MESSAGES.low)
              .catch(err => console.error('보호자 FCM 실패:', err.message));
          }
        }
      }

      // 사용자 FCM push + SMS: 상일 때만
      if (riskLevel === 'high') {
        if (user?.deviceToken) {
          sendPushNotification(user.deviceToken, '위험 신호가 감지되었어요', '심장이 불규칙하게 뛰는 증상이 있어요. 내 건강 결과를 확인해 주세요.')
            .catch(err => console.error('사용자 FCM 실패:', err.message));
        }
        sendHighRiskSMS(req.user.id, score).catch(err =>
          console.error('SMS 발송 중 오류:', err.message)
        );
      }

      // 리포트 생성 (fire-and-forget)
      aiService.generateReport({
        analysisId:      analysis._id,
        userId:          req.user.id,
        age:             user?.age,
        gender:          user?.gender,
        medicalHistory:  user?.medicalHistory,
        arrhythmiaClass: data.arrhythmia_class,
        arrhythmiaProb:  data.arrhythmia_prob,
        afDetected:      data.af_detected,
        afProb:          data.af_prob,
        hrvRmssd:        data.hrv_rmssd,
        hrvSdnn:         data.hrv_sdnn,
        hrvLfhf:         data.hrv_lfhf,
        anomalyDetected: data.anomaly_detected,
        riskScore:       score,
        riskLevel,
        heartRate:       data.heart_rate,
      }).then(async ({ data: reportData }) => {
        await Report.create({
          analysisId:          analysis._id,
          userId:              req.user.id,
          reportType:          'self',
          reportCategory:      'full_report',
          reportTextUser:      reportData.report_text_user,
          reportTextGuardian:  reportData.report_text_guardian,
          recommendedAction:   reportData.recommended_action,
          riskLevel:           data.risk_level,
        });
      }).catch(err => {
        console.error('리포트 생성 실패:', err.message);
      });

    }).catch(err => {
      console.error('AI 서버 분석 실패:', err.message);
      console.error('에러 상세:', err.name, JSON.stringify(err.errors ?? err.errorResponse ?? {}));
      Measurement.findByIdAndUpdate(measurement._id, { status: 'failed' }).catch(() => {});
    });

    res.status(201).json({ measurementId: measurement._id, status: 'processing' });
  } catch (err) {
    next(err);
  }
};

export const getMeasurements = async (req, res, next) => {
  try {
    const measurements = await Measurement.find({ userId: req.user.id }).sort({ measuredAt: -1 });

    const ids = measurements.map(m => m._id);
    const analyses = await AnalysisResult.find({ measurementId: { $in: ids } });
    const analysisMap = new Map(analyses.map(a => [a.measurementId.toString(), a]));

    const result = measurements.map(m => ({
      ...m.toObject(),
      analysis: analysisMap.get(m._id.toString()) ?? null,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getMeasurement = async (req, res, next) => {
  try {
    const measurement = await Measurement.findOne({ _id: req.params.id, userId: req.user.id });
    if (!measurement) return res.status(404).json({ message: '없는 측정 데이터입니다.' });
    const analysis = await AnalysisResult.findOne({ measurementId: measurement._id });
    res.json({ ...measurement.toObject(), analysis: analysis ?? null });
  } catch (err) {
    next(err);
  }
};

// 보호자가 특정 사용자(피보호자)의 측정 목록 조회
export const getPatientMeasurements = async (req, res, next) => {
  try {
    const measurements = await Measurement.find({ userId: req.params.userId }).sort({ measuredAt: -1 });

    const ids = measurements.map(m => m._id);
    const analyses = await AnalysisResult.find({ measurementId: { $in: ids } });
    const analysisMap = new Map(analyses.map(a => [a.measurementId.toString(), a]));

    const result = measurements.map(m => ({
      ...m.toObject(),
      analysis: analysisMap.get(m._id.toString()) ?? null,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
};

// 보호자가 특정 사용자(피보호자)의 측정 단건 조회
export const getPatientMeasurement = async (req, res, next) => {
  try {
    const measurement = await Measurement.findOne({ _id: req.params.id, userId: req.params.userId });
    if (!measurement) return res.status(404).json({ message: '없는 측정 데이터입니다.' });
    res.json(measurement);
  } catch (err) {
    next(err);
  }
};
