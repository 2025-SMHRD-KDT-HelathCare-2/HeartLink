// mongoose: MongoDB를 자바스크립트에서 다루기 위한 라이브러리
import mongoose from 'mongoose';
const { Schema } = mongoose;

// reportSchema: "직전 리포트 이후 ~ 현재"까지의 분석 결과들을 종합한 리포트
const reportSchema = new Schema(
  {
    // userId: 리포트 대상 본인(회원) ID. User 참조. 필수
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    // reportType: 리포트 대상. self(본인용)/guardian(보호자용). 누적 기준이 됨. 필수
    reportType: { type: String, enum: ['self', 'guardian'], required: true },

    // reportCategory: 리포트 종류. emergency_alert/full_report. 필수
    reportCategory: {
      type: String,
      enum: ['emergency_alert', 'full_report'],
      required: true,
    },

    // ───────── 집계 기간 ─────────
    // periodStart: 집계 시작 시각(직전 리포트 생성 이후, 최초이면 첫 분석 시각). 필수
    periodStart: { type: Date, required: true },
    // periodEnd: 집계 종료 시각(리포트 생성 요청 시점). 필수
    periodEnd: { type: Date, required: true },

    // analysisIds: 이번 리포트에 종합된 분석 결과(AnalysisResult) ID 목록. 최소 1건. 필수
    analysisIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'AnalysisResult' }],
      required: true,
      validate: { validator: (v) => Array.isArray(v) && v.length > 0, message: '최소 1건의 분석 결과가 필요합니다.' },
    },
    // analysisCount: 종합된 분석 결과 건수. 필수
    analysisCount: { type: Number, required: true, min: 1 },

    // ───────── 생성 콘텐츠 ─────────
    // reportText: LLM이 생성한 종합 리포트 본문. 최대 10000글자
    reportText: { type: String, maxlength: 10000 },
    // recommendedAction: 권장 조치. 최대 2000글자
    recommendedAction: { type: String, maxlength: 2000 },

    // ttsAudioUrl: TTS로 생성한 음성(mp3) 파일 경로. 최대 1000글자
    ttsAudioUrl: { type: String, maxlength: 1000 },
    // pdfUrl: PDF 파일 경로. 최대 1000글자
    pdfUrl: { type: String, maxlength: 1000 },

    // maxRiskLevel: 집계 기간 내 최고 위험도. high/mid/low. 필수
    maxRiskLevel: { type: String, enum: ['high', 'mid', 'low'], required: true },

    // status: 리포트 생성 상태. generating(생성중)/completed(완료)/failed(실패). 필수
    status: {
      type: String,
      enum: ['generating', 'completed', 'failed'],
      default: 'generating',
      required: true,
    },
  },
  // createdAt만 자동 기록, updatedAt은 만들지 않음
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

// "직전 리포트"를 빠르게 찾기 위한 인덱스(periodStart 계산용)
reportSchema.index({ userId: 1, reportType: 1, createdAt: -1 });
// 사용자별 최신 리포트 조회
reportSchema.index({ userId: 1, createdAt: -1 });
// 생성 상태별 조회(예: 실패/진행중 모니터링)
reportSchema.index({ status: 1 });

export default mongoose.model('Report', reportSchema);
