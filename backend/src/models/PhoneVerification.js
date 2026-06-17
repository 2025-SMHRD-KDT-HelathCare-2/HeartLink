// mongoose 라이브러리 불러오기
import mongoose from 'mongoose';
// 설계도 도구 Schema 꺼내기
const { Schema } = mongoose;

// 휴대폰 인증번호를 '임시로' 저장하는 컬렉션의 구조 정의
const phoneVerificationSchema = new Schema(
  {
    // phone: 인증을 요청한 휴대폰 번호. 필수, 최대 20자
    phone: { type: String, required: true, maxlength: 20 },
    // code: 발송한 인증번호. 보안을 위해 원본이 아니라 '해시(암호화)'된 값으로 저장
    code: { type: String, required: true }, // 해시 저장
    // purpose: 인증 목적. 'signup'(회원가입) 또는 'find_pw'(비밀번호 찾기)
    purpose: { type: String, enum: ['signup', 'find_pw'], required: true },
    // verified: 이 번호가 인증을 통과했는지 여부. 기본값 false
    verified: { type: Boolean, default: false, required: true },
    // attemptCount: 인증번호를 틀린 횟수. 너무 많이 틀리면 막기 위해 카운트. 기본값 0
    attemptCount: { type: Number, default: 0, required: true },
    // expiresAt: 이 인증번호가 만료되는 시각(예: 발송 5분 뒤)
    expiresAt: { type: Date, required: true },
  },
  // createdAt(생성일시)만 자동 기록하고, updatedAt(수정일시)은 만들지 않음
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

// phone(번호) + createdAt(최신순)으로 검색할 때 빠르게 찾도록 인덱스 생성
// -1은 내림차순(최신 것이 먼저)을 의미
phoneVerificationSchema.index({ phone: 1, createdAt: -1 });

// TTL 인덱스: expiresAt 시각이 지나면 MongoDB가 이 문서를 '자동으로 삭제'함
// expireAfterSeconds: 0 → expiresAt에 적힌 시각이 되는 즉시 삭제
phoneVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// 'PhoneVerification' 모델로 내보내기
export default mongoose.model('PhoneVerification', phoneVerificationSchema);
