const admin = require('../config/firebase');

// 푸시 알림 발송 함수
const sendPushNotification = async (fcmToken, title, body) => {
  try {
    const message = {
      token: fcmToken,
      notification: {
        title,
        body
      }
    };
    const response = await admin.messaging().send(message);
    console.log('✅ 푸시 알림 발송 성공:', response);
    return response;
  } catch (err) {
    console.error('❌ 푸시 알림 발송 실패:', err.message);
    throw err;
  }
};

module.exports = { sendPushNotification };