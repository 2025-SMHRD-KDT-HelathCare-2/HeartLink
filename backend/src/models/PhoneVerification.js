import mongoose from 'mongoose';
const { Schema } = mongoose;

const phoneVerificationSchema = new Schema(
  {
    phone: { type: String, required: true, maxlength: 20 },
    code: { type: String, required: true }, // 해시 저장
    purpose: { type: String, enum: ['signup', 'find_pw'], required: true },
    verified: { type: Boolean, default: false, required: true },
    attemptCount: { type: Number, default: 0, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

phoneVerificationSchema.index({ phone: 1, createdAt: -1 });
phoneVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('PhoneVerification', phoneVerificationSchema);
