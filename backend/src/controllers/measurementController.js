import Measurement from '../models/Measurement.js';
import AnalysisResult from '../models/AnalysisResult.js';
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

const GUARDIAN_RISK_MESSAGES = {
  high: '즉시 상태를 확인하고 필요 시 병원 방문을 도와주세요.',
  mid:  '어르신 상태를 한번 확인해 보세요.',
};

// AI 서버 응답 후 최초 조회 1회만 전달하기 위한 서버 메모리 캐시 (DB 미저장)
const ecgFullCache = new Map();

const DEVICE_SAMPLING_RATE = {
  apple_watch: 512,
};

export const uploadECG = async (req, res, next) => {
  try {
    const { measured_at, device_type } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: '파일이 전송되지 않았습니다. 다시 시도해 주세요.' });
    }

    const samplingRate = DEVICE_SAMPLING_RATE[device_type] ?? 250;
    const user = await User.findById(req.user.id).select('age gender medicalHistory deviceToken nickname');

    const measurement = await Measurement.create({
      userId: req.user.id,
      fileName: file.originalname,
      fileExt: file.originalname.split('.').pop().toUpperCase(),
      fileSize: file.size,
      deviceType: device_type ?? null,
      status: 'processing',
      measuredAt: measured_at || new Date(),
    });

    // 1단계: /analyze/preview - 전처리만 빠르게, lite 파형 즉시 저장
    try {
      const { data: previewData } = await aiService.preview({
        fileBuffer: file.buffer,
        fileName: file.originalname,
        measurementId: measurement._id,
        userId: req.user.id,
        samplingRate,
      });
      await Measurement.findByIdAndUpdate(measurement._id, {
        ecgWaveformLite: previewData.ecg_waveform_lite ?? [],
        rPeaks: previewData.r_peaks ?? [],
        samplingRate: 80,
      });
    } catch (previewErr) {
      console.error('preview 실패, analyze 계속 진행:', previewErr.message);
    }

    // lite 저장 완료 후 프론트에 201 응답 (폴링 시작 가능)
    res.status(201).json({ measurementId: measurement._id, status: 'processing' });

    // 2단계: /analyze - 모델 추론 포함, fire-and-forget
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
      const riskLevel = data.risk_level ?? (score >= 14 ? 'high' : score >= 3 ? 'mid' : 'low');
      
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

      // AI 서버가 보낸 경량화 파형(80Hz)과 R-peak를 DB에 저장, samplingRate는 80 고정
      await Measurement.findByIdAndUpdate(measurement._id, {
        status: 'completed',
        ecgWaveformLite: data.ecg_waveform_lite ?? [],
        rPeaks: data.r_peaks ?? [],
        samplingRate: 80,
      });

      // ecg_waveform_full은 DB 미저장, 최초 조회 시 1회 전달 후 삭제
      if (data.ecg_waveform_full?.length) {
        ecgFullCache.set(measurement._id.toString(), data.ecg_waveform_full);
      }

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
            sendPushNotification(token, `${user.nickname ?? '어르신'}님에게 이상이 감지됐어요`, GUARDIAN_RISK_MESSAGES[riskLevel] ?? GUARDIAN_RISK_MESSAGES.mid)
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


    }).catch(err => {
      console.error('AI 서버 분석 실패:', err.message);
      console.error('에러 상세:', err.name, JSON.stringify(err.errors ?? err.errorResponse ?? {}));
      Measurement.findByIdAndUpdate(measurement._id, { status: 'failed' }).catch(() => {});
    });

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

    // ecg_waveform_full은 최초 조회 시 1회만 응답에 포함 후 캐시에서 제거
    const key = measurement._id.toString();
    const ecgWaveformFull = ecgFullCache.get(key) ?? null;
    if (ecgWaveformFull) ecgFullCache.delete(key);

    res.json({ ...measurement.toObject(), analysis: analysis ?? null, ecgWaveformFull });
  } catch (err) {
    next(err);
  }
};

// 보호자가 특정 사용자(피보호자)의 측정 목록 조회
export const getPatientMeasurements = async (req, res, next) => {
  try {
    const hasAccess = await GuardianRelation.findOne({
      guardianId: req.user.id,
      userId: req.params.userId,
      relationStatus: 'accepted',
    });
    if (!hasAccess) return res.status(403).json({ message: '해당 환자의 데이터에 접근 권한이 없습니다.' });

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
    const hasAccess = await GuardianRelation.findOne({
      guardianId: req.user.id,
      userId: req.params.userId,
      relationStatus: 'accepted',
    });
    if (!hasAccess) return res.status(403).json({ message: '해당 환자의 데이터에 접근 권한이 없습니다.' });

    const measurement = await Measurement.findOne({ _id: req.params.id, userId: req.params.userId });
    if (!measurement) return res.status(404).json({ message: '없는 측정 데이터입니다.' });

    const analysis = await AnalysisResult.findOne({ measurementId: measurement._id });
    res.json({ ...measurement.toObject(), analysis: analysis ?? null });
  } catch (err) {
    next(err);
  }
};
