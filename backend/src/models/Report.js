// mongoose: MongoDB를 자바스크립트에서 다루기 위한 라이브러리
import mongoose from 'mongoose';
// Schema(데이터 설계도) 기능만 꺼내서 사용
const { Schema } = mongoose;

// reportSchema: 분석 결과를 바탕으로 만든 'AI 설명 리포트'를 저장하는 설계도
const reportSchema = new Schema(
  {
    // analysisId: 어떤 분석 결과(AnalysisResult)에 대한 리포트인지 가리키는 ID. 필수
    analysisId: { type: Schema.Types.ObjectId, ref: 'AnalysisResult', required: true },
    // userId: 이 리포트의 주인(회원) ID. User 참조. 필수
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    // reportType: 리포트 대상. 'self'(본인용) 또는 'guardian'(보호자용). 필수
    reportType: { type: String, enum: ['self', 'guardian'], required: true },

    // reportCategory: 리포트 종류
    //  - emergency_alert(긴급 경고), full_report(전체 리포트) 중 하나. 필수
    reportCategory: {
      type: String,
      enum: ['emergency_alert', 'full_report'],
      required: true,
    },

    // reportTextUser: 사용자(본인)에게 보여줄 설명 글. 최대 5000글자
    reportTextUser: { type: String, maxlength: 5000 },
    // reportTextGuardian: 보호자에게 보여줄 설명 글. 최대 5000글자
    reportTextGuardian: { type: String, maxlength: 5000 },
    // recommendedAction: 권장 행동(예: 병원 방문 권유). 최대 1000글자
    recommendedAction: { type: String, maxlength: 1000 },

    // ttsAudioUrl: 리포트를 음성으로 읽어주는 오디오 파일 주소(URL). 최대 1000글자
    ttsAudioUrl: { type: String, maxlength: 1000 },
    // pdfUrl: 리포트를 PDF로 만든 파일 주소(URL). 최대 1000글자
    pdfUrl: { type: String, maxlength: 1000 },

    // riskLevel: 위험 등급. high/mid/low 중 하나. 필수
    riskLevel: { type: String, enum: ['high', 'mid', 'low'], required: true },
  },
  // createdAt만 자동 기록, updatedAt은 만들지 않음
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

// analysisId 인덱스: 특정 분석에 연결된 리포트를 빠르게 찾기 위함
reportSchema.index({ analysisId: 1 });
// userId + 생성시각(내림차순): "특정 사용자의 최신 리포트"를 빠르게 조회
reportSchema.index({ userId: 1, createdAt: -1 });

// 'Report' 모델로 내보냄 (컬렉션 이름은 자동으로 'reports')
export default mongoose.model('Report', reportSchema);
