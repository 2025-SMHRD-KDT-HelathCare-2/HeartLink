// src/models/Report.js
const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    analysis_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AnalysisResult",
      required: true,
    }, // 분석 결과 참조
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // 사용자 참조
    report_type: { type: String, required: true, enum: ["self", "guardian"] },      // 리포트 유형
    report_category: {
      type: String,
      required: true,
      enum: ["emergency_alert", "full_report"],
    }, // 긴급알림/정식리포트 구분
    report_text_user: { type: String, maxlength: 5000 },     // 본인용 안내문
    report_text_guardian: { type: String, maxlength: 5000 }, // 보호자용 리포트
    recommended_action: { type: String, maxlength: 1000 },   // 권장 조치
    tts_audio_url: { type: String, maxlength: 1000 },        // 본인용 음성(mp3) 경로
    pdf_url: { type: String, maxlength: 1000 },              // PDF 다운로드 경로
    risk_level: { type: String, required: true, enum: ["high", "mid", "low"] }, // 위험도 단계
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
    collection: "reports",
  }
);

reportSchema.index({ analysis_id: 1 });
reportSchema.index({ user_id: 1, created_at: -1 });

module.exports = mongoose.model("Report", reportSchema);
