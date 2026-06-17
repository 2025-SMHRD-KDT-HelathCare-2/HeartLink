// mongoose 라이브러리 불러오기
import mongoose from 'mongoose';
// 설계도 도구 Schema 꺼내기
const { Schema } = mongoose;

// 분석 결과를 바탕으로 생성된 '리포트(보고서)'를 저장하는 컬렉션 구조 정의
const reportSchema = new Schema(
  {
    // analysisId: 어떤 분석 결과(AnalysisResult)로 만든 리포트인지 가리킴. 필수
    analysisId: { type: Schema.Types.ObjectId, ref: 'AnalysisResult', required: true },
    // userId: 리포트의 대상 사용자 _id. 필수
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // reportType: 누구를 위한 리포트인지. self=본인용, guardian=보호자용. 필수
    reportType: { type: String, enum: ['self', 'guardian'], required: true },
    // reportCategory: 리포트 종류
    reportCategory: {
      type: String,
      // emergency_alert=긴급 경고, full_report=상세 리포트
      enum: ['emergency_alert', 'full_report'],
      required: true,
    },
    // reportTextUser: 사용자(본인)에게 보여줄 리포트 본문. 최대 5000자
    reportTextUser: { type: String, maxlength: 5000 },
    // reportTextGuardian: 보호자에게 보여줄 리포트 본문. 최대 5000자
    reportTextGuardian: { type: String, maxlength: 5000 },
    // recommendedAction: 권장 조치 사항(예: 병원 방문 권유). 최대 1000자
    recommendedAction: { type: String, maxlength: 1000 },
    // ttsAudioUrl: 리포트를 음성으로 읽어주는 TTS 오디오 파일 주소. 최대 1000자
    ttsAudioUrl: { type: String, maxlength: 1000 },
    // pdfUrl: 리포트를 PDF로 만든 파일의 주소. 최대 1000자
    pdfUrl: { type: String, maxlength: 1000 },
    // riskLevel: 이 리포트의 위험 등급. high/mid/low. 필수
    riskLevel: { type: String, enum: ['high', 'mid', 'low'], required: true },
  },
  // createdAt만 자동 기록, updatedAt은 사용 안 함
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

// analysisId로 리포트를 빠르게 찾기 위한 인덱스
reportSchema.index({ analysisId: 1 });
// "특정 사용자의 리포트를 최신순으로" 빠르게 찾기 위한 인덱스
reportSchema.index({ userId: 1, createdAt: -1 });

// 'Report' 모델로 내보내기
export default mongoose.model('Report', reportSchema);
