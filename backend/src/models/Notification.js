import mongoose from 'mongoose';
const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    analysisId: { type: Schema.Types.ObjectId, ref: 'AnalysisResult', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    guardianId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    riskLevel: { type: String, enum: ['high', 'mid', 'low'], required: true },
    channel: { type: String, enum: ['push', 'sms'], required: true },
    message: { type: String, required: true, maxlength: 1000 },
    sendStatus: { type: String, enum: ['success', 'fail'], required: true },
    isRead: { type: Boolean, default: false },
    sentAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

notificationSchema.index({ guardianId: 1, sentAt: -1 });
notificationSchema.index({ analysisId: 1 });

export default mongoose.model('Notification', notificationSchema);