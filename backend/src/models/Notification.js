// mongoose: MongoDB를 자바스크립트에서 다루기 위한 라이브러리
import mongoose from 'mongoose';
// Schema(데이터 설계도) 기능만 꺼내서 사용
const { Schema } = mongoose;

// notificationSchema: 사용자/보호자에게 보낸 '알림' 기록을 저장하는 설계도
const notificationSchema = new Schema(
  {
    // analysisId: 어떤 분석 결과 때문에 발생한 알림인지 가리키는 ID. 필수
    analysisId: { type: Schema.Types.ObjectId, ref: 'AnalysisResult', required: true },
    // userId: 알림의 원인이 된 측정 당사자(회원) ID. User 참조. 필수
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // guardianId: 알림을 받은 보호자 ID. User 참조. (보호자 알림이 아니면 없을 수 있어 선택)
    guardianId: { type: Schema.Types.ObjectId, ref: 'User' },

    // riskLevel: 위험 등급. high/mid/low 중 하나. 필수
    riskLevel: { type: String, enum: ['high', 'mid', 'low'], required: true },

    // channel: 알림을 보낸 경로
    //  - push(앱 푸시), sms(문자), app(앱 내 알림) 중 하나. 필수
    channel: { type: String, enum: ['push', 'sms', 'app'], required: true },

    // message: 실제 보낸 알림 내용. 필수, 최대 1000글자
    message: { type: String, required: true, maxlength: 1000 },

    // sendStatus: 전송 결과. success(성공) 또는 fail(실패). 필수
    sendStatus: { type: String, enum: ['success', 'fail'], required: true },

    // isRead: 받는 사람이 이 알림을 읽었는지 여부. 기본 false(안 읽음)
    isRead: { type: Boolean, default: false },

    // sentAt: 알림을 보낸 시각. 필수
    sentAt: { type: Date, required: true },
  },
  // createdAt만 자동 기록, updatedAt은 만들지 않음
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

// guardianId + sentAt(내림차순): "특정 보호자가 받은 최신 알림"을 빠르게 조회
notificationSchema.index({ guardianId: 1, sentAt: -1 });
// analysisId 인덱스: 특정 분석과 연결된 알림을 빠르게 찾기 위함
notificationSchema.index({ analysisId: 1 });

// 'Notification' 모델로 내보냄 (컬렉션 이름은 자동으로 'notifications')
export default mongoose.model('Notification', notificationSchema);
