// mongoose: MongoDB를 자바스크립트에서 다루기 위한 라이브러리
import mongoose from 'mongoose';
// Schema(데이터 설계도) 기능만 꺼내서 사용
const { Schema } = mongoose;

// guardianRelationSchema: '사용자 ↔ 보호자' 연결 관계를 저장하는 설계도
const guardianRelationSchema = new Schema(
  {
    // userId: 측정 당사자(보호받는 사람)의 회원 ID
    //  - ObjectId: 다른 문서를 가리키는 고유 식별자
    //  - ref: 'User' → User 컬렉션의 문서를 참조함. 필수
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    // guardianId: 보호자(지켜보는 사람)의 회원 ID. User 참조. 필수
    guardianId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    // guardianName: 보호자 이름. 필수, 최대 50글자
    guardianName: { type: String, required: true, maxlength: 50 },

    // guardianContact: 보호자 연락처(전화번호). 필수, 최대 20글자
    guardianContact: { type: String, required: true, maxlength: 20 },

    // guardianEmail: 보호자 이메일(선택). 최대 100글자
    guardianEmail: { type: String, maxlength: 100 },

    // notifyPermission: 보호자에게 알림을 보내도 되는지 여부. 기본 true(허용), 필수
    notifyPermission: { type: Boolean, required: true, default: true },

    // relationStatus: 보호자 관계의 승인 상태
    //  - pending(대기), accepted(수락됨), rejected(거절됨) 중 하나
    relationStatus: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      required: true,
      default: 'pending', // 처음 요청 시 기본은 '대기' 상태
    },
  },
  // createdAt, updatedAt 자동 기록
  { timestamps: true }
);

// userId로 "이 사용자의 보호자들"을 빠르게 찾기 위한 인덱스
guardianRelationSchema.index({ userId: 1 });
// guardianId로 "이 보호자가 돌보는 사람들"을 빠르게 찾기 위한 인덱스
guardianRelationSchema.index({ guardianId: 1 });

// 'GuardianRelation' 모델로 내보냄 (컬렉션 이름은 자동으로 'guardianrelations')
export default mongoose.model('GuardianRelation', guardianRelationSchema);
