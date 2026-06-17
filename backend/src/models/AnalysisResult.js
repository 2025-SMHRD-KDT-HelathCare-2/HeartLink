// mongoose 라이브러리 불러오기
import mongoose from 'mongoose';
// 설계도 도구 Schema 꺼내기
const { Schema } = mongoose;

// AI가 측정 데이터를 분석한 '결과'를 저장하는 컬렉션 구조 정의
const analysisResultSchema = new Schema(
  {
    // measurementId: 어떤 측정(Measurement)을 분석한 결과인지 가리킴. 필수
    measurementId: { type: Schema.Types.ObjectId, ref: 'Measurement', required: true },
    // userId: 그 측정의 주인(사용자) _id. 필수
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    // arrhythmiaClass: 부정맥 분류 결과 (N=정상, SVEB/VEB/F/Q=각종 이상 박동 유형)
    arrhythmiaClass: { type: String, enum: ['N', 'SVEB', 'VEB', 'F', 'Q'] },
    // arrhythmiaProb: 부정맥일 확률(0~1 사이 숫자)
    arrhythmiaProb: { type: Number },
    // afDetected: 심방세동(AF)이 감지됐는지 여부(true/false)
    afDetected: { type: Boolean },
    // afProb: 심방세동일 확률(숫자)
    afProb: { type: Number },

    // hrvRmssd: 심박변이도(HRV) 지표 중 RMSSD 값
    hrvRmssd: { type: Number },
    // hrvSdnn: HRV 지표 중 SDNN 값
    hrvSdnn: { type: Number },
    // hrvLfhf: HRV 지표 중 저주파/고주파 비율(LF/HF) 값
    hrvLfhf: { type: Number },

    // heart_rate: 심박수(snake_case 표기, 다른 곳과 호환용으로 존재)
    heart_rate: { type: Number },
    // arrhythmia_count: 부정맥이 검출된 횟수
    arrhythmia_count: { type: Number },

    // anomalyDetected: 이상 징후가 감지됐는지 여부(true/false)
    anomalyDetected: { type: Boolean },
    // riskScore: 종합 위험도 점수. 필수, 0~100 범위만 허용
    riskScore: { type: Number, required: true, min: 0, max: 100 },
    // riskLevel: 위험 등급. high=높음, mid=중간, low=낮음. 필수
    riskLevel: { type: String, enum: ['high', 'mid', 'low'], required: true },
    // heartRate: 심박수(camelCase 표기)
    heartRate: { type: Number },
    // analyzedAt: 분석이 완료된 시각. 필수
    analyzedAt: { type: Date, required: true },
  },
  // createdAt만 자동 기록, updatedAt은 사용 안 함
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

// 하나의 측정당 분석 결과는 1개만 → measurementId를 중복 불가(unique)로 인덱스 설정
analysisResultSchema.index({ measurementId: 1 }, { unique: true });
// "특정 사용자의 분석 결과를 최신순으로" 빠르게 찾기 위한 인덱스
analysisResultSchema.index({ userId: 1, analyzedAt: -1 });
// 위험 등급(riskLevel)별로 검색할 때 빠르게 찾기 위한 인덱스
analysisResultSchema.index({ riskLevel: 1 });

// 'AnalysisResult' 모델로 내보내기
export default mongoose.model('AnalysisResult', analysisResultSchema);
