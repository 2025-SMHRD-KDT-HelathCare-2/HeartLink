// backend/seed.js
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]); // 구글 DNS 사용
const mongoose = require("mongoose");

// 6개 모델 불러오기
const User = require("./src/models/User");
const GuardianRelation = require("./src/models/GuardianRelation");
const Measurement = require("./src/models/Measurement");
const AnalysisResult = require("./src/models/AnalysisResult");
const Report = require("./src/models/Report");
const Notification = require("./src/models/Notification");

async function seed() {
  try {
    // 1) DB 연결
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Atlas 연결 성공");

    // 2) 사용자(본인) 1명 생성
    const user = await User.create({
      email: "user@heartlink.com",
      password: "test1234",
      nickname: "홍길동",
      role: "user",
      age: 72,
      gender: "M",
      medical_history: ["고혈압"],
      medications: ["아스피린"],
    });
    console.log("👤 user 생성 완료");

    // 3) 보호자 1명 생성
    const guardian = await User.create({
      email: "guardian@heartlink.com",
      password: "test1234",
      nickname: "홍보호",
      role: "guardian",
    });
    console.log("👤 guardian 생성 완료");

    // 4) 보호자 관계 생성
    await GuardianRelation.create({
      user_id: user._id,
      guardian_id: guardian._id,
      guardian_name: "홍보호",
      guardian_contact: "010-1234-5678",
      guardian_email: "guardian@heartlink.com",
      notify_permission: true,
      relation_status: "accepted",
    });
    console.log("🔗 guardian_relations 생성 완료");

    // 5) 측정 데이터 생성
    const measurement = await Measurement.create({
      user_id: user._id,
      file_name: "ecg_sample.csv",
      file_ext: "CSV",
      file_size: 102400,
      lead_type: "single",
      sampling_rate: 250,
      ecg_waveform_lite: [0.1, 0.2, 0.15, 0.3],
      r_peaks: [12, 45, 78],
      measured_at: new Date(),
    });
    console.log("📈 measurements 생성 완료");

    // 6) 분석 결과 생성
    const analysis = await AnalysisResult.create({
      measurement_id: measurement._id,
      user_id: user._id,
      arrhythmia_class: "N",
      arrhythmia_prob: 0.92,
      af_detected: false,
      af_prob: 0.05,
      hrv_rmssd: 35.2,
      hrv_sdnn: 50.1,
      hrv_lfhf: 1.4,
      anomaly_detected: false,
      risk_score: 20,
      risk_level: "low",
      analyzed_at: new Date(),
    });
    console.log("🩺 analysis_results 생성 완료");

    // 7) 리포트 생성
    await Report.create({
      analysis_id: analysis._id,
      user_id: user._id,
      report_type: "self",
      report_category: "full_report",
      report_text_user: "심장 리듬이 안정적입니다.",
      report_text_guardian: "특이사항 없습니다.",
      recommended_action: "충분한 휴식을 취하세요.",
      risk_level: "low",
    });
    console.log("📄 reports 생성 완료");

    // 8) 알림 생성
    await Notification.create({
      analysis_id: analysis._id,
      user_id: user._id,
      guardian_id: guardian._id,
      risk_level: "low",
      channel: "push",
      message: "주간 요약 알림입니다.",
      send_status: "success",
      is_read: false,
      sent_at: new Date(),
    });
    console.log("🔔 notifications 생성 완료");

    console.log("\n🎉 6개 컬렉션 모두 생성 완료!");
  } catch (err) {
    console.error("❌ 오류 발생:", err.message);
  } finally {
    // 9) 연결 종료
    await mongoose.disconnect();
    console.log("🔌 연결 종료");
  }
}

seed();
