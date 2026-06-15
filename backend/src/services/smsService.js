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

export const sendSMS = async ({ to, message }) => {
  const { data } = await axios.post(
    'https://api.solapi.com/messages/v4/send',
    {
      message: {
        to,
        from: SOLAPI_SENDER,
        text: message,
      },
    },
    {
      headers: {
        Authorization: makeAuthHeader(),
        'Content-Type': 'application/json',
      },
    }
  );
  return data;
};
