// mongoose: MongoDB를 JavaScript에서 다루기 위한 ODM 라이브러리
import mongoose from 'mongoose';
// mongoose에서 Schema(스키마 정의 기능)만 추출
const { Schema } = mongoose;

// userSchema: 회원(User) 문서 구조를 정의하는 스키마
const userSchema = new Schema(
  {
    // email: 이메일 주소
    //  - required: 필수 값
    //  - unique: 중복 불가
    //  - sparse: 값이 없는(null) 문서는 중복 검사에서 제외
    email: { type: String, required: true, unique: true, sparse: true },

    // password: 비밀번호 (소셜 가입자는 없으므로 선택 값)
    password: { type: String },

    // ───────── 소셜 로그인 관련 ─────────
    // provider: 가입 방식 (local=일반가입, 나머지는 소셜)
    provider: {
      type: String,
      // enum: 허용된 값만 사용 가능
      enum: ['local', 'google', 'naver', 'kakao'],
      default: 'local', // 미지정 시 local
      required: true,
    },
    // providerId: 소셜 서비스가 부여한 사용자 고유 ID
    providerId: { type: String },
    // profileImage: 프로필 이미지 URL
    profileImage: { type: String },

    // nickname: 화면 표시 이름 (필수, 최대 50자)
    nickname: { type: String, required: true, maxlength: 50 },
    // role: 사용자 역할 (user=측정 본인, guardian=보호자)
    role: { type: String, enum: ['user', 'guardian'], required: true },

    // ───────── 휴대폰 인증 관련 ─────────
    // phone: 휴대폰 번호 (최대 20자)
    phone: { type: String, maxlength: 20 },
    // phoneVerified: 휴대폰 인증 완료 여부 (기본값 false)
    phoneVerified: { type: Boolean, default: false, required: true },

    // age: 나이
    age: { type: Number },
    // gender: 성별 (M=남, F=여)
    gender: { type: String, enum: ['M', 'F'] },
    // medicalHistory: 병력 목록 (문자열 배열, 기본값 빈 배열)
    medicalHistory: { type: [String], default: [] },
    // deviceToken: FCM 푸시 알림 발송용 기기 토큰
    deviceToken: { type: String },
    // refreshToken: 로그인 유지를 위한 재발급용 토큰
    refreshToken: { type: String },
  },
  // timestamps: createdAt / updatedAt 자동 생성
  { timestamps: true }
);

// ───────── 인덱스(검색 성능을 위한 색인) ─────────
// role 기준 빠른 조회용 인덱스
userSchema.index({ role: 1 });

// provider + providerId 조합 유니크 (동일 소셜 계정 중복 가입 방지)
//  - partialFilterExpression: providerId가 문자열로 존재할 때만 적용
//    (일반 가입자는 providerId가 없으므로 검사 대상에서 제외)
userSchema.index(
  { provider: 1, providerId: 1 },
  { unique: true, partialFilterExpression: { providerId: { $exists: true, $type: 'string' } } }
);

// phone 유니크 (중복 번호 가입 방지)
//  - phone이 문자열로 존재할 때만 적용 (번호 없는 회원끼리는 충돌 없음)
userSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $exists: true, $type: 'string' } } }
);

// userSchema를 'User' 모델로 생성하여 내보냄 (실제 컬렉션명은 'users')
export default mongoose.model('User', userSchema);
