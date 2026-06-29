// frontend/src/styles/tokens.ts
// 색상/타이포/간격 등 디자인 토큰 모음.
// CSS 와 JS(recharts 등 prop 으로 색을 넘기는 경우) 양쪽에서 동일하게 쓰기 위해
// TS 상수로 관리한다. (Tailwind 설정이 없으므로 인라인 스타일에서 직접 사용)

// ============================================================================
// 1) 색상 팔레트
// ============================================================================
export const COLORS = {
  // ── 브랜드(메인) 색: 청록 계열 ──
  primary: "#0D9488",      // 메인 청록 (버튼/강조)
  primaryMid: "#0F766E",   // 메인 진한 청록 (사이드바/hover)
  primaryDark: "#115E59",  // 더 진한 청록 (눌림 상태 등)
  primaryLight: "#13B5CE", // 밝은 청록 (그라데이션 끝색/포인트)
  primarySoft: "#CCFBF1",  // 아주 옅은 청록 (배경 강조)

  accent: "#3B82F6",       // 보조 파랑 (정보성 강조)

  // ── 상태 색: 위험 ──
  danger: "#DC2626",
  dangerBg: "#FEF2F2",
  dangerBorder: "#FECACA",

  // ── 상태 색: 주의 ──
  warning: "#D97706",
  warningBg: "#FFFBEB",
  warningBorder: "#FDE68A",

  // ── 상태 색: 안전(정상) ──
  safe: "#16A34A",
  safeBg: "#F0FDF4",
  safeBorder: "#BBF7D0",

  // ── 상태 색: 정보 ──
  info: "#2563EB",
  infoBg: "#EFF6FF",
  infoBorder: "#BFDBFE",

  // ── 텍스트 색 ──
  ink: "#111827",   // 가장 진한 본문/제목
  navy: "#1E293B",  // 제목용 네이비 (이미지 톤)
  body: "#374151",  // 일반 본문
  muted: "#64748B", // 보조 텍스트(설명/캡션)
  faint: "#94A3B8", // 가장 흐린 텍스트(placeholder 등)

  // ── 배경/면 ──
  appBg: "#F8FAFC",   // 앱 전체 배경 (살짝 푸른 회색)
  cardBg: "#FFFFFF",  // 카드 배경
  subtleBg: "#F1F5F9",// 옅은 섹션 배경
  border: "#E2E8F0",  // 카드/구분선 테두리

  // ── 차트 보조 ──
  gridLine: "#F0F0F0",
  axis: "#9CA3AF",
} as const;

// ============================================================================
// 2) 그라데이션 (이미지의 청록→블루 포인트 그라데이션)
// ============================================================================
export const GRADIENTS = {
  // 메인 포인트 그라데이션 (헤더 배너, 강조 카드, 주요 버튼)
  brand: "linear-gradient(135deg, #13B5CE 0%, #0D9488 100%)",
  // 진한 버전 (사이드바/강조 영역)
  brandDeep: "linear-gradient(135deg, #0D9488 0%, #115E59 100%)",
  // 옅은 배너 배경
  brandSoft: "linear-gradient(135deg, #ECFEFF 0%, #F0FDFA 100%)",
} as const;

// ============================================================================
// 3) 그림자 (부드러운 카드 그림자)
// ============================================================================
export const SHADOWS = {
  card: "0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)",
  cardHover: "0 6px 16px rgba(15, 23, 42, 0.10)",
  floating: "0 10px 30px rgba(13, 148, 136, 0.25)", // 플로팅 버튼 등 강조용
} as const;

// ============================================================================
// 4) 모서리 반경 / 간격 스케일
// ============================================================================
export const RADIUS = {
  sm: "8px",
  md: "12px",
  lg: "16px",   // 기본 카드
  xl: "20px",
  pill: "9999px", // 알약형(뱃지/탭)
} as const;

export const SPACING = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  xxl: "32px",
} as const;

// ============================================================================
// 5) 위험 등급 → 색상 (한글/영문 키 모두 지원, 기존 호환 유지)
// ============================================================================
export const RISK_COLOR: Record<string, string> = {
  high: COLORS.danger,
  mid: COLORS.warning,
  low: COLORS.safe,
  상: COLORS.danger,
  중: COLORS.warning,
  하: COLORS.safe,
};

// ============================================================================
// 6) 부정맥 분류/차트 색상 팔레트 (기존 ARRHYTHMIA_COLORS 호환)
// ============================================================================
export const ARRHYTHMIA_COLORS = [
  COLORS.primary,
  COLORS.primaryLight,
  COLORS.danger,
  COLORS.warning,
  COLORS.safe,
] as const;

// ============================================================================
// 7) 폰트 크기 토큰 (인라인 style 에서 직접 필요할 때만 사용)
// ============================================================================
export const FONT_SIZE = {
  hero: "2.2rem",
  title: "1.6rem",
  sub: "1.3rem",
  body: "1.15rem",
  small: "1rem",
  tiny: "0.9rem",
} as const;

export type RiskLevel = keyof typeof RISK_COLOR;
