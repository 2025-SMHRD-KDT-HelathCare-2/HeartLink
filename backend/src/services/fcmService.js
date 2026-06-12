import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

export const sendPush = async ({ deviceToken, title, body }) => {
  return admin.messaging().send({
    token: deviceToken,
    notification: { title, body },
  });
};
