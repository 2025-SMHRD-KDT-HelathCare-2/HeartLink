// src/models/AnalysisResult.js
const mongoose = require("mongoose");

const analysisResultSchema = new mongoose.Schema(
  {
    measurement_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Measurement",
      required: true,
      unique: true, // measurement와 1:1
    },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // 사용자 참조
    arrhythmia_class: { type: String, enum: ["N", "SVEB", "VEB", "F", "Q"] },       // 부정맥 분류
    arrhythmia_prob: { type: Number },                                              // 부정맥 분류 확률
    af_detected: { type: Boolean },                                                 // 심방세동 의심 여부
    af_prob: { type: Number },                                                      // AF 확률
    hrv_rmssd: { type: Number },                                                    // HRV-RMSSD
    hrv_sdnn: { type: Number },                                                     // HRV-SDNN
    hrv_lfhf: { type: Number },                                                     // HRV-LF/HF
    anomaly_detected: { type: Boolean },                                            // 이상 탐지 여부
    risk_score: { type: Number, required: true, min: 0, max: 100 },                 // 위험도 점수(0~100)
    risk_level: { type: String, required: true, enum: ["high", "mid", "low"] },     // 위험도 단계
    analyzed_at: { type: Date, required: true },                                    // 분석 시각
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
    collection: "analysis_results",
  }
);

analysisResultSchema.index({ user_id: 1, analyzed_at: -1 });
analysisResultSchema.index({ risk_level: 1 });

module.exports = mongoose.model("AnalysisResult", analysisResultSchema);
