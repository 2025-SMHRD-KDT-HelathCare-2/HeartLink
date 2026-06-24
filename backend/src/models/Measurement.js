// mongoose: MongoDB를 JavaScript에서 다루기 위한 ODM 라이브러리
import mongoose from 'mongoose';
// Schema(데이터 설계도) 기능만 꺼내서 사용
const { Schema } = mongoose;

// measurementSchema: 심전도(ECG) 측정 데이터를 저장하는 스키마
//  - 업로드 파일은 CSV(단일 리드)만 지원합니다.
//  - 원본 ECG 신호는 저장하지 않고, 화면 표시용 경량 파형만 보관합니다.
const measurementSchema = new Schema(
  {
    // userId: 이 측정을 수행한 회원의 ID. User 참조. 필수
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    // fileName: 업로드한 측정 파일의 이름 (필수, 최대 255자)
    fileName: { type: String, required: true, maxlength: 255 },

    // fileExt: 파일 형식(확장자). CSV만 허용 (단일 리드 ECG, 필수)
    fileExt: { type: String, enum: ['CSV'], required: true },

    // fileSize: 파일 크기 (바이트 단위, 필수)
    fileSize: { type: Number, required: true },

    // leadType: 심전도 리드(전극) 종류. 선택, 최대 20자
    leadType: { type: String, maxlength: 20 },

    // samplingRate: 샘플링 주파수 (1초당 측정 횟수). 선택
    samplingRate: { type: Number },

    // ecgWaveformLite: 화면 표시용으로 경량화한 심전도 파형 데이터 (숫자 배열, 기본 빈 배열)
    //  - AI 서버가 원본 CSV를 파싱·전처리해 생성한 결과를 저장합니다.
    ecgWaveformLite: { type: [Number], default: [] },

    // status: 분석 진행 상태
    //  - processing(분석중) / completed(완료) / failed(실패), 기본 processing
    status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },

    // rPeaks: 검출된 R파(심박 정점)의 위치(샘플 인덱스) 목록 (숫자 배열, 기본 빈 배열)
    rPeaks: { type: [Number], default: [] },

    // measuredAt: 실제 측정이 이뤄진 시각 (필수)
    measuredAt: { type: Date, required: true },
  },
  // createdAt(생성시각)만 자동 기록, updatedAt(수정시각)은 생성하지 않음
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

// userId + measuredAt(내림차순) 복합 인덱스: "특정 사용자의 최신 측정"을 빠르게 조회
measurementSchema.index({ userId: 1, measuredAt: -1 });

// measurementSchema를 'Measurement' 모델로 생성해 내보냄 (실제 컬렉션명은 'measurements')
export default mongoose.model('Measurement', measurementSchema);
