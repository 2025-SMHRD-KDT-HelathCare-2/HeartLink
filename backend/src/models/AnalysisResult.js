import mongoose from 'mongoose';

const analysisResultSchema = new mongoose.Schema(
  {
    measurement_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'Measurement', required: true, unique: true },
    user_id:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    arrhythmia_class: { type: String, enum: ['N', 'SVEB', 'VEB', 'F', 'Q'] },
    arrhythmia_prob:  { type: Number },
    af_detected:      { type: Boolean },
    af_prob:          { type: Number },
    hrv_rmssd:        { type: Number },
    hrv_sdnn:         { type: Number },
    hrv_lfhf:         { type: Number },
    anomaly_detected: { type: Boolean },
    risk_score:       { type: Number, required: true, min: 0, max: 100 },
    risk_level:       { type: String, required: true, enum: ['high', 'mid', 'low'] },
    analyzed_at:      { type: Date, required: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
    collection: 'analysis_results',
  }
);

analysisResultSchema.index({ user_id: 1, analyzed_at: -1 });
analysisResultSchema.index({ risk_level: 1 });

export default mongoose.model('AnalysisResult', analysisResultSchema);
