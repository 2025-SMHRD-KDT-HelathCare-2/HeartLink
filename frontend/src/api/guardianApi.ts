import api from "./axios";

/**
 * 연결된 가족 목록 조회
 * GET /api/guardian/members
 */
export const getMembers = async () => {
  const res = await api.get("/api/guardian/members");
  return res.data;
};

/**
 * 가족 연결 (연결 코드로)
 * POST /api/guardian/connect
 * @param {string} code - 어르신에게 받은 연결 코드
 */
export const connectMember = async (code) => {
  const res = await api.post("/api/guardian/connect", { code });
  return res.data;
};

/**
 * 가족 연결 해제
 * DELETE /api/guardian/disconnect/:memberId
 */
export const disconnectMember = async (memberId) => {
  const res = await api.delete(`/api/guardian/disconnect/${memberId}`);
  return res.data;
};

/**
 * 알림 목록 조회
 * GET /api/guardian/notifications
 */
export const getNotifications = async () => {
  const res = await api.get("/api/guardian/notifications");
  return res.data;
};

/**
 * 알림 읽음 처리
 * PATCH /api/guardian/notifications/:notificationId/read
 */
export const markNotificationRead = async (notificationId) => {
  const res = await api.patch(`/api/guardian/notifications/${notificationId}/read`);
  return res.data;
};
