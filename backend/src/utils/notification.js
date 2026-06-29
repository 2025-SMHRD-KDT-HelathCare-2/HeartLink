import admin from '../config/firebase.js';

function isNightTime() {
  const hour = new Date().getHours();
  return hour >= 22 || hour < 7;
}

function getNextMorning() {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(8, 0, 0, 0);
  return next;
}

export const sendPushNotification = async (fcmToken, title, body, data = null, retries = 3) => {
  const message = { token: fcmToken, notification: { title, body } };
  if (data) {
    // FCM data 값은 모두 문자열이어야 함
    message.data = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]));
  }
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await admin.messaging().send(message);
      console.log('✅ 푸시 알림 발송 성공:', response);
      return response;
    } catch (err) {
      if (attempt < retries) {
        console.warn(`⚠️ 푸시 알림 발송 실패 (${attempt}/${retries}회), ${attempt}초 후 재시도:`, err.message);
        await new Promise(r => setTimeout(r, attempt * 1000));
      } else {
        console.error('❌ 푸시 알림 최종 실패:', err.message);
        throw err;
      }
    }
  }
};

export const sendRiskNotification = async ({ riskLevel, fcmToken, title, body, smsSend }) => {
  if (riskLevel === 'high') {
    await sendPushNotification(fcmToken, title, body);
    if (smsSend) await smsSend();
    return { sent: true, delayed: false };
  }

  if (riskLevel === 'medium') {
    if (isNightTime()) {
      const delay = getNextMorning() - Date.now();
      setTimeout(() => sendPushNotification(fcmToken, title, body).catch(() => {}), delay);
      return { sent: false, delayed: true, scheduledAt: getNextMorning() };
    }
    await sendPushNotification(fcmToken, title, body);
    return { sent: true, delayed: false };
  }

  return { sent: false, delayed: false, accumulated: true };
};

export { isNightTime, getNextMorning };
