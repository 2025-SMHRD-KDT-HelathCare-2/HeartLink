// src/api/notificationApi.ts
import api from "./authApi";

export type RiskLevel = "상" | "중" | "하";

export interface AppNotification {
  id: string;
  level: RiskLevel;
  message: string;
  createdAt: string;      // ISO string
  memberName?: string;    // 보호자용: 어느 사용자 알림인지
  isRead: boolean;
}

// ===== 사용자 본인 알림 =====
// 주간(최근 7일) 알림 목록
export async function getMyNotifications(): Promise<AppNotification[]> {
  const { data } = await api.get("/notifications");
  return data;
}

// ===== 보호자 알림 =====
// 연결된 사용자들의 알림 (요약 현황: 일일 / 주간 알림함: 주간)
export async function getGuardianNotifications(): Promise<AppNotification[]> {
  const { data } = await api.get("/notifications/guardian");
  return data;
}

// 읽음 처리
export async function markNotificationRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}
