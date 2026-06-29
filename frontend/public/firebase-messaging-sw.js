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
// ---------------------------------------------------------------------------
// 경로 계산 (notificationLink.ts 와 동일 규칙의 JS 복제본)
// 워커는 로그인 role 을 모르므로:
//  - userId 가 data 에 있으면 "보호자가 받는 환자용 알림"으로 간주
//  - 그 외는 사용자(본인) 경로로 처리
//  - 정보가 부족하면 /notifications 로 폴백
// ---------------------------------------------------------------------------
function resolveNotificationPathSW(data) {
  // (1) 완성 링크 직접 수신 시 최우선
  if (data.url && typeof data.url === 'string' && data.url.indexOf('/') === 0) {
    return data.url;
  }

  switch (data.type) {
    // --- 측정 상세 ---
    case 'measurement':
      if (data.userId && data.measurementId) {
        return '/guardian-report-detail/' + data.userId + '/measurement/' + data.measurementId;
      }
      if (data.measurementId) {
        return '/measurement/' + data.measurementId;
      }
      return '/notifications';

    // --- 리포트 상세 ---
    case 'report': {
      var reportType = data.reportType || 'weekly';
      if (data.userId && data.reportId) {
        return '/guardian-report-detail/' + data.userId + '/' + reportType + '/' + data.reportId;
      }
      if (data.reportId) {
        return '/report-detail/' + reportType + '/' + data.reportId;
      }
      return '/notifications';
    }

    // --- 보호자 등록 요청(사용자 수신) -> 사용자 마이페이지 ---
    case 'guardian_request':
      return '/mypage';

    // --- 보호자 등록 수락(보호자 수신) -> 홈 ---
    case 'guardian_accepted':
      return '/';

    // --- 연결 해제(양쪽 수신): 워커는 role 을 모르므로 userId 유무로 추정 ---
    //     userId 가 있으면 보호자가 받은 알림으로 보고 보호자 마이페이지로,
    //     없으면 사용자 마이페이지로.
    case 'guardian_disconnected':
      return data.userId ? '/guardian-mypage' : '/mypage';

    default:
      return '/notifications';
  }
}

