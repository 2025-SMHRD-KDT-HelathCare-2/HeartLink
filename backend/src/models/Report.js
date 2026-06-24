// mongoose: MongoDB를 JavaScript에서 다루기 위한 ODM 라이브러리
import mongoose from 'mongoose';
// Schema(데이터 설계도) 기능만 꺼내서 사용
const { Schema } = mongoose;

// reportSchema: 'LLM 리포트(Report)' 데이터를 저장하는 스키마
//  - 리포트는 '고정 기간 단위(일일/주간)'로 분석 결과(analysisResults)를 종합해 생성합니다.
//      · daily(일일) : 요청 시점에 '당일' 측정 데이터를 모두 종합해 생성
//      · weekly(주간): 스케줄러로 미리 생성해 두고, 요청 시 불러오기(조회)
//  - 같은 기간에 새 분석이 없으면 기존 리포트를 그대로 반환(캐싱)합니다.
//    (캐시 판단 키 = lastAnalysisAt)
const reportSchema = new Schema(
  {
    // userId: 리포트 대상 사용자. User 참조. 필수
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    // reportType: 리포트 대상 구분. self(본인용) / guardian(보호자용). 필수
    reportType: { type: String, enum: ['self', 'guardian'], required: true },

    // reportCategory: 리포트 성격. emergencyAlert(긴급 알림) / fullReport(종합 리포트). 필수
    reportCategory: {
      type: String,
      enum: ['emergencyAlert', 'fullReport'],
      required: true,
    },

    // reportPeriod: 리포트 집계 기간 단위. daily(하루) / weekly(이번 주). 필수
    //  - 월간(monthly)은 사용하지 않습니다.
    reportPeriod: {
      type: String,
      enum: ['daily', 'weekly'],
      required: true,
    },

    // ───────── 집계 기간(기간 종합의 기준) ─────────
    // periodStart: 집계 시작 시각(기간 시작점). 필수
    periodStart: { type: Date, required: true },
    // periodEnd: 집계 종료 시각(기간 종료점 또는 요청 시점). 필수
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
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: 'analysisIds는 최소 1개 이상이어야 합니다.',
      },
    },
    // analysisCount: 종합된 분석 결과 개수. 최소 1. 필수
    analysisCount: { type: Number, required: true, min: 1 },

    // ───────── 리포트 본문/산출물 ─────────
    // reportText: LLM이 생성한 리포트 본문. 최대 10000자
    reportText: { type: String, maxlength: 10000 },
    // recommendedAction: 권장 조치 사항. 최대 2000자
    recommendedAction: { type: String, maxlength: 2000 },
    // ttsAudioUrl: TTS로 생성한 음성(mp3) 파일 경로(URL). 최대 1000자
    ttsAudioUrl: { type: String, maxlength: 1000 },
    // ※ pdfUrl 없음: PDF는 프론트엔드에서 생성/다운로드 처리

    // chartData: 그래프용으로 미리 집계해 둔 데이터(캐시 응답 속도 향상)
    //  - 시간대별/요일별 심박수, 위험도 카운트, HRV 추이, 미측정일(gap) 등
    //  - 자유 구조(Mixed)이므로 기간 단위별로 필요한 형태로 저장
    chartData: { type: Schema.Types.Mixed },

    // maxRiskLevel: 집계 기간 내 최고 위험도. high / mid / low. 필수
    //  - 위험도는 평균이 아닌 '최악값(max)' 기준으로 산정
    maxRiskLevel: { type: String, enum: ['high', 'mid', 'low'], required: true },

    // status: 리포트 생성 상태. generating(생성중) / completed(완료) / failed(실패)
    //  - 기본값 generating, 필수
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

// ───────── 인덱스(빠른 검색을 위한 색인) ─────────
// 캐시 조회용: 같은 사용자+타입+기간단위의 최신 리포트를 빠르게 찾기
reportSchema.index({ userId: 1, reportType: 1, reportPeriod: 1, createdAt: -1 });

// 중복 생성 방지(캐시 키): 같은 사용자+타입+기간단위에서 동일한 lastAnalysisAt 리포트는 1개만
//  - partialFilterExpression: reportPeriod가 문자열이고 lastAnalysisAt이 날짜일 때만 적용
//    (구버전 null 데이터로 인한 중복 키 오류(E11000)를 예방)
reportSchema.index(
  { userId: 1, reportType: 1, reportPeriod: 1, lastAnalysisAt: 1 },
  {
    unique: true,
    partialFilterExpression: {
      reportPeriod: { $exists: true, $type: 'string' },
      lastAnalysisAt: { $exists: true, $type: 'date' },
    },
  }
);

// 사용자별 최신 리포트 조회용(타입 무관)
reportSchema.index({ userId: 1, createdAt: -1 });

// 생성 상태 모니터링용(예: generating/failed 추적)
reportSchema.index({ status: 1 });

// reportSchema를 'Report' 모델로 생성해 내보냄 (실제 컬렉션명은 'reports')
export default mongoose.model('Report', reportSchema);
