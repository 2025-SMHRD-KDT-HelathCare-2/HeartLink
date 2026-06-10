const Measurement = require('../models/Measurement');
const AnalysisResult = require('../models/AnalysisResult');

exports.notify = async (req, res, next) => {
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

    const analysis = await AnalysisResult.create({
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
    });

    await Measurement.findByIdAndUpdate(measurement_id, { status: 'completed' });

    // TODO: 리포트 생성 (Gemini 연동)
    // TODO: 위험도별 알림 발송 (FCM/SMS)

    res.json({ ok: true, analysisId: analysis._id });
  } catch (err) {
    next(err);
  }
};
