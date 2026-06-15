import Measurement from '../models/Measurement.js';
import AnalysisResult from '../models/AnalysisResult.js';
import GuardianRelation from '../models/GuardianRelation.js';
import User from '../models/User.js';
import { sendSMS } from '../services/smsService.js';

const RISK_LABEL = { high: '위험', mid: '주의', low: '양호' };

async function sendHighRiskSMS(userId, riskScore) {
  const [user, relations] = await Promise.all([
    User.findById(userId).select('phone nickname'),
    GuardianRelation.find({ user_id: userId, relation_status: 'accepted' })
      .populate('guardian_id', 'phone nickname'),
  ]);

  const message =
    `[HeartLink] ${user?.nickname ?? '사용자'}님의 심전도 위험도가 ` +
    `${riskScore}점(위험)으로 측정됐습니다. 즉시 확인해 주세요.`;

  const targets = [];

  if (user?.phone) targets.push({ to: user.phone, label: '사용자' });

  for (const rel of relations) {
    const guardian = rel.guardian_id;
    if (guardian?.phone) targets.push({ to: guardian.phone, label: '보호자' });
  }

  const results = await Promise.allSettled(
    targets.map(t => sendSMS({ to: t.to, message }))
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
      { measurement_id },
      {
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
        analyzed_at: new Date(),
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
