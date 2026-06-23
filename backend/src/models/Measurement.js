// mongoose: MongoDB를 자바스크립트에서 다루기 위한 라이브러리
import mongoose from 'mongoose';

// Schema(데이터 설계도) 기능만 꺼내서 사용
const { Schema } = mongoose;

/**
 * measurementSchema
 * 심전도(ECG) 측정 데이터를 저장하기 위한 스키마
 */
const measurementSchema = new Schema(
  {
    // userId: 이 측정을 수행한 회원의 ID (User 참조, 필수)
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    // fileName: 업로드한 측정 파일의 이름 (필수, 최대 255글자)
    fileName: { type: String, required: true, maxlength: 255 },

    // fileExt: 파일 형식(확장자) - WFDB / EDF / CSV 중 하나만 허용 (필수)
    fileExt: { type: String, enum: ['WFDB', 'EDF', 'CSV'], required: true },

    // fileSize: 파일 크기 (바이트 단위, 필수)
    fileSize: { type: Number, required: true },

    // leadType: 심전도 리드(전극) 종류 (선택, 최대 20글자)
    leadType: { type: String, maxlength: 20 },

    // samplingRate: 샘플링 주파수 (1초당 측정 횟수, 선택)
    samplingRate: { type: Number },

    // ecgWaveformLite: 화면 표시용으로 경량화한 심전도 파형 데이터 (숫자 배열, 기본 빈 배열)
    ecgWaveformLite: { type: [Number], default: [] },

    // status: 분석 진행 상태 (processing: 분석중, completed: 완료, failed: 실패, 기본 processing)
    status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },

    // rPeaks: 검출된 R파(심박 정점)의 위치 목록 (숫자 배열, 기본 빈 배열)
    rPeaks: { type: [Number], default: [] },

    // measuredAt: 실제 측정이 이뤄진 시각 (필수)
    measuredAt: { type: Date, required: true },
  },
  // createdAt(생성시각)만 자동 기록하고 updatedAt은 생성하지 않음
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

// userId + measuredAt(내림차순) 복합 인덱스: "특정 사용자의 최신 측정"을 빠르게 조회하기 위함
measurementSchema.index({ userId: 1, measuredAt: -1 });

// 'Measurement' 모델로 내보냄 (컬렉션 이름은 자동으로 'measurements')
export default mongoose.model('Measurement', measurementSchema);
