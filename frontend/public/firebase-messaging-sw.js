// ============================================================================
// firebase-messaging-sw.js  (서비스 워커 / Service Worker)
// 앱이 백그라운드/종료 상태일 때 오는 푸시를 처리한다.
//  - onBackgroundMessage : 알림 표시
//  - notificationclick   : 알림 클릭 시 해당 화면으로 이동(딥링크)
// 워커는 import 가 안 되므로 경로 규칙을 notificationLink.ts 와 동일하게 JS 로 복제한다.
// ============================================================================
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

// 백그라운드 메시지 수신 → 알림 표시 (클릭 시 사용할 data 보관)
messaging.onBackgroundMessage(payload => {
  const title = (payload.notification && payload.notification.title) || '알림';
  const body = (payload.notification && payload.notification.body) || '';

  self.registration.showNotification(title, {
    body: body,
    icon: '/favicon.ico',
    data: payload.data || {},
  });
});

// 알림 클릭 → 해당 화면으로 이동(딥링크)
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const data = event.notification.data || {};
  const path = resolveNotificationPathSW(data);
  const targetUrl = self.location.origin + path;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// 경로 계산 (notificationLink.ts 와 동일 규칙의 JS 복제본)
function resolveNotificationPathSW(data) {
  if (data.url && typeof data.url === 'string' && data.url.indexOf('/') === 0) {
    return data.url;
  }

  switch (data.type) {
    case 'measurement':
      if (data.userId && data.measurementId) {
        return '/guardian-report-detail/' + data.userId + '/measurement/' + data.measurementId;
      }
      if (data.measurementId) {
        return '/measurement/' + data.measurementId;
      }
      return swFallbackPath(data);

    case 'report': {
      var reportType = data.reportType || 'weekly';
      if (data.userId && data.reportId) {
        return '/guardian-report-detail/' + data.userId + '/' + reportType + '/' + data.reportId;
      }
      if (data.reportId) {
        return '/report-detail/' + reportType + '/' + data.reportId;
      }
      return swFallbackPath(data);
    }

    case 'guardian_request':
      return '/mypage';

    case 'guardian_accepted':
      return '/';

    case 'guardian_disconnected':
      return data.userId ? '/guardian-mypage' : '/mypage';

    default:
      return swFallbackPath(data);
  }
}

// 폴백 경로 (워커는 role 을 모르므로 userId 유무로 추정)
function swFallbackPath(data) {
  return data.userId ? '/guardian-notifications' : '/notifications';
}
