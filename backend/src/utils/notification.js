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

export const sendPushNotification = async (fcmToken, title, body) => {
  try {
    const response = await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
    });
    console.log('✅ 푸시 알림 발송 성공:', response);
    return response;
  } catch (err) {
    console.error('❌ 푸시 알림 발송 실패:', err.message);
    throw err;
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
