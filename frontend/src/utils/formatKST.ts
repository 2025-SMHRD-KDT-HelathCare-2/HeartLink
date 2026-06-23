/** UTC ISO 문자열 → KST(UTC+9) 날짜/시간 문자열 변환 */
export function toKSTDatetime(iso: string): string {
  if (!iso) return "";
  const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  const s = kst.toISOString();
  return s.slice(0, 10) + " " + s.slice(11, 16);
}

export function toKSTDate(iso: string): string {
  if (!iso) return "";
  const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export function toKSTTime(iso: string): string {
  if (!iso) return "";
  const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(11, 16);
}
