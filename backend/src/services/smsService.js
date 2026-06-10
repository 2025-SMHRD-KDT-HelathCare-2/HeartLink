const twilio = require('twilio');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

exports.sendSMS = async ({ to, message }) => {
  return client.messages.create({
    body: message,
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
    to,
  });
};
