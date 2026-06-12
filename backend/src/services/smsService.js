import twilio from 'twilio';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export const sendSMS = async ({ to, message }) => {
  return client.messages.create({
    body: message,
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
    to,
  });
};
