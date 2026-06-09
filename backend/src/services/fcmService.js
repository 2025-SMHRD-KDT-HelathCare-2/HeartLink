const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

exports.sendPush = async ({ deviceToken, title, body }) => {
  return admin.messaging().send({
    token: deviceToken,
    notification: { title, body },
  });
};
