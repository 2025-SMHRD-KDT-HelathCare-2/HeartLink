import api from "./authApi";

// ── 보호자 전용 ──────────────────────────────────────────

/** 사용자(환자)에게 보호자 등록 요청 보내기 */
export const requestUser = async (userEmail: string) => {
  const { data } = await api.post("/guardians", { user_email: userEmail });
  return data;
};

/** 보호자가 보낸 요청 목록 조회 (pending/accepted/rejected 전체) */
export const getSentRequests = async () => {
  const { data } = await api.get("/guardians/sent");
  return data;
};

/** 보호자 기준 수락된 환자 목록 + 최신 위험도 */
export const getPatients = async () => {
  const { data } = await api.get("/guardians/patients");
  return data;
};

// ── 사용자(환자) 전용 ─────────────────────────────────────

/** 나에게 온 보호자 요청 목록 (pending) */
export const getPendingRequests = async () => {
  const { data } = await api.get("/guardians/requests");
  return data;
};

/** 내 보호자 목록 (수락된 관계) */
export const getMyGuardians = async () => {
  const { data } = await api.get("/guardians");
  return data;
};

/** 보호자 요청 수락 */
export const acceptRequest = async (relationId: string) => {
  const { data } = await api.patch(`/guardians/${relationId}/accept`);
  return data;
};

/** 보호자 요청 거절 */
export const rejectRequest = async (relationId: string) => {
  const { data } = await api.patch(`/guardians/${relationId}/reject`);
  return data;
};

// ── 공통 ──────────────────────────────────────────────────

/** 보호자 관계 해제 */
export const disconnectRelation = async (relationId: string) => {
  const { data } = await api.delete(`/guardians/${relationId}`);
  return data;
};

// ── 알림 ──────────────────────────────────────────────────

/** 알림 목록 조회 */
export const getNotifications = async () => {
  const { data } = await api.get("/notifications");
  return data;
};

/** 알림 읽음 처리 */
export const markNotificationRead = async (notificationId: string) => {
  const { data } = await api.patch(`/notifications/${notificationId}/read`);
  return data;
};
