const mongoose = require('mongoose');

const analysisResultSchema = new mongoose.Schema({
  measurement_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Measurement', unique: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  arrhythmia_class: String,
  arrhythmia_prob: Number,
  af_detected: Boolean,
  af_prob: Number,
  hrv_rmssd: Number,
  hrv_sdnn: Number,
  hrv_lfhf: Number,
  anomaly_detected: Boolean,
  risk_score: { type: Number, min: 0, max: 100 },
  risk_level: { type: String, enum: ['high', 'mid', 'low'] },
  analyzed_at: Date,
}, { timestamps: true });

module.exports = mongoose.model('AnalysisResult', analysisResultSchema);
