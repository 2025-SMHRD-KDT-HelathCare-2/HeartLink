importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyC44ayApa241UMXBeSnKpyF2mqQ-Vofnvc",
  authDomain: "heartlink-2d120.firebaseapp.com",
  projectId: "heartlink-2d120",
  storageBucket: "heartlink-2d120.firebasestorage.app",
  messagingSenderId: "42249145899",
  appId: "1:42249145899:web:b824e88b6604dbb735246e",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/favicon.ico',
  });
});
