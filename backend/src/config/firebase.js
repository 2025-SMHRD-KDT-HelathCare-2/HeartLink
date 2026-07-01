// [설정] Firebase Admin SDK 초기화 — FCM 푸시 알림 발송용
import { createRequire } from 'module';
import admin from 'firebase-admin';

const require = createRequire(import.meta.url);
const serviceAccount = require('./firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export default admin;
