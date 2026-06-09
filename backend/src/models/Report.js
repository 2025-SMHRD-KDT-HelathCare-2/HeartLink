const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  analysis_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AnalysisResult' },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  report_type: { type: String, enum: ['self', 'guardian'] },
  report_category: { type: String, enum: ['emergency', 'full'] },
  report_text_user: String,
  report_text_guardian: String,
  recommended_action: String,
  tts_audio_url: String,
  pdf_url: String,
  risk_level: String,
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);
