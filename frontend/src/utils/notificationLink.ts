// ============================================================================
// notificationLink.ts
// ----------------------------------------------------------------------------
// FCM 푸시 알림을 "클릭"했을 때, 어떤 화면(URL)으로 이동할지 결정하는 유틸.
//
// [왜 이 파일이 필요한가?]
//  - 푸시 알림은 두 가지 상황에서 클릭될 수 있다.
//      (1) 앱이 열려 있을 때(포그라운드)  -> AuthContext.tsx 의 onMessage 에서 처리
//      (2) 앱이 닫혀 있을 때(백그라운드)   -> firebase-messaging-sw.js 에서 처리
//    두 곳 모두 "어디로 보낼지" 규칙이 똑같아야 하므로,
//    그 규칙(경로 계산)을 이 한 파일에 모아두고 양쪽에서 똑같이 쓴다.
//
// [지금 백엔드 상황]
//  - 현재 백엔드는 FCM 메시지에 notification(title/body)만 보내고
//    data 페이로드(type/url/reportId 등)는 보내지 않는다.
//  - 그래서 지금은 "역할에 맞는 기본 알림 화면"으로만 보낼 수 있다.
//  - 나중에 백엔드가 data 를 추가하면, 아래 코드가 자동으로 그 값을 우선 사용해
//    정확한 화면으로 이동한다. (즉, 프론트는 더 고칠 필요 없음)
// ============================================================================

// FCM payload.data 는 항상 "문자열 값"만 담긴다는 점에 주의.
// (예: reportId 가 숫자여도 "123" 처럼 문자열로 온다.)
export type FcmData = Record<string, string> | undefined;

type Role = "user" | "guardian";

/**
 * FCM 알림 클릭 시 이동할 "앱 내부 경로(path)"를 계산한다.
 *
 * @param role  현재 로그인한 사용자의 역할 ("user" | "guardian" | null)
 * @param data  FCM 메시지의 data 페이로드 (지금은 보통 undefined)
 * @returns     이동할 경로 문자열 (예: "/notifications")
 *
 * [경로 결정 우선순위]
 *  1) data.url 이 있으면 그대로 사용 (백엔드가 완성된 링크를 직접 보낸 경우)
 *  2) data.type 등으로 화면을 조합 (백엔드가 종류만 보낸 경우)
 *  3) 위 둘 다 없으면, 역할별 기본 알림 화면으로 폴백(fallback)
 */
export function resolveNotificationPath(role: Role | null, data: FcmData): string {
  // ---- (1) 백엔드가 완성된 링크를 직접 준 경우: 가장 우선 ----
  // 예: data = { url: "/report-detail/weekly/6a3e..." }
  if (data?.url && data.url.startsWith("/")) {
    return data.url;
  }

  // ---- (2) 백엔드가 "종류 + 식별자"만 준 경우: 화면을 직접 조합 ----
  // 아래 필드명(type/reportId/...)은 백엔드 확정 시 맞춰서 수정하면 된다.
  if (data?.type) {
    if (role === "guardian") {
      return resolveGuardianByData(data);
    }
    return resolveUserByData(data);
  }

  // ---- (3) data 가 전혀 없을 때: 역할별 기본 알림 화면으로 ----
  // 보호자/사용자 모두 알림 목록 화면으로 보낸다.
  // (보호자 레이아웃은 하단 탭바로 알림 탭이 노출되므로 /notifications 진입 후
  //  목록에서 상세로 들어가는 흐름이 가장 안전하다.)
  return "/notifications";
}

/**
 * 사용자(본인) 알림 data 로 경로 조합.
 * 백엔드가 reportId/measurementId 등을 보내주면 정밀 이동.
 */
function resolveUserByData(data: Record<string, string>): string {
  // 예) 주간 리포트 알림
  if (data.type === "report" && data.reportType && data.reportId) {
    return `/report-detail/${data.reportType}/${data.reportId}`;
  }
  // 예) 측정 결과 알림
  if (data.type === "measurement" && data.measurementId) {
    return `/measurement/${data.measurementId}`;
  }
  // 그 외 종류는 알림 목록으로
  return "/notifications";
}

/**
 * 보호자 알림 data 로 경로 조합.
 * 보호자는 "어떤 환자(userId)"의 리포트인지가 추가로 필요하다.
 */
function resolveGuardianByData(data: Record<string, string>): string {
  // 예) 특정 환자의 주간 리포트 상세
  if (
    data.type === "report" &&
    data.userId &&
    data.reportType &&
    data.reportId
  ) {
    return `/guardian-report-detail/${data.userId}/${data.reportType}/${data.reportId}`;
  }
  // 환자 식별자만 있으면 그 환자의 리포트 화면으로
  if (data.userId) {
    return `/guardian-report?userId=${data.userId}`;
  }
  // 그 외는 알림 목록으로
  return "/notifications";
}
