// src/models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, maxlength: 100 }, // 이메일(로그인 ID)
    password: { type: String, required: true, maxlength: 255 },            // bcrypt 암호화 비밀번호
    nickname: { type: String, required: true, maxlength: 50 },             // 닉네임
    role: { type: String, required: true, enum: ["user", "guardian"] },    // 사용자 유형
    age: { type: Number },                                                 // 연령
    gender: { type: String, enum: ["M", "F"] },                            // 성별
    medical_history: { type: [String], default: [] },                      // 기저질환 목록
    medications: { type: [String], default: [] },                          // 복용약 목록
    device_token: { type: String, maxlength: 255 },                        // FCM 푸시 토큰
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, // 자동 생성/수정 일자
    collection: "users",
  }
);

userSchema.index({ role: 1 });

module.exports = mongoose.model("User", userSchema);
