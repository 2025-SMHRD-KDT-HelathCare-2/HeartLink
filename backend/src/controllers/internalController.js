// [컨트롤러] 내부 API — AI 서버 콜백 수신(분석 결과 저장), 위험도 상 시 SMS 발송
import Measurement from '../models/Measurement.js';
import AnalysisResult from '../models/AnalysisResult.js';
import GuardianRelation from '../models/GuardianRelation.js';
import User from '../models/User.js';
import { sendSMS } from '../services/smsService.js';

const RISK_LABEL = { high: '위험', mid: '주의', low: '양호' };

export async function sendHighRiskSMS(userId, riskScore) {
  const [user, relations] = await Promise.all([
    User.findById(userId).select('phone nickname'),
    GuardianRelation.find({ userId, relationStatus: 'accepted' })
      .populate('guardianId', 'phone nickname'),
  ]);

  const userMessage =
    `[HeartLink] ${user?.nickname ?? '사용자'}님의 심전도 측정 결과 위험 신호가 감지됐습니다(${riskScore}점). ` +
    `즉시 병원을 방문하시거나 보호자에게 연락하실 것을 권장합니다. ` +
    `(본 서비스는 의료기기가 아니며 의사의 진단을 대신하지 않습니다)`;

  const guardianMessage =
    `[HeartLink] ${user?.nickname ?? '어르신'}님의 심전도 측정 결과 위험 신호가 감지됐습니다(${riskScore}점). ` +
    `즉시 연락하시거나 병원 방문을 도와주실 것을 권장합니다. ` +
    `(본 서비스는 의료기기가 아니며 의사의 진단을 대신하지 않습니다)`;

  const targets = [];

  if (user?.phone) targets.push({ to: user.phone, label: '사용자', message: userMessage });

  for (const rel of relations) {
    const guardian = rel.guardianId;
    if (guardian?.phone) targets.push({ to: guardian.phone, label: '보호자', message: guardianMessage });
  }

  const results = await Promise.allSettled(
    targets.map(t => sendSMS({ to: t.to, message: t.message }))
  );

  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      console.log(`✅ SMS 발송 성공 [${targets[i].label}] ${targets[i].to}`);
    } else {
      console.error(`❌ SMS 발송 실패 [${targets[i].label}] ${targets[i].to}:`, r.reason?.message);
    }
  });
}

export const notify = async (req, res, next) => {
  try {
    const {
      measurement_id,
      user_id,
      arrhythmia_class,
      arrhythmia_prob,
      af_detected,
      af_prob,
      hrv_rmssd,
      hrv_sdnn,
      hrv_lfhf,
      anomaly_detected,
      risk_score,
      risk_level,
    } = req.body;

    const analysis = await AnalysisResult.findOneAndUpdate(
      { measurementId: measurement_id },
      {
        measurementId: measurement_id,
        userId: user_id,
        arrhythmiaClass: arrhythmia_class,
        arrhythmiaProb: arrhythmia_prob,
        afDetected: af_detected,
        afProb: af_prob,
        hrvRmssd: hrv_rmssd,
        hrvSdnn: hrv_sdnn,
        hrvLfhf: hrv_lfhf,
        anomalyDetected: anomaly_detected,
        riskScore: risk_score,
        riskLevel: risk_level,
        analyzedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    await Measurement.findByIdAndUpdate(measurement_id, { status: 'completed' });

    if (risk_level === 'high') {
      sendHighRiskSMS(user_id, risk_score).catch(err =>
        console.error('SMS 발송 중 오류:', err.message)
      );
    }

    // TODO: 리포트 생성 (Gemini 연동)

    res.json({ ok: true, analysisId: analysis._id });
  } catch (err) {
    next(err);
  }
};
