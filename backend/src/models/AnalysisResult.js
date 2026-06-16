import mongoose from 'mongoose';
const { Schema } = mongoose;

const analysisResultSchema = new Schema(
  {
    measurementId: { type: Schema.Types.ObjectId, ref: 'Measurement', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    arrhythmiaClass: { type: String, enum: ['N', 'SVEB', 'VEB', 'F', 'Q'] },
    arrhythmiaProb: { type: Number },
    afDetected: { type: Boolean },
    afProb: { type: Number },

    hrvRmssd: { type: Number },
    hrvSdnn: { type: Number },
    hrvLfhf: { type: Number },

    heart_rate: { type: Number },
    arrhythmia_count: { type: Number },

    anomalyDetected: { type: Boolean },
    riskScore: { type: Number, required: true, min: 0, max: 100 },
    riskLevel: { type: String, enum: ['high', 'mid', 'low'], required: true },
    heartRate: { type: Number },
    analyzedAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

analysisResultSchema.index({ measurementId: 1 }, { unique: true });
analysisResultSchema.index({ userId: 1, analyzedAt: -1 });
analysisResultSchema.index({ riskLevel: 1 });

export default mongoose.model('AnalysisResult', analysisResultSchema);
