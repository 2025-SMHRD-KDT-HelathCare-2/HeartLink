// mongoose: MongoDB를 편하게 다루기 위한 라이브러리(ODM). DB 문서의 '설계도'를 만들 수 있게 해줌
import mongoose from 'mongoose';
// mongoose 안에 들어있는 Schema(설계도 도구)를 꺼내서 짧은 이름으로 쓰기 위함
const { Schema } = mongoose;

// 'users' 컬렉션(테이블)에 저장될 회원 한 명의 데이터 구조를 정의
const userSchema = new Schema(
  {
    // 이메일: 문자열, 필수 입력(required), 중복 불가(unique), 값이 없는 문서는 unique 검사에서 제외(sparse)
    email: { type: String, required: true, unique: true, sparse: true },
    // 비밀번호: 문자열. 소셜 로그인 가입자는 비밀번호가 없으므로 필수가 아님
    password: { type: String }, // 소셜 가입자는 없음

    // 소셜 로그인
    // provider: 어떤 방식으로 가입했는지 표시
    provider: {
      type: String,
      // enum: 아래 4가지 값만 허용 (local=일반가입, 나머지는 소셜)
      enum: ['local', 'google', 'naver', 'kakao'],
      // 값을 지정하지 않으면 자동으로 'local'로 설정
      default: 'local',
      required: true, // 반드시 값이 있어야 함
    },
    // providerId: 소셜 서비스(구글/네이버/카카오)가 부여한 그 사용자의 고유 ID
    providerId: { type: String },
    // profileImage: 소셜 계정의 프로필 사진 URL
    profileImage: { type: String },

    // nickname: 화면에 표시될 이름. 필수이며 최대 50자까지만 허용
    nickname: { type: String, required: true, maxlength: 50 },
    // role: 계정 종류. 'user'(측정 당사자) 또는 'guardian'(보호자) 중 하나, 필수
    role: { type: String, enum: ['user', 'guardian'], required: true },

    // 휴대폰 인증
    // phone: 휴대폰 번호. 최대 20자
    phone: { type: String, maxlength: 20 },
    // phoneVerified: 휴대폰 인증 완료 여부. 기본값 false(미인증), 필수
    phoneVerified: { type: Boolean, default: false, required: true },

    // age: 나이(숫자)
    age: { type: Number },
    // gender: 성별. 'M'(남) 또는 'F'(여)만 허용
    gender: { type: String, enum: ['M', 'F'] },
    // medicalHistory: 병력 목록(문자열 배열). 기본값은 빈 배열 []
    medicalHistory: { type: [String], default: [] },
    // refreshToken: 자동 로그인 연장을 위한 토큰을 저장 (로그인 유지용)
    refreshToken: { type: String },
  },
  // timestamps: true → createdAt(생성일시), updatedAt(수정일시)을 자동으로 만들어 기록
  { timestamps: true }
);

// 인덱스: 자주 검색하는 항목에 '색인'을 만들어 조회 속도를 빠르게 함
// role(계정 종류)로 검색할 일이 많으므로 인덱스 생성
userSchema.index({ role: 1 });

// provider + providerId 조합은 중복 불가(unique)
// 단, providerId가 '문자열로 존재할 때만' 이 규칙을 적용(partialFilterExpression)
// → 일반(local) 가입자는 providerId가 없으므로 이 중복 규칙의 영향을 받지 않음
userSchema.index(
  { provider: 1, providerId: 1 },
  { unique: true, partialFilterExpression: { providerId: { $exists: true, $type: 'string' } } }
);

// phone(휴대폰 번호)도 중복 불가
// 단, phone이 '문자열로 존재할 때만' 적용 → 번호가 없는 계정끼리는 충돌하지 않음
userSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $exists: true, $type: 'string' } } }
);


// 위 설계도를 'User'라는 이름의 모델로 만들어 다른 파일에서 가져다 쓸 수 있게 내보냄
export default mongoose.model('User', userSchema);
