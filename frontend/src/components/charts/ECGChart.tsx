import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";
import { useMemo } from "react";

interface ECGChartProps {
  data: Array<{ x: number; y: number }>;
  rPeaks: number[];
  zoom?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  revealPercent?: number; // 0~100, 지정 시 왼쪽부터 그만큼만 표시
}

export function ECGChart({ data, rPeaks, zoom = 1, revealPercent }: ECGChartProps) {
  const visibleCount = Math.floor(data.length / zoom);
  const baseData = data.slice(0, visibleCount);

  // reveal 애니메이션: revealPercent에 따라 왼쪽부터 점진적으로 표시
  const displayData = useMemo(() => {
    if (revealPercent === undefined || revealPercent >= 100) return baseData;
    if (baseData.length === 0) return baseData;
    const cutoff = Math.floor((baseData.length * revealPercent) / 100);
    // 최소 2개 이상 보장 (차트 너비 계산 오류 방지)
    return baseData.slice(0, Math.max(cutoff, 2));
  }, [baseData, revealPercent]);

  const maxX = baseData[baseData.length - 1]?.x ?? 0;
  const visiblePeaks = rPeaks.filter(x => {
    const limit = displayData[displayData.length - 1]?.x ?? 0;
    return x <= limit;
  });

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="mb-5">
        <h3 className="text-[#0A2647] font-bold" style={{ fontSize: "1.3rem" }}>심장 뛰는 모양 그래프</h3>
      </div>

      <div style={{ height: 200, minHeight: 200, width: "100%" }}>
        <ResponsiveContainer width="100%" height={200} minWidth={0}>
          <LineChart data={displayData} margin={{ top: 5, right: 10, left: -30, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="x"
              type="number"
              domain={[0, maxX]}
              tick={{ fontSize: 12, fontWeight: 700 }}
              label={{ value: "시간 (초)", position: "insideBottomRight", offset: 0, fontSize: 12 }}
            />
            <YAxis tick={{ fontSize: 12, fontWeight: 700 }} />
            <Tooltip
              formatter={(val: number) => [`${val.toFixed(3)} mV`, "진폭"]}
              labelFormatter={l => `${l}초`} />
            {visiblePeaks.map(x => (
              <ReferenceLine key={x} x={x} stroke="#DC2626" strokeDasharray="2 2" strokeOpacity={0.7} />
            ))}
            <Line type="monotone" dataKey="y" stroke="#0E8080" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-5 mt-3 font-bold" style={{ fontSize: "1rem", color: "#6b7280" }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 bg-[#0E8080]" />
          <span>심전도 파형</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-0.5" style={{ borderTop: "2px dashed #DC2626" }} />
          <span>심장 박동 위치</span>
        </div>
      </div>
    </div>
  );
}