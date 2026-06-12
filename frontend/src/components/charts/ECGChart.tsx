import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";
import { ZoomIn, ZoomOut } from "lucide-react";

interface ECGChartProps {
  data: Array<{ x: number; y: number }>;
  rPeaks: number[];
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function ECGChart({ data, rPeaks, zoom, onZoomIn, onZoomOut }: ECGChartProps) {
  const visibleCount = Math.floor(data.length / zoom);
  const visibleData = data.slice(0, visibleCount);
  const maxX = visibleData[visibleCount - 1]?.x ?? Infinity;
  // 너무 많은 ReferenceLine은 브라우저 프리징 유발 — 최대 30개만 표시
  const visiblePeaks = rPeaks.filter(x => x <= maxX).slice(0, 30);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[#0A2647] font-bold" style={{ fontSize: "1.3rem" }}>심장 뛰는 모양 그래프</h3>
        <div className="flex gap-2">
          <button onClick={onZoomIn}
            className="p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            style={{ minHeight: 52, minWidth: 52 }}>
            <ZoomIn className="w-6 h-6 text-gray-600" />
          </button>
          <button onClick={onZoomOut}
            className="p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            style={{ minHeight: 52, minWidth: 52 }}>
            <ZoomOut className="w-6 h-6 text-gray-600" />
          </button>
        </div>
      </div>

      <div style={{ height: 200, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%" debounce={1}>
          <LineChart data={visibleData} margin={{ top: 5, right: 10, left: -30, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="x" tick={{ fontSize: 12, fontWeight: 700 }}
              label={{ value: "시간 (초)", position: "insideBottomRight", offset: 0, fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12, fontWeight: 700 }} />
            <Tooltip
              formatter={(val) => [`${Number(val).toFixed(3)} mV`, "진폭"]}
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
