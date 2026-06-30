// MonitorChart.tsx

// ============================================================================
// 병원 심장 모니터 스타일 실시간 차트
//
// [성능 최적화 포인트 — 보이는 모양/동작은 동일]
//   - reveal(스캔)이 진행될수록 그릴 점이 계속 늘어나(후반부일수록 무거움),
//     LTTB 다운샘플링으로 "화면에 보이는 만큼"만 그리도록 줄입니다.
//   - 단, 맨 끝점(깜빡이는 커서)은 항상 정확한 최신 위치를 써야 하므로
//     다운샘플 결과의 마지막 점이 아니라 "원본의 마지막 점"을 커서로 씁니다.
//   reveal 커서 로직(진행률 계산)은 100% 동일합니다.
// ============================================================================
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceDot,
  ResponsiveContainer
} from "recharts";
import { useMemo } from "react";
import { MONITOR_COLORS } from "../../styles/chartTokens";
import { lttbDownsample } from "../../utils/downsample";
import styles from "./MonitorChart.module.css";

interface MonitorChartProps {
  data: Array<{ x: number; y: number }>;
  revealPercent: number; // 0~100
}

// 모니터 차트에 그릴 최대 점 개수 (실시간이라 ECG 리포트보다 약간 여유 있게)
const MAX_MONITOR_POINTS = 600;

// 병원 심장 모니터처럼: 지나온 구간은 선으로, 끝점에 깜빡이는 커서
export function MonitorChart({ data, revealPercent }: MonitorChartProps) {
  const cutoff = Math.max(1, Math.floor((data.length * revealPercent) / 100));

  // 지금까지 노출된 구간(원본). 커서 위치 계산에 사용합니다.
  const revealed = useMemo(() => data.slice(0, cutoff), [data, cutoff]);

  // 실제로 그릴 데이터는 다운샘플링해서 점 개수를 줄입니다.
  const displayData = useMemo(
    () => lttbDownsample(revealed, MAX_MONITOR_POINTS),
    [revealed]
  );

  // 커서(깜빡이는 끝점)는 "원본의 마지막 점"을 써서 정확한 최신 위치를 유지합니다.
  const cursor = revealed[revealed.length - 1];
  const maxX = data[data.length - 1]?.x ?? 0;

  return (
    <div className={styles.monitor}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold tracking-wide" style={{ color: MONITOR_COLORS.line, fontSize: "1.2rem" }}>측정 중...</h3>
        <div className="flex items-center gap-2">
          <span className={styles.liveDot} />
          <span className="font-bold" style={{ color: MONITOR_COLORS.line, fontSize: "0.95rem" }}>LIVE</span>
        </div>
      </div>

      <div className={styles.plot}>
        <ResponsiveContainer width="100%" height={200} minWidth={0}>
          <LineChart data={displayData} margin={{ top: 5, right: 10, left: -30, bottom: 5 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={MONITOR_COLORS.grid} />
            <XAxis dataKey="x" type="number" domain={[0, maxX]} hide />
            <YAxis hide domain={["auto", "auto"]} />
            <Line
              type="monotone" dataKey="y" stroke={MONITOR_COLORS.line} strokeWidth={2.5}
              dot={false} isAnimationActive={false}
            />
            {cursor && (
              <ReferenceDot x={cursor.x} y={cursor.y} r={5} fill={MONITOR_COLORS.line} stroke="white" strokeWidth={1.5} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="font-bold" style={{ color: MONITOR_COLORS.label, fontSize: "0.9rem" }}>스캔 중</span>
        <span className="font-black" style={{ color: MONITOR_COLORS.line, fontSize: "1rem" }}>{Math.round(revealPercent)}%</span>
      </div>
    </div>
  );
}
