// frontend/src/styles/tokens.ts
// 색상/타이포의 단일 소스. CSS @theme 값과 반드시 동일하게 유지할 것.
// recharts 등 JS prop 으로 색을 넘겨야 하는 곳에서 import 해 사용합니다.

export const COLORS = {
  primary: "#0D9488",
  primaryMid: "#0F766E",
  accent: "#3B82F6",

  danger: "#DC2626",
  dangerBg: "#FEF2F2",
  dangerBorder: "#FECACA",

  warning: "#D97706",
  warningBg: "#FFFBEB",
  warningBorder: "#FDE68A",

  safe: "#16A34A",
  safeBg: "#F0FDF4",
  safeBorder: "#BBF7D0",

  ink: "#111827",
  body: "#374151",
  muted: "#6B7280",

  appBg: "#F9FAFB",
  cardBg: "#FFFFFF",

  gridLine: "#f0f0f0",
  axis: "#9ca3af",
} as const;

/** 위험도 등급 → 색상. 영문/한글 키 모두 지원 (기존 RISK_COLOR_MAP 호환) */
export const RISK_COLOR: Record<string, string> = {
  high: COLORS.danger, mid: COLORS.warning, low: COLORS.safe,
  상: COLORS.danger, 중: COLORS.warning, 하: COLORS.safe,
};

/** 부정맥 도넛/파이 차트 색상 팔레트 (기존 ARRHYTHMIA_COLORS 호환) */
export const ARRHYTHMIA_COLORS = [
  COLORS.primary, COLORS.primary, COLORS.danger, COLORS.warning, COLORS.safe,
] as const;

/** 폰트 크기 토큰 (인라인 style 이 꼭 필요한 곳에서만 사용) */
export const FONT_SIZE = {
  hero: "2.2rem",
  title: "1.6rem",
  sub: "1.3rem",
  body: "1.15rem",
  small: "1rem",
  tiny: "0.9rem",
} as const;

export type RiskLevel = keyof typeof RISK_COLOR;
