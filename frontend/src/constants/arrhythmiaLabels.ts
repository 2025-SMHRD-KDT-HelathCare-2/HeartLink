// src/constants/arrhythmiaLabels.ts
// ============================================================================
// 부정맥(심전도 비트) 분류 코드 → 한국어 라벨 매핑
// MIT-BIH 표준 분류 기준(N, SVEB, VEB, F, Q)을 한국어로 표시할 때 공통으로 사용합니다.
// MeasurementDetailPage, ReportDetailCommon(부정맥 도넛 차트) 등에서 공유합니다.
// ============================================================================

export const ARRHYTHMIA_CLASS_LABEL: Record<string, string> = {
  N: "정상",
  SVEB: "상심실성 이소박동",
  VEB: "심실성 이소박동",
  F: "융합박동",
  Q: "판별불가",
};

// 도넛 차트처럼 "코드 (한글)" 형태가 필요한 곳에서 사용
export function formatArrhythmiaLabel(code: string): string {
  const label = ARRHYTHMIA_CLASS_LABEL[code];
  return label ? `${label} (${code})` : code;
}
