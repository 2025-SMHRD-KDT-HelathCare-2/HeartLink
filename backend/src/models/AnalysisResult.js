// mongoose: MongoDB를 자바스크립트에서 다루기 위한 라이브러리
import mongoose from 'mongoose';
// Schema(데이터 설계도) 기능만 꺼내서 사용
const { Schema } = mongoose;

// analysisResultSchema: 측정 데이터에 대한 'AI 분석 결과'를 저장하는 설계도
const analysisResultSchema = new Schema(
  {
    // measurementId: 어떤 측정(Measurement)에 대한 분석인지 가리키는 ID. 필수
    measurementId: { type: Schema.Types.ObjectId, ref: 'Measurement', required: true },
    // userId: 이 분석 결과의 주인(회원) ID. User 참조. 필수
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    // ───────── 부정맥(불규칙한 심장박동) 분석 ─────────
    // arrhythmiaClass: 부정맥 분류 결과
    //  - N(정상), SVEB/VEB(이소성 박동), F(융합 박동), Q(미분류) 중 하나
    arrhythmiaClass: { type: String, enum: ['N', 'SVEB', 'VEB', 'F', 'Q'] },
    // arrhythmiaProb: 부정맥일 확률(0~1 사이 숫자)
    arrhythmiaProb: { type: Number },
    // afDetected: 심방세동(AF)이 감지됐는지 여부(true/false)
    afDetected: { type: Boolean },
    // afProb: 심방세동일 확률
    afProb: { type: Number },

    // ───────── HRV(심박변이도) 지표들 ─────────
    // hrvRmssd: 연속된 심박 간격 차이의 변동성 지표
    hrvRmssd: { type: Number },
    // hrvSdnn: 전체 심박 간격의 표준편차 지표
    hrvSdnn: { type: Number },
    // hrvLfhf: 저주파/고주파 비율(자율신경 균형 지표)
    hrvLfhf: { type: Number },

    // heart_rate: 심박수 (예전 필드명 형태)
    heart_rate: { type: Number },
    // arrhythmia_count: 부정맥 발생 횟수
    arrhythmia_count: { type: Number },

    // anomalyDetected: 이상 징후가 감지됐는지 여부(true/false)
    anomalyDetected: { type: Boolean },

    // riskScore: 위험도 점수. 0~100 사이만 허용. 필수
    riskScore: { type: Number, required: true, min: 0, max: 100 },
    // riskLevel: 위험 등급. high(높음)/mid(보통)/low(낮음) 중 하나. 필수
    riskLevel: { type: String, enum: ['high', 'mid', 'low'], required: true },
    // heartRate: 심박수 (카멜케이스 형태)
    heartRate: { type: Number },
    // analyzedAt: 분석이 수행된 시각. 필수
    analyzedAt: { type: Date, required: true },
  },
  // createdAt만 자동 기록, updatedAt은 만들지 않음
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

// measurementId 인덱스 + unique: 한 측정에는 분석 결과가 단 하나만 존재(1:1 관계)
analysisResultSchema.index({ measurementId: 1 }, { unique: true });
// userId + 분석시각(내림차순): "특정 사용자의 최신 분석"을 빠르게 조회
analysisResultSchema.index({ userId: 1, analyzedAt: -1 });
// riskLevel 인덱스: 위험 등급별로 빠르게 찾기 위함
analysisResultSchema.index({ riskLevel: 1 });

// 'AnalysisResult' 모델로 내보냄 (컬렉션 이름은 자동으로 'analysisresults')
export default mongoose.model('AnalysisResult', analysisResultSchema);
