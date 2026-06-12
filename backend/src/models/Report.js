import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    analysis_id:          { type: mongoose.Schema.Types.ObjectId, ref: 'AnalysisResult', required: true },
    user_id:              { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    report_type:          { type: String, required: true, enum: ['self', 'guardian'] },
    report_category:      { type: String, required: true, enum: ['emergency_alert', 'full_report'] },
    report_text_user:     { type: String, maxlength: 5000 },
    report_text_guardian: { type: String, maxlength: 5000 },
    recommended_action:   { type: String, maxlength: 1000 },
    tts_audio_url:        { type: String, maxlength: 1000 },
    pdf_url:              { type: String, maxlength: 1000 },
    risk_level:           { type: String, required: true, enum: ['high', 'mid', 'low'] },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
    collection: 'reports',
  }
);

reportSchema.index({ analysis_id: 1 });
reportSchema.index({ user_id: 1, created_at: -1 });

export default mongoose.model('Report', reportSchema);
