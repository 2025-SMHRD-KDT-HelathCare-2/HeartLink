// [유틸] refreshToken 해시 — DB에는 원문 대신 해시를 저장해 DB 유출 시 세션 탈취를 방지
import crypto from 'crypto';

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
