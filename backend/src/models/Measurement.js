// mongoose 라이브러리 불러오기
import mongoose from 'mongoose';
// 설계도 도구 Schema 꺼내기
const { Schema } = mongoose;

// 사용자가 업로드한 ECG(심전도) '측정 데이터'를 저장하는 컬렉션 구조 정의
const measurementSchema = new Schema(
  {
    // userId: 이 측정을 한 사용자의 _id (User를 가리킴)
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // fileName: 업로드한 파일 이름. 필수, 최대 255자
    fileName: { type: String, required: true, maxlength: 255 },
    // fileExt: 파일 형식(확장자). WFDB/EDF/CSV 세 종류만 허용, 필수
    fileExt: { type: String, enum: ['WFDB', 'EDF', 'CSV'], required: true },
    // fileSize: 파일 크기(바이트 단위 숫자). 필수
    fileSize: { type: Number, required: true },
    // leadType: 어떤 유도(lead) 방식으로 측정했는지. 최대 20자(선택)
    leadType: { type: String, maxlength: 20 },
    // samplingRate: 1초에 몇 번 측정했는지(샘플링 속도, 숫자)
    samplingRate: { type: Number },
    // ecgWaveformLite: 화면 그래프용으로 가볍게 줄인 파형 데이터(숫자 배열). 기본 빈 배열
    ecgWaveformLite: { type: [Number], default: [] },
    // status: 분석 진행 상태. processing=처리중, completed=완료, failed=실패. 기본 '처리중'
    status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },
    // rPeaks: 심전도에서 검출한 R파(심장박동 정점)들의 위치(숫자 배열). 기본 빈 배열
    rPeaks: { type: [Number], default: [] },
    // measuredAt: 실제로 측정이 이루어진 시각. 필수
    measuredAt: { type: Date, required: true },
  },
  // createdAt만 자동 기록(언제 업로드됐는지), updatedAt은 사용 안 함
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

// "특정 사용자의 측정 기록을 최신순으로" 빠르게 찾기 위한 인덱스
// userId로 묶고 measuredAt 내림차순(-1: 최신 먼저)
measurementSchema.index({ userId: 1, measuredAt: -1 });

// 'Measurement' 모델로 내보내기
export default mongoose.model('Measurement', measurementSchema);
