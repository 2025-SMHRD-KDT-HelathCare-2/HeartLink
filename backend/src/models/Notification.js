import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    analysis_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AnalysisResult', required: true },
    user_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    guardian_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    risk_level:  { type: String, required: true, enum: ['high', 'mid', 'low'] },
    channel:     { type: String, required: true, enum: ['push', 'sms'] },
    message:     { type: String, required: true, maxlength: 1000 },
    send_status: { type: String, required: true, enum: ['success', 'fail'] },
    is_read:     { type: Boolean, default: false },
    sent_at:     { type: Date, required: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
    collection: 'notifications',
  }
);

notificationSchema.index({ guardian_id: 1, sent_at: -1 });
notificationSchema.index({ analysis_id: 1 });

export default mongoose.model('Notification', notificationSchema);
