// mongoose 라이브러리 불러오기
import mongoose from 'mongoose';
// 설계도 도구 Schema 꺼내기
const { Schema } = mongoose;

// 사용자(측정자)와 보호자의 '연결 관계'를 저장하는 컬렉션 구조 정의
const guardianRelationSchema = new Schema(
  {
    // userId: 보호 대상이 되는 사용자(측정 당사자)의 _id
    // ref: 'User' → 이 값이 User 컬렉션의 한 사람을 가리킨다는 의미(연결고리)
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // guardianId: 보호자 역할인 사용자의 _id (역시 User를 가리킴)
    guardianId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // guardianName: 보호자 이름. 필수, 최대 50자
    guardianName: { type: String, required: true, maxlength: 50 },
    // guardianContact: 보호자 연락처(전화번호). 필수, 최대 20자
    guardianContact: { type: String, required: true, maxlength: 20 },
    // guardianEmail: 보호자 이메일(선택). 최대 100자
    guardianEmail: { type: String, maxlength: 100 },
    // notifyPermission: 보호자에게 알림을 보내도 되는지 동의 여부. 기본값 true(허용)
    notifyPermission: { type: Boolean, required: true, default: true },
    // relationStatus: 보호자 연결 상태
    relationStatus: {
      type: String,
      // pending=요청중, accepted=수락됨, rejected=거절됨
      enum: ['pending', 'accepted', 'rejected'],
      required: true,
      default: 'pending', // 처음엔 '요청중' 상태로 시작
    },
  },
  // createdAt, updatedAt 자동 기록
  { timestamps: true }
);

// userId로 "이 사용자의 보호자들"을 빠르게 찾기 위한 인덱스
guardianRelationSchema.index({ userId: 1 });
// guardianId로 "이 보호자가 돌보는 사람들"을 빠르게 찾기 위한 인덱스
guardianRelationSchema.index({ guardianId: 1 });

// 'GuardianRelation' 모델로 내보내기
export default mongoose.model('GuardianRelation', guardianRelationSchema);
