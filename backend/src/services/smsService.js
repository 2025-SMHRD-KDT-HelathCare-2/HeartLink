// [서비스] SMS 발송 — Solapi API (위험 신호 알림, 휴대폰 인증번호 등, 재시도 3회)
import axios from 'axios';
import crypto from 'crypto';

const { SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER } = process.env;

function makeAuthHeader() {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString('hex');
  const signature = crypto
    .createHmac('sha256', SOLAPI_API_SECRET)
    .update(date + salt)
    .digest('hex');
  return `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`;
}

export const sendSMS = async ({ to, message }, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { data } = await axios.post(
        'https://api.solapi.com/messages/v4/send',
        { message: { to, from: SOLAPI_SENDER, text: message } },
        { headers: { Authorization: makeAuthHeader(), 'Content-Type': 'application/json' } }
      );
      return data;
    } catch (err) {
      if (attempt < retries) {
        console.warn(`⚠️ SMS 발송 실패 (${attempt}/${retries}회), ${attempt}초 후 재시도:`, err.message);
        await new Promise(r => setTimeout(r, attempt * 1000));
      } else {
        console.error('❌ SMS 최종 실패:', err.message);
        throw err;
      }
    }
  }
};
