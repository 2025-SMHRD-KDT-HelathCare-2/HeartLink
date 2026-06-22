// mongoose: MongoDB(데이터베이스)를 자바스크립트에서 쉽게 다루게 해주는 라이브러리
import mongoose from 'mongoose';
// mongoose 안에서 'Schema'(데이터 설계도) 기능만 꺼내서 사용
const { Schema } = mongoose;

// reportSchema: 'LLM 리포트(Report)' 데이터가 어떤 모양으로 저장될지 정의하는 설계도
//  - 리포트 요청 시점에 직전 리포트 이후 ~ 현재까지의 분석 결과(analysisResults)를
//    기간 단위(일/주/월)로 종합해 LLM이 텍스트 리포트를 생성하고, TTS(mp3)도 함께 저장
//  - 새 분석이 없으면 기존 최신 리포트를 그대로 반환(캐싱)
const reportSchema = new Schema(
  {
    // userId: 리포트 대상 사용자. User 컬렉션 참조. 필수
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    // reportType: 리포트 대상 구분. 'self'(본인용) / 'guardian'(보호자용). 필수
    //  - 본인과 보호자가 각각 요청하므로 타입으로 분리
    reportType: { type: String, enum: ['self', 'guardian'], required: true },

    // reportCategory: 리포트 성격. 'emergency_alert'(긴급 알림) / 'full_report'(종합 리포트). 필수
    reportCategory: {
      type: String,
      enum: ['emergency_alert', 'full_report'],
      required: true,
    },

    // reportPeriod: 리포트 집계 기간 단위. 'daily'(하루) / 'weekly'(이번 주) / 'monthly'(이번 달). 필수
    reportPeriod: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      required: true,
    },

    // ───────── 집계 기간(기간 종합의 기준) ─────────
    // periodStart: 집계 시작 시각(직전 리포트 이후 또는 기간 시작점). 필수
    periodStart: { type: Date, required: true },
    // periodEnd: 집계 종료 시각(요청 시점 또는 기간 종료점). 필수
    periodEnd: { type: Date, required: true },
    // lastAnalysisAt: 이 리포트에 포함된 분석 중 가장 최신 analyzedAt 시각(캐시 판단 키). 필수
    //  - 이 시각 이후 새 분석이 없으면 캐시 반환, 있으면 새 리포트 생성
    lastAnalysisAt: { type: Date, required: true },

    // ───────── 포함된 분석 결과 ─────────
    // analysisIds: 이번 리포트에 종합된 분석 결과(AnalysisResult) ID 목록. 최소 1개 이상 필수
    analysisIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'AnalysisResult' }],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'analysisIds는 최소 1개 이상이어야 합니다.',
      },
    },
    // analysisCount: 종합된 분석 결과 개수. 최소 1. 필수
    analysisCount: { type: Number, required: true, min: 1 },

    // ───────── 리포트 본문/산출물 ─────────
    // reportText: LLM이 생성한 리포트 본문(본인/보호자 통합, 타입으로 구분). 최대 10000자
    reportText: { type: String, maxlength: 10000 },
    // recommendedAction: 권장 조치 사항. 최대 2000자
    recommendedAction: { type: String, maxlength: 2000 },
    // ttsAudioUrl: TTS로 생성한 음성(mp3) 파일 경로(URL). 최대 1000자
    ttsAudioUrl: { type: String, maxlength: 1000 },
    // ※ pdf_url 제거됨: PDF는 프론트엔드에서 생성/다운로드 처리

    // chartData: 그래프용으로 미리 집계해 둔 데이터(캐시 응답 속도 향상)
    //  - 시간대별/요일별/주차별 심박수, 위험도 카운트, HRV 추이, 미측정일(gap) 등
    //  - 자유 구조(Mixed)이므로 기간 단위별로 필요한 형태로 저장
    chartData: { type: Schema.Types.Mixed },

    // maxRiskLevel: 집계 기간 내 최고 위험도. 'high' / 'mid' / 'low'. 필수
    //  - 위험도는 평균이 아닌 최악값(max) 기준으로 산정
    maxRiskLevel: { type: String, enum: ['high', 'mid', 'low'], required: true },

    // status: 리포트 생성 상태. 'generating'(생성 중) / 'completed'(완료) / 'failed'(실패)
    //  - 기본값 'generating', 필수
    status: {
      type: String,
      enum: ['generating', 'completed', 'failed'],
      default: 'generating',
      required: true,
    },
  },
  // timestamps: createdAt(생성시각)만 자동 생성, updatedAt은 사용 안 함
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

// ───────── 인덱스(빠른 검색을 위한 색인) 설정 ─────────
// 캐시 조회용: 같은 사용자+타입+기간단위의 최신 리포트를 빠르게 찾기
reportSchema.index({ userId: 1, reportType: 1, reportPeriod: 1, createdAt: -1 });

// 중복 생성 방지(캐시 키): 같은 사용자+타입+기간단위에서 동일한 lastAnalysisAt 리포트는 1개만
//  - 같은 분석 묶음으로 리포트가 두 번 만들어지는 것을 DB 차원에서 차단
reportSchema.index(
  { userId: 1, reportType: 1, reportPeriod: 1, lastAnalysisAt: 1 },
  { unique: true }
);

// 사용자별 최신 리포트 조회용(타입 무관)
reportSchema.index({ userId: 1, createdAt: -1 });

// 생성 상태 모니터링용(예: generating/failed 추적)
reportSchema.index({ status: 1 });

// 위 설계도(reportSchema)를 'Report'라는 이름의 모델로 만들어 외부에서 쓸 수 있게 내보냄
//  - 컬렉션(테이블) 이름은 자동으로 'reports'가 됨
export default mongoose.model('Report', reportSchema);
