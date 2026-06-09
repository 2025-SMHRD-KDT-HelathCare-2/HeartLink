// src/models/Notification.js
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    analysis_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AnalysisResult",
      required: true,
    }, // 분석 결과 참조
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },     // 본인 사용자 참조
    guardian_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // 보호자 사용자 참조
    risk_level: { type: String, required: true, enum: ["high", "mid", "low"] },         // 위험도 단계
    channel: { type: String, required: true, enum: ["push", "sms"] },                   // 발송 채널
    message: { type: String, required: true, maxlength: 1000 },                         // 알림 메시지
    send_status: { type: String, required: true, enum: ["success", "fail"] },           // 발송 상태
    is_read: { type: Boolean, default: false },                                         // 확인 여부
    sent_at: { type: Date, required: true },                                            // 발송 시각
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
    collection: "notifications",
  }
);

notificationSchema.index({ guardian_id: 1, sent_at: -1 });
notificationSchema.index({ analysis_id: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
