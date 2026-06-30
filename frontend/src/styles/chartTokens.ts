// ============================================================================
// 차트(Recharts) 전용 토큰
// - Recharts 는 SVG 기반이라 색/폰트 크기를 JS 값(props)으로 넘겨야 한다.
//   따라서 CSS Module 로 옮길 수 없는 차트 관련 값은 이곳에 모아 일원화한다.
// - 일반 색상(primary/위험도 등)은 tokens.ts 의 COLORS 를 재사용한다.
// ============================================================================
import { COLORS } from "./tokens";

// 위험도(영문/한글) → 색상 매핑. 기존 ReportCharts 의 RISK_COLOR_MAP 대체.
export const RISK_COLOR_MAP: Record<string, string> = {
  high: COLORS.danger, mid: COLORS.warning, low: COLORS.safe,
  상: COLORS.danger,   중: COLORS.warning,  하: COLORS.safe,
};

// 부정맥 종류별 색(도넛/범례). 기존 ARRHYTHMIA_COLORS 대체.
// N(정상)은 청록, 나머지는 위험도 톤 + 회색을 순서대로 배정해 항목별로 색이 겹치지 않게 함.
export const ARRHYTHMIA_COLORS = [
  COLORS.primary,
  COLORS.danger,
  COLORS.warning,
  COLORS.safe,
  "#9ca3af",
];

// 위험도 3단계 범례 공통 데이터 (양호/주의/위험)
export const RISK_LEGEND: Array<{ color: string; label: string }> = [
  { color: COLORS.safe,    label: "양호" },
  { color: COLORS.warning, label: "주의" },
  { color: COLORS.danger,  label: "위험" },
];

// Recharts 축/격자/툴팁 공통 스타일 값
export const CHART_AXIS = {
  tick: { fontSize: 11, fontWeight: 700 } as const,
  tickLg: { fontSize: 13, fontWeight: 700 } as const,
  gridStroke: "#f0f0f0",
  axisStroke: "#9ca3af",
};

// ECG 모니터(병원 모니터 톤) 전용 색 — 일반 팔레트와 별개의 특수 톤
export const MONITOR_COLORS = {
  bg: "#0A1628",
  grid: "#1B3A5C",
  line: "#3DE8C0",
  label: "#5B8AAE",
};