import mongoose from 'mongoose';
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, sparse: true },
    password: { type: String }, // 소셜 가입자는 없음

    // 소셜 로그인
    provider: {
      type: String,
      enum: ['local', 'google', 'naver', 'kakao'],
      default: 'local',
      required: true,
    },
    providerId: { type: String },
    profileImage: { type: String },

    nickname: { type: String, required: true, maxlength: 50 },
    role: { type: String, enum: ['user', 'guardian'], required: true },

    // 휴대폰 인증
    phone: { type: String, maxlength: 20 },
    phoneVerified: { type: Boolean, default: false, required: true },

    age: { type: Number },
    gender: { type: String, enum: ['M', 'F'] },
    medicalHistory: { type: [String], default: [] },
    refreshToken: { type: String },
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });
userSchema.index(
  { provider: 1, providerId: 1 },
  { unique: true, partialFilterExpression: { providerId: { $exists: true, $type: 'string' } } }
);

userSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $exists: true, $type: 'string' } } }
);


export default mongoose.model('User', userSchema);