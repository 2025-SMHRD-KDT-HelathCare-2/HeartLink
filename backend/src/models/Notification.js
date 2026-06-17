// mongoose 라이브러리 불러오기
import mongoose from 'mongoose';
// 설계도 도구 Schema 꺼내기
const { Schema } = mongoose;

// 사용자/보호자에게 보낸 '알림' 기록을 저장하는 컬렉션 구조 정의
const notificationSchema = new Schema(
  {
    // analysisId: 어떤 분석 결과 때문에 보낸 알림인지 가리킴. 필수
    analysisId: { type: Schema.Types.ObjectId, ref: 'AnalysisResult', required: true },
    // userId: 알림과 관련된 사용자(측정 당사자)의 _id. 필수
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // guardianId: 알림을 받은 보호자의 _id (보호자 알림이 아니면 없을 수 있음 → 선택)
    guardianId: { type: Schema.Types.ObjectId, ref: 'User' },
    // riskLevel: 알림의 위험 등급. high/mid/low. 필수
    riskLevel: { type: String, enum: ['high', 'mid', 'low'], required: true },
    // channel: 어떤 경로로 보냈는지. push=앱 푸시, sms=문자, app=앱 내 알림. 필수
    channel: { type: String, enum: ['push', 'sms', 'app'], required: true },
    // message: 실제 보낸 알림 내용. 필수, 최대 1000자
    message: { type: String, required: true, maxlength: 1000 },
    // sendStatus: 발송 결과. success=성공, fail=실패. 필수
    sendStatus: { type: String, enum: ['success', 'fail'], required: true },
    // isRead: 사용자가 이 알림을 읽었는지 여부. 기본값 false(안 읽음)
    isRead: { type: Boolean, default: false },
    // sentAt: 알림을 보낸 시각. 필수
    sentAt: { type: Date, required: true },
  },
  // createdAt만 자동 기록, updatedAt은 사용 안 함
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

// "특정 보호자가 받은 알림을 최신순으로" 빠르게 찾기 위한 인덱스
notificationSchema.index({ guardianId: 1, sentAt: -1 });
// analysisId로 관련 알림을 빠르게 찾기 위한 인덱스
notificationSchema.index({ analysisId: 1 });

// 'Notification' 모델로 내보내기
export default mongoose.model('Notification', notificationSchema);
