// ============================================================================
// firebase-messaging-sw.js  (서비스 워커)
// ----------------------------------------------------------------------------
// 앱이 "닫혀 있거나 백그라운드"일 때 오는 푸시를 처리하는 파일.
//  - onBackgroundMessage : 알림을 화면에 표시
//  - notificationclick   : 알림을 클릭하면 지정된 화면으로 앱을 연다(딥링크)
//
// [주의] 이 파일은 일반 모듈 import 가 불가능하므로,
//        경로 계산 규칙을 src/utils/notificationLink.ts 와 "똑같이" JS 로 복제한다.
//        (둘 중 하나를 고치면 다른 하나도 같이 맞춰줘야 함)
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

// ---------------------------------------------------------------------------
// 백그라운드 메시지 수신 → 알림 표시
// data 페이로드를 알림에 함께 저장해 두어야, 클릭 시(notificationclick)에서
// 어디로 보낼지 알 수 있다.
// ---------------------------------------------------------------------------
messaging.onBackgroundMessage(payload => {
  const title = (payload.notification && payload.notification.title) || '알림';
  const body = (payload.notification && payload.notification.body) || '';

  self.registration.showNotification(title, {
    body: body,
    icon: '/favicon.ico',
    // 클릭 시 사용할 data 를 알림에 보관 (없으면 빈 객체)
    data: payload.data || {},
  });
});

// ---------------------------------------------------------------------------
// 알림 클릭 → 해당 화면으로 이동(딥링크)
// ---------------------------------------------------------------------------
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const data = event.notification.data || {};
  const path = resolveNotificationPathSW(data);
  const targetUrl = self.location.origin + path;

  // 이미 열려 있는 앱 탭이 있으면 그 탭을 포커스하고 이동,
  // 없으면 새 창으로 연다.
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

// ---------------------------------------------------------------------------
// 경로 계산 (notificationLink.ts 와 동일한 규칙의 JS 복제본)
// 워커는 로그인 role 을 모르므로 url/type 기반으로만 결정하고,
// 정보가 없으면 알림 목록(/notifications)으로 폴백한다.
// ---------------------------------------------------------------------------
function resolveNotificationPathSW(data) {
  // (1) 백엔드가 완성된 링크를 직접 준 경우
  if (data.url && typeof data.url === 'string' && data.url.indexOf('/') === 0) {
    return data.url;
  }

  // (2) 보호자용: 특정 환자 리포트 상세
  if (data.type === 'report' && data.userId && data.reportType && data.reportId) {
    return '/guardian-report-detail/' + data.userId + '/' + data.reportType + '/' + data.reportId;
  }
  // (2) 사용자용: 본인 리포트 상세
  if (data.type === 'report' && data.reportType && data.reportId) {
    return '/report-detail/' + data.reportType + '/' + data.reportId;
  }
  // (2) 사용자용: 측정 상세
  if (data.type === 'measurement' && data.measurementId) {
    return '/measurement/' + data.measurementId;
  }

  // (3) 폴백
  return '/notifications';
}
