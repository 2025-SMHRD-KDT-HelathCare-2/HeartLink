// ============================================================================
// 병원 심장 모니터 스타일 실시간 차트
// - 다크 모니터 색은 chartTokens.ts(MONITOR_COLORS) 로 일원화
// - 컨테이너/플롯/LIVE 점 스타일 → MonitorChart.module.css
//   reveal 커서 로직은 100% 동일
// ============================================================================
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceDot,
  ResponsiveContainer
} from "recharts";
import { useMemo } from "react";
import { MONITOR_COLORS } from "../../styles/chartTokens";
import styles from "./MonitorChart.module.css";

interface MonitorChartProps {
  data: Array<{ x: number; y: number }>;
  revealPercent: number; // 0~100
}

// 병원 심장 모니터처럼: 지나온 구간은 선으로, 끝점에 깜빡이는 커서
export function MonitorChart({ data, revealPercent }: MonitorChartProps) {
  const cutoff = Math.max(1, Math.floor((data.length * revealPercent) / 100));
  const displayData = useMemo(() => data.slice(0, cutoff), [data, cutoff]);
  const cursor = displayData[displayData.length - 1];
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
