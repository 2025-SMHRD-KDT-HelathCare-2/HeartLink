// mongoose: MongoDB를 JavaScript에서 다루기 위한 ODM 라이브러리
import mongoose from 'mongoose';
// Schema(데이터 설계도) 기능만 꺼내서 사용
const { Schema } = mongoose;

// guardianRelationSchema: '사용자(본인) ↔ 보호자' 연계 정보를 저장하는 스키마
//  - 본인과 보호자는 N:M 관계입니다.
//    (한 명의 본인이 여러 보호자를 가질 수 있고, 한 명의 보호자도 여러 본인을 돌볼 수 있음)
//  - 이 컬렉션이 두 사용자를 잇는 '연결(조인) 테이블' 역할을 합니다.
//  - 인원 수 제한은 두지 않습니다.
const guardianRelationSchema = new Schema(
  {
    // userId: 측정 본인(피보호자)의 ID. User 참조. 필수
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // guardianId: 보호자의 ID. User 참조. 필수
    guardianId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    // guardianName: 보호자 이름(표시용 캐시 값). 선택
    guardianName: { type: String },
    // guardianContact: 보호자 연락처(전화번호 등). 선택
    guardianContact: { type: String },
    // guardianEmail: 보호자 이메일. 선택
    guardianEmail: { type: String },

    // notifyPermission: 이 보호자에게 알림을 보낼지 여부 (true=허용, 기본 false)
    notifyPermission: { type: Boolean, default: false },

    // relationStatus: 연계 상태
    //  - pending(요청 대기) / accepted(수락됨) / rejected(거절됨), 기본 pending
    relationStatus: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
  },
  // timestamps: createdAt / updatedAt 자동 생성
  { timestamps: true }
);

// ───────── 인덱스(빠른 검색을 위한 색인) ─────────
// 본인(userId) 기준으로 연결된 보호자 목록을 빠르게 조회
guardianRelationSchema.index({ userId: 1 });
// 보호자(guardianId) 기준으로 돌보는 본인 목록을 빠르게 조회
guardianRelationSchema.index({ guardianId: 1 });

// userId + guardianId 조합 유니크 (같은 본인-보호자 쌍이 중복 등록되는 것을 방지)
guardianRelationSchema.index({ userId: 1, guardianId: 1 }, { unique: true });

// guardianRelationSchema를 'GuardianRelation' 모델로 생성해 내보냄
//  - 실제 컬렉션명은 'guardianrelations'
export default mongoose.model('GuardianRelation', guardianRelationSchema);
