// src/api/notificationApi.ts
import api from "./authApi";

export type RiskLevel = "상" | "중" | "하";

// 사용자 본인 알림 항목
export interface AppNotification {
  id: string;
  level: RiskLevel;
  message: string;
  createdAt: string;
  isRead: boolean;
}

// 보호자 알림 — 사용자별 그룹 (알림 없는 사용자도 포함)
export interface NotificationItem {
  id: string;
  level: RiskLevel;
  message: string;
  createdAt: string;
  isRead: boolean;
}

export interface GuardianUserGroup {
  userId: string;
  memberName: string;
  notifications: NotificationItem[];
}

// ===== 사용자 본인 알림 =====
export async function getMyNotifications(): Promise<AppNotification[]> {
  const { data } = await api.get("/notifications");
  return data;
}

// ===== 보호자 알림 =====
// 연동된 모든 사용자를 기준으로 반환 (알림 없는 사용자도 항상 포함)
export async function getGuardianNotifications(): Promise<GuardianUserGroup[]> {
  const { data } = await api.get("/notifications/guardian");
  return data;
}

// 읽음 처리
export async function markNotificationRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}
