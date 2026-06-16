// backend/testSms.js
require("dotenv").config();
const { sendSms } = require("./src/services/smsService");

sendSms("+821081840460", "[HeartLink] 보호자 알림 테스트입니다.")
  .then((sid) => console.log("발송 성공:", sid))
  .catch((err) => console.error("발송 실패:", err.message));
