// ============================================================================
// firebase-messaging-sw.js  (서비스 워커 / Service Worker)
// ----------------------------------------------------------------------------
// 📌 이 파일이 하는 일
//   앱이 "꺼져 있거나, 다른 탭에 있거나, 백그라운드 상태"일 때 도착하는
//   푸시 알림을 처리합니다.
//     - onBackgroundMessage : 푸시가 오면 알림을 화면에 띄운다.
//     - notificationclick   : 알림을 클릭하면 지정된 화면으로 앱을 연다(딥링크).
//
// 📌 중요: 이 파일은 일반 import 가 안 됩니다.
//   그래서 경로 계산 규칙을 src/utils/notificationLink.ts 와 "똑같이" JS 로
//   복제해 둡니다. (둘 중 하나를 고치면 반드시 다른 하나도 같이 맞춰야 함)
//
// 📌 한계: 서비스 워커는 "지금 로그인한 사람이 사용자인지 보호자인지(role)"를
//   알 수 없습니다. 그래서 보호자 구분이 필요한 경우 data.userId 가 있는지로
//   "보호자 알림"임을 추정합니다. 더 정확히 하려면 백엔드가 알림에
//   target("user"/"guardian") 필드나 완성된 url 을 같이 보내주면 됩니다.
// ============================================================================

// Firebase SDK 불러오기 (서비스 워커 전용 compat 버전)
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

// Firebase 프로젝트 설정
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
// 1) 백그라운드 메시지 수신 → 알림 표시
// ---------------------------------------------------------------------------
//   클릭 시(아래 notificationclick)에서 "어디로 보낼지" 알아야 하므로,
//   payload.data 를 알림의 data 에 그대로 담아둔다.
messaging.onBackgroundMessage(payload => {
  const title = (payload.notification && payload.notification.title) || '알림';
  const body = (payload.notification && payload.notification.body) || '';

  self.registration.showNotification(title, {
    body: body,
    icon: '/favicon.ico',
    data: payload.data || {}, // ← 클릭 시 사용할 data 보관 (없으면 빈 객체)
  });
});

// ---------------------------------------------------------------------------
// 2) 알림 클릭 → 해당 화면으로 이동(딥링크)
// ---------------------------------------------------------------------------
self.addEventListener('notificationclick', event => {
  event.notification.close(); // 클릭한 알림은 닫는다

  const data = event.notification.data || {};
  const path = resolveNotificationPathSW(data);          // 이동할 앱 내부 경로 계산
  const targetUrl = self.location.origin + path;          // 전체 URL 로 변환

  // 이미 열려 있는 앱 탭이 있으면 그 탭을 그 경로로 이동 후 포커스,
  // 열린 탭이 없으면 새 창으로 연다.
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
// 3) 경로 계산 (notificationLink.ts 와 동일 규칙의 JS 복제본)
// ---------------------------------------------------------------------------
//   결정 순서:
//     (1) data.url 이 있으면 그대로 사용 (백엔드가 완성 링크를 보낸 경우)
//     (2) data.type 으로 화면 조합
//     (3) 위 둘 다 아니면 알림함으로 폴백 (swFallbackPath)
function resolveNotificationPathSW(data) {
  // ── (1) 완성된 링크를 직접 받은 경우: 최우선 ──
  if (data.url && typeof data.url === 'string' && data.url.indexOf('/') === 0) {
    return data.url;
  }

  // ── (2) type 기반 경로 조합 ──
  switch (data.type) {
    // ── 측정 결과 상세 ──
    case 'measurement':
      // userId 가 있으면 보호자가 받은 환자 측정 알림으로 간주
      if (data.userId && data.measurementId) {
        return '/guardian-report-detail/' + data.userId + '/measurement/' + data.measurementId;
      }
      // 사용자 본인의 측정 상세
      if (data.measurementId) {
        return '/measurement/' + data.measurementId;
      }
      return swFallbackPath(data);

    // ── 리포트 상세 ──
    case 'report': {
      var reportType = data.reportType || 'weekly';
      // userId 가 있으면 보호자가 받은 환자 리포트 알림으로 간주
      if (data.userId && data.reportId) {
        return '/guardian-report-detail/' + data.userId + '/' + reportType + '/' + data.reportId;
      }
      // 사용자 본인의 리포트 상세
      if (data.reportId) {
        return '/report-detail/' + reportType + '/' + data.reportId;
      }
      return swFallbackPath(data);
    }

    // ── 보호자 등록 "요청"(사용자 수신) → 사용자 마이페이지 ──
    case 'guardian_request':
      return '/mypage';

    // ── 보호자 등록 "수락"(보호자 수신) → 홈 ──
    case 'guardian_accepted':
      return '/';

    // ── 연결 "해제"(양쪽 수신) ──
    //   워커는 role 을 모르므로 userId 유무로 추정:
    //   userId 가 있으면 보호자가 받은 알림으로 보고 보호자 마이페이지로,
    //   없으면 사용자 마이페이지로.
    case 'guardian_disconnected':
      return data.userId ? '/guardian-mypage' : '/mypage';

    // ── (3) 알 수 없는 type/없음: 알림함으로 폴백 ──
    default:
      return swFallbackPath(data);
  }
}

// ---------------------------------------------------------------------------
// 폴백 경로 헬퍼 (워커 전용)
// ---------------------------------------------------------------------------
//   사용자와 보호자는 알림함 경로가 다르다.
//     - 사용자: "/notifications"
//     - 보호자: "/guardian-notifications"
//   워커는 role 을 모르므로 data.userId 가 있으면 보호자 알림으로 추정한다.
function swFallbackPath(data) {
  return data.userId ? '/guardian-notifications' : '/notifications';
}
