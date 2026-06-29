// frontend/src/utils/notificationLink.ts
// FCM 푸시 알림 클릭 시 이동할 앱 내부 경로(path)를 계산하는 유틸.

export type FcmData = Record<string, string> | undefined;

type Role = "user" | "guardian";

/**
 * FCM 알림 클릭 시 이동할 경로를 계산한다.
 * 우선순위: data.url > data.type 조합 > 역할별 알림함 폴백
 */
export function resolveNotificationPath(role: Role | null, data: FcmData): string {
  // (1) 완성된 링크를 직접 받은 경우
  if (data?.url && data.url.startsWith("/")) {
    return data.url;
  }

  // (2) type 기반 경로 조합
  switch (data?.type) {
    case "measurement": {
      if (role === "guardian" && data.userId && data.measurementId) {
        return `/guardian-report-detail/${data.userId}/measurement/${data.measurementId}`;
      }
      if (data.measurementId) {
        return `/measurement/${data.measurementId}`;
      }
      return fallbackPath(role);
    }

    case "report": {
      const reportType = data.reportType || "weekly";
      if (role === "guardian" && data.userId && data.reportId) {
        return `/guardian-report-detail/${data.userId}/${reportType}/${data.reportId}`;
      }
      if (data.reportId) {
        return `/report-detail/${reportType}/${data.reportId}`;
      }
      return fallbackPath(role);
    }

    case "guardian_request":
      return "/mypage";

    case "guardian_accepted":
      return "/";

    case "guardian_disconnected":
      return role === "guardian" ? "/guardian-mypage" : "/mypage";

    default:
      return fallbackPath(role);
  }
}

/** 역할에 맞는 알림함 경로 (폴백 전용) */
function fallbackPath(role: Role | null): string {
  return role === "guardian" ? "/guardian-notifications" : "/notifications";
}
