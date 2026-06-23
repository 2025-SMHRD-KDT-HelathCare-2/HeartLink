// mongoose: MongoDB를 JavaScript에서 다루기 위한 라이브러리
import mongoose from 'mongoose';
// Schema(데이터 설계도) 기능만 꺼내서 사용
const { Schema } = mongoose;

// passwordResetCodeSchema: '비밀번호 재설정 인증번호' 임시 저장용 스키마
//  - 비밀번호를 잊었을 때 이메일로 보낸 인증번호를 잠깐 저장했다가 검증 후 자동 삭제
const passwordResetCodeSchema = new Schema(
  {
    // email: 비밀번호 재설정을 요청한 이메일 주소 (필수)
    email: { type: String, required: true },

    // code: 인증번호. 원본이 아니라 bcrypt 해시로 암호화해서 저장 (보안)
    code: { type: String, required: true }, // bcrypt 해시

    // verified: 이 인증번호가 검증에 성공했는지 여부 (기본 false, 필수)
    verified: { type: Boolean, default: false, required: true },

    // attemptCount: 인증번호 입력 시도 횟수 (너무 많이 틀리면 차단용, 기본 0, 필수)
    attemptCount: { type: Number, default: 0, required: true },

    // expiresAt: 이 인증번호가 만료되는 시각 (유효시간, 필수)
    expiresAt: { type: Date, required: true },
  },
  // createdAt(생성시각)만 자동 기록, updatedAt(수정시각)은 생성하지 않음
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

// email + createdAt(내림차순) 복합 인덱스: 특정 이메일의 '최근 요청'을 빠르게 조회
passwordResetCodeSchema.index({ email: 1, createdAt: -1 });

// TTL 인덱스: expiresAt 시각이 지나면 MongoDB가 해당 문서를 자동 삭제
//  - expireAfterSeconds: 0 → expiresAt에 적힌 시간이 되는 즉시 삭제
passwordResetCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// PasswordResetCode 모델로 내보냄 (컬렉션 이름은 자동으로 'passwordresetcodes')
export default mongoose.model('PasswordResetCode', passwordResetCodeSchema);
