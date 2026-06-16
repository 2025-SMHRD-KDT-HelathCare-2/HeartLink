import mongoose from 'mongoose';
const { Schema } = mongoose;

const reportSchema = new Schema(
  {
    analysisId: { type: Schema.Types.ObjectId, ref: 'AnalysisResult', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reportType: { type: String, enum: ['self', 'guardian'], required: true },
    reportCategory: {
      type: String,
      enum: ['emergency_alert', 'full_report'],
      required: true,
    },
    reportTextUser: { type: String, maxlength: 5000 },
    reportTextGuardian: { type: String, maxlength: 5000 },
    recommendedAction: { type: String, maxlength: 1000 },
    ttsAudioUrl: { type: String, maxlength: 1000 },
    pdfUrl: { type: String, maxlength: 1000 },
    riskLevel: { type: String, enum: ['high', 'mid', 'low'], required: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

reportSchema.index({ analysisId: 1 });
reportSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('Report', reportSchema);
