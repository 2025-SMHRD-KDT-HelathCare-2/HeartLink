// mongoose: MongoDB를 JavaScript에서 다루기 위한 ODM 라이브러리
import mongoose from 'mongoose';
// mongoose에서 Schema(스키마 정의 기능)만 추출
const { Schema } = mongoose;

// userSchema: 회원(User) 문서 구조를 정의하는 스키마
//  - 본인(측정자)과 보호자가 같은 컬렉션을 공유하며, role 값으로 구분합니다.
const userSchema = new Schema(
  {
    // email: 이메일 주소(로그인 아이디 역할)
    //  - required: 반드시 있어야 함
    //  - unique: 같은 이메일로 두 번 가입 불가
    //  - sparse: 값이 없는(null) 문서는 중복 검사에서 제외
    email: { type: String, required: true, unique: true, sparse: true },

    // password: 비밀번호(bcrypt 해시 저장). 소셜 가입자는 비번이 없으므로 선택 값
    password: { type: String },

    // ───────── 소셜 로그인 관련 ─────────
    // provider: 가입 방식 (local=일반가입, 나머지는 소셜 로그인)
    provider: {
      type: String,
      // enum: 아래 목록의 값만 허용
      enum: ['local', 'google', 'naver', 'kakao'],
      default: 'local', // 값을 안 주면 자동으로 local
      required: true,
    },
    // providerId: 소셜 서비스가 부여한 사용자 고유 ID (예: 카카오 회원번호)
    providerId: { type: String },
    // profileImage: 프로필 이미지 주소(URL)
    profileImage: { type: String },

    // nickname: 화면에 표시할 이름 (필수, 최대 50자)
    nickname: { type: String, required: true, maxlength: 50 },
    // role: 사용자 역할 (user=측정 본인, guardian=보호자)
    role: { type: String, enum: ['user', 'guardian'], required: true },

    // ───────── 휴대폰 인증 관련 ─────────
    // phone: 휴대폰 번호 (최대 20자)
    phone: { type: String, maxlength: 20 },
    // phoneVerified: 휴대폰 인증 완료 여부 (true=완료, 기본값 false)
    phoneVerified: { type: Boolean, default: false, required: true },

    // ───────── 건강/프로필 정보 ─────────
    // age: 나이
    age: { type: Number },
    // gender: 성별 (M=남, F=여)
    gender: { type: String, enum: ['M', 'F'] },
    // medicalHistory: 병력(과거 질환) 목록. 문자열 배열, 기본값 빈 배열
    medicalHistory: { type: [String], default: [] },

    // ───────── 토큰 관련 ─────────
    // deviceToken: FCM 푸시 알림 발송용 기기 토큰
    deviceToken: { type: String },
    // refreshToken: 로그인 유지를 위한 재발급용 토큰(서버 저장)
    refreshToken: { type: String },
  },
  // timestamps: createdAt(생성시각), updatedAt(수정시각)을 자동 생성
  { timestamps: true }
);

// ───────── 인덱스(빠른 검색을 위한 색인) ─────────
// role 기준 빠른 조회용 인덱스 (예: 보호자만 모아 조회)
userSchema.index({ role: 1 });

// provider + providerId 조합 유니크 (동일 소셜 계정 중복 가입 방지)
//  - partialFilterExpression: providerId가 문자열로 존재할 때만 적용
//    (일반 가입자는 providerId가 없으므로 검사 대상에서 제외)
userSchema.index(
  { provider: 1, providerId: 1 },
  { unique: true, partialFilterExpression: { providerId: { $exists: true, $type: 'string' } } }
);

// phone 유니크 (같은 휴대폰 번호로 중복 가입 방지)
//  - phone이 문자열로 존재할 때만 적용 (번호 없는 회원끼리는 충돌 없음)
userSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $exists: true, $type: 'string' } } }
);

// userSchema를 'User' 모델로 생성해 내보냄 (실제 컬렉션명은 'users')
export default mongoose.model('User', userSchema);
