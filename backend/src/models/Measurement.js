// src/models/Measurement.js
const mongoose = require("mongoose");

const measurementSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // 사용자 참조
    file_name: { type: String, required: true, maxlength: 255 },                    // 원본 파일명
    file_ext: { type: String, required: true, enum: ["WFDB", "EDF", "CSV"] },       // 파일 확장자
    file_size: { type: Number, required: true },                                    // 파일 크기(byte)
    lead_type: { type: String, maxlength: 10 },                                     // 리드 종류
    sampling_rate: { type: Number },                                                // 샘플링 레이트(Hz)
    ecg_waveform_lite: { type: [Number], default: [] },                             // 시각화용 경량 파형(원본 아님)
    r_peaks: { type: [Number], default: [] },                                       // R-peak 좌표(마커용)
    measured_at: { type: Date, required: true },                                    // 측정 시각
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false }, // created_at만 사용
    collection: "measurements",
  }
);

measurementSchema.index({ user_id: 1, measured_at: -1 });

module.exports = mongoose.model("Measurement", measurementSchema);
