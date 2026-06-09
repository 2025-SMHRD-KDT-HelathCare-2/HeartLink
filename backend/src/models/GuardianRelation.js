// src/models/GuardianRelation.js
const mongoose = require("mongoose");

const guardianRelationSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },     // 본인 사용자 참조
    guardian_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // 보호자 사용자 참조
    guardian_name: { type: String, required: true, maxlength: 50 },                     // 보호자 이름
    guardian_contact: { type: String, required: true, maxlength: 20 },                  // 보호자 연락처
    guardian_email: { type: String, maxlength: 100 },                                   // 보호자 이메일
    notify_permission: { type: Boolean, required: true, default: false },               // 알림 수신 권한
    relation_status: {
      type: String,
      required: true,
      enum: ["pending", "accepted"],
      default: "pending",
    }, // 관계 상태
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "guardian_relations",
  }
);

guardianRelationSchema.index({ user_id: 1 });
guardianRelationSchema.index({ guardian_id: 1 });

module.exports = mongoose.model("GuardianRelation", guardianRelationSchema);
