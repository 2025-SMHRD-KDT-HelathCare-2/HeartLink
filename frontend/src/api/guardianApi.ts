import api from "./authApi";

// ── 보호자 전용 ──────────────────────────────────────────

/**
 * [닉네임 미리보기] 이메일로 사용자(환자)를 조회해 닉네임을 가져옵니다.
 *
 * - 보호자가 등록 요청을 "실제로 보내기 전에" 이 함수로 먼저 조회해서
 *   "이 사람이 맞나?"를 닉네임으로 확인시키는 용도입니다. (2단계 UX의 1단계)
 * - 백엔드가 200을 주면 { nickname: "..." } 형태의 데이터가 옵니다.
 * - 존재하지 않는 사용자면 백엔드가 404를 주는데, 이때 axios 는 에러를 던집니다.
 *   호출하는 쪽(GuardianMyPage)에서 err.response.status === 404 인지 보고
 *   "존재하지 않는 사용자" 안내를 띄웁니다.
 *
 * 사용 예) const { nickname } = await lookupUser("hong@test.com");
 */

export const lookupUser = async (email: string) => {
  const { data } = await api.get("/guardians/lookup", {
    params: { email }, // → 실제 요청 주소: /guardians/lookup?email=hong@test.com
  });
  return data; // { nickname: string }
};

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
