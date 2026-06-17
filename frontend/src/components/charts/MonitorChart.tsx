import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceDot,
  ResponsiveContainer
} from "recharts";
import { useMemo } from "react";

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
    <div className="bg-[#0A1628] rounded-2xl p-6 shadow-lg border-2 border-[#0E8080]/30">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[#3DE8C0] font-bold tracking-wide" style={{ fontSize: "1.2rem" }}>측정 중...</h3>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-[#3DE8C0] rounded-full animate-pulse" />
          <span className="text-[#3DE8C0] font-bold" style={{ fontSize: "0.95rem" }}>LIVE</span>
        </div>
      </div>

      <div style={{ height: 200, minHeight: 200, width: "100%" }}>
        <ResponsiveContainer width="100%" height={200} minWidth={0}>
          <LineChart data={displayData} margin={{ top: 5, right: 10, left: -30, bottom: 5 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#1B3A5C" />
            <XAxis dataKey="x" type="number" domain={[0, maxX]} hide />
            <YAxis hide domain={["auto", "auto"]} />
            <Line
              type="monotone" dataKey="y" stroke="#3DE8C0" strokeWidth={2.5}
              dot={false} isAnimationActive={false}
            />
            {cursor && (
              <ReferenceDot x={cursor.x} y={cursor.y} r={5} fill="#3DE8C0" stroke="white" strokeWidth={1.5} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[#5B8AAE] font-bold" style={{ fontSize: "0.9rem" }}>스캔 중</span>
        <span className="text-[#3DE8C0] font-black" style={{ fontSize: "1rem" }}>{Math.round(revealPercent)}%</span>
      </div>
    </div>
  );
}
