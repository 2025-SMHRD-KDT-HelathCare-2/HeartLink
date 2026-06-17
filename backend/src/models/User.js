// mongoose: MongoDB(데이터베이스)를 자바스크립트에서 쉽게 다루게 해주는 라이브러리
import mongoose from 'mongoose';
// mongoose 안에서 'Schema'(데이터 설계도) 기능만 꺼내서 사용
const { Schema } = mongoose;

// userSchema: '회원(User)' 데이터가 어떤 모양으로 저장될지 정의하는 설계도
const userSchema = new Schema(
  {
    // email: 이메일 주소 (문자열)
    //  - required: 반드시 있어야 함
    //  - unique: 중복 불가 (같은 이메일로 두 명 가입 불가)
    //  - sparse: 값이 없는(null) 문서끼리는 중복 검사에서 제외
    email: { type: String, required: true, unique: true, sparse: true },

    // password: 비밀번호 (문자열). 소셜 로그인 가입자는 비번이 없으므로 필수가 아님
    password: { type: String }, // 소셜 가입자는 없음

    // ───────── 소셜 로그인 관련 ─────────
    // provider: 어떤 방식으로 가입했는지 표시
    provider: {
      type: String,
      // enum: 이 목록에 있는 값만 허용 (local=일반가입, 나머지는 소셜)
      enum: ['local', 'google', 'naver', 'kakao'],
      default: 'local', // 값을 안 주면 자동으로 'local'
      required: true,    // 반드시 있어야 함
    },
    // providerId: 소셜 서비스가 부여한 그 사용자의 고유 ID (예: 카카오 회원번호)
    providerId: { type: String },
    // profileImage: 프로필 사진 주소(URL)
    profileImage: { type: String },

    // nickname: 화면에 표시할 이름. 필수이며 최대 50글자
    nickname: { type: String, required: true, maxlength: 50 },
    // role: 역할. 'user'(측정 본인) 또는 'guardian'(보호자) 중 하나, 필수
    role: { type: String, enum: ['user', 'guardian'], required: true },

    // ───────── 휴대폰 인증 관련 ─────────
    // phone: 휴대폰 번호 (최대 20글자)
    phone: { type: String, maxlength: 20 },
    // phoneVerified: 휴대폰 인증을 완료했는지 여부 (true=완료). 기본값 false, 필수
    phoneVerified: { type: Boolean, default: false, required: true },

    // age: 나이 (숫자)
    age: { type: Number },
    // gender: 성별. 'M'(남) 또는 'F'(여)만 허용
    gender: { type: String, enum: ['M', 'F'] },
    // medicalHistory: 병력(과거 질환) 목록. 문자열 여러 개를 담는 배열. 기본값은 빈 배열
    medicalHistory: { type: [String], default: [] },
    // refreshToken: 로그인 유지를 위한 재발급용 토큰 (서버가 저장)
    refreshToken: { type: String },
  },
  // timestamps: createdAt(생성시각), updatedAt(수정시각)을 자동으로 만들어 저장
  { timestamps: true }
);

// ───────── 인덱스(빠른 검색을 위한 색인) 설정 ─────────
// role 기준으로 회원을 빠르게 찾기 위한 인덱스
userSchema.index({ role: 1 });

// provider + providerId 조합은 중복 불가 (같은 소셜 계정으로 두 번 가입 방지)
//  - partialFilterExpression: providerId가 '문자열로 존재할 때만' 이 규칙을 적용
//    (일반 가입자는 providerId가 없으므로 이 중복 검사에서 빠짐)
userSchema.index(
  { provider: 1, providerId: 1 },
  { unique: true, partialFilterExpression: { providerId: { $exists: true, $type: 'string' } } }
);

// phone(휴대폰 번호)도 중복 불가
//  - 단, phone이 '문자열로 존재할 때만' 적용 (번호 없는 회원끼리는 충돌 안 함)
userSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $exists: true, $type: 'string' } } }
);

// 위 설계도(userSchema)를 'User'라는 이름의 모델로 만들어 외부에서 쓸 수 있게 내보냄
//  - 컬렉션(테이블) 이름은 자동으로 'users'가 됨
export default mongoose.model('User', userSchema);
