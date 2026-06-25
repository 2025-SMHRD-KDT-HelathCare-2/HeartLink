import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ECGChartProps {
  data: Array<{ x: number; y: number }>;
  rPeaks: number[];
  zoom?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  revealPercent?: number;
  sampleRate?: number;
}

const SECONDS_PER_PAGE = 10;

export function ECGChart({ data, rPeaks, zoom = 1, revealPercent, sampleRate = 250 }: ECGChartProps) {
  const visibleCount = Math.floor(data.length / zoom);
  const baseData = data.slice(0, visibleCount);

  const revealedData = useMemo(() => {
    if (revealPercent === undefined || revealPercent >= 100) return baseData;
    if (baseData.length === 0) return baseData;
    const cutoff = Math.floor((baseData.length * revealPercent) / 100);
    return baseData.slice(0, Math.max(cutoff, 2));
  }, [baseData, revealPercent]);

  // 전체 지속 시간(초) 기준으로 페이지 분할
  const totalDuration = revealedData.length > 0
    ? revealedData[revealedData.length - 1].x
    : 0;
  const totalPages = Math.max(1, Math.ceil(totalDuration / SECONDS_PER_PAGE));

  const [page, setPage] = useState(0);
  const safePage = Math.min(page, totalPages - 1);

  const pageStartX = safePage * SECONDS_PER_PAGE;
  const pageEndX = pageStartX + SECONDS_PER_PAGE;

  const pageData = useMemo(() => {
    return revealedData.filter(d => d.x >= pageStartX && d.x < pageEndX);
  }, [revealedData, pageStartX, pageEndX]);

  const visiblePeaks = rPeaks.filter(x => x >= pageStartX && x < pageEndX);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[#0A2647] font-bold" style={{ fontSize: "1.3rem" }}>심장 뛰는 모양 그래프</h3>
        <span className="text-gray-400 font-bold" style={{ fontSize: "0.95rem" }}>
          {safePage + 1} / {totalPages} 페이지
        </span>
      </div>

      {/* 격자 배경 + 차트 */}
      <div style={{ position: "relative", height: 220 }}>
        {/* CSS 격자 배경 */}
        <div style={{
          position: "absolute",
          inset: "5px 10px 25px 30px", // 차트 margin에 맞춤
          backgroundImage: `
            linear-gradient(rgba(255,100,100,0.4) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,100,100,0.4) 1px, transparent 1px),
            linear-gradient(rgba(255,100,100,0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,100,100,0.15) 1px, transparent 1px)
          `,
          backgroundSize: `
            100% 50px,
            50px 100%,
            100% 10px,
            10px 100%
          `,
          pointerEvents: "none",
          zIndex: 1,
        }} />

        <div style={{ position: "relative", zIndex: 2, height: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pageData} margin={{ top: 5, right: 10, left: -20, bottom: 25 }}>
              <XAxis
                dataKey="x"
                type="number"
                domain={[pageStartX, pageEndX]}
                tickCount={11}
                tick={{ fontSize: 11, fontWeight: 700 }}
                tickFormatter={v => `${v.toFixed(0)}s`}
                stroke="#9ca3af"
              />
              <YAxis tick={{ fontSize: 11, fontWeight: 700 }} stroke="#9ca3af" />
              <Tooltip
                formatter={(val: number) => [`${val.toFixed(3)} mV`, "진폭"]}
                labelFormatter={l => `${Number(l).toFixed(2)}초`}
                contentStyle={{ fontSize: "0.85rem", fontWeight: 700 }}
              />
              {visiblePeaks.map(x => (
                <ReferenceLine key={x} x={x} stroke="#DC2626" strokeDasharray="2 2" strokeOpacity={0.8} />
              ))}
              <Line
                type="monotone" dataKey="y"
                stroke="#0E8080" strokeWidth={1.5}
                dot={false} isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 페이지 네비게이션 */}
      <div className="flex items-center justify-between mt-3">
        <button
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={safePage === 0}
          className="flex items-center gap-1 px-4 py-2 rounded-xl border-2 border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-all font-bold"
          style={{ fontSize: "1rem" }}>
          <ChevronLeft className="w-5 h-5" />이전 10초
        </button>

        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button key={i} onClick={() => setPage(i)}
              className="rounded-full transition-all"
              style={{
                width: i === safePage ? 20 : 8,
                height: 8,
                backgroundColor: i === safePage ? "#0E8080" : "#d1d5db",
              }}
            />
          ))}
        </div>

        <button
          onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
          disabled={safePage === totalPages - 1}
          className="flex items-center gap-1 px-4 py-2 rounded-xl border-2 border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-all font-bold"
          style={{ fontSize: "1rem" }}>
          다음 10초<ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-5 mt-3 font-bold flex-wrap" style={{ fontSize: "0.95rem", color: "#6b7280" }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 bg-[#0E8080]" />
          <span>심전도 파형</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-0.5" style={{ borderTop: "2px dashed #DC2626" }} />
          <span>심장 박동 위치</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border border-red-300" style={{ backgroundColor: "rgba(255,200,200,0.3)" }} />
          <span>ECG 격자 (대/소)</span>
        </div>
      </div>
    </div>
  );
}