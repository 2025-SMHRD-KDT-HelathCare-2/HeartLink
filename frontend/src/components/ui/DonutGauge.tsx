// frontend/src/components/ui/DonutGauge.tsx
// ----------------------------------------------------------------------------
// 원형(도넛) 진행률 게이지. 이미지의 "Health Score 85/100" 같은 표현용.
// 순수 SVG 로 그려서 외부 차트 라이브러리가 필요 없다.
// ----------------------------------------------------------------------------
interface DonutGaugeProps {
  value: number;          // 현재 값 (0~max)
  max?: number;           // 최대값 (기본 100)
  size?: number;          // 지름(px)
  stroke?: number;        // 링 두께(px)
  color?: string;         // 진행 링 색상
  trackColor?: string;    // 배경 링 색상
  label?: string;         // 가운데 작은 라벨(예: "점")
}

export function DonutGauge({
  value,
  max = 100,
  size = 140,
  stroke = 14,
  color = "#0D9488",
  trackColor = "#E2E8F0",
  label,
}: DonutGaugeProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = Math.max(0, Math.min(1, value / max));
  const dash = circumference * ratio;

  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* 배경 링 */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={trackColor} strokeWidth={stroke}
        />
        {/* 진행 링 */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      {/* 가운데 숫자/라벨 */}
      <div
        style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}
      >
        <span style={{ fontSize: size * 0.28, fontWeight: 900, color, lineHeight: 1 }}>
          {value}
        </span>
        {label && (
          <span style={{ fontSize: size * 0.1, fontWeight: 700, color: "#94A3B8", marginTop: 2 }}>
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
