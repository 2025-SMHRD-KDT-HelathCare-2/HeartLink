import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
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
  sampleRate?: number; // 기본 250Hz
}

const SECONDS_PER_PAGE = 10;

export function ECGChart({ data, rPeaks, zoom = 1, revealPercent, sampleRate = 250 }: ECGChartProps) {
  const pointsPerPage = SECONDS_PER_PAGE * sampleRate;
  const visibleCount = Math.floor(data.length / zoom);
  const baseData = data.slice(0, visibleCount);

  // reveal 애니메이션: revealPercent에 따라 왼쪽부터 점진적으로 표시
  const revealedData = useMemo(() => {
    if (revealPercent === undefined || revealPercent >= 100) return baseData;
    if (baseData.length === 0) return baseData;
    const cutoff = Math.floor((baseData.length * revealPercent) / 100);
    return baseData.slice(0, Math.max(cutoff, 2));
  }, [baseData, revealPercent]);

  const totalPages = Math.max(1, Math.ceil(revealedData.length / pointsPerPage));
  const [page, setPage] = useState(0); // 0-indexed

  // 현재 페이지 데이터
  const pageData = useMemo(() => {
    const start = page * pointsPerPage;
    return revealedData.slice(start, start + pointsPerPage);
  }, [revealedData, page, pointsPerPage]);

  // 현재 페이지의 x 범위
  const pageStartX = pageData[0]?.x ?? 0;
  const pageEndX = pageData[pageData.length - 1]?.x ?? SECONDS_PER_PAGE;

  // 현재 페이지에 해당하는 R피크만
  const visiblePeaks = rPeaks.filter(x => x >= pageStartX && x <= pageEndX);

  // 페이지 변경 시 마지막 페이지 초과 방지
  const safePage = Math.min(page, totalPages - 1);
  if (safePage !== page) setPage(safePage);

  // 심전도 격자: 소격자(0.04초=10포인트, 0.1mV), 대격자(0.2초=50포인트, 0.5mV)
  // recharts CartesianGrid + 커스텀 SVG 배경으로 구현
  const SMALL_GRID_SEC = 0.2;  // 소격자 간격(초) — 화면에 너무 촘촘하지 않게 0.2초로
  const LARGE_GRID_SEC = 1.0;  // 대격자 간격(초)

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[#0A2647] font-bold" style={{ fontSize: "1.3rem" }}>심장 뛰는 모양 그래프</h3>
        <span className="text-gray-400 font-bold" style={{ fontSize: "0.95rem" }}>
          {page + 1} / {totalPages} 페이지
        </span>
      </div>

      {/* 격자 배경 + 차트 */}
      <div style={{ position: "relative", height: 200, width: "100%" }}>
        {/* 심전도 격자 SVG 배경 */}
        <svg
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
          preserveAspectRatio="none"
        >
          <defs>
            {/* 소격자 패턴 */}
            <pattern id="smallGrid" width="4%" height="20%" patternUnits="objectBoundingBox">
              <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#ffcccc" strokeWidth="0.5" />
            </pattern>
            {/* 대격자 패턴 */}
            <pattern id="largeGrid" width="20%" height="100%" patternUnits="objectBoundingBox">
              <rect width="100%" height="100%" fill="url(#smallGrid)" />
              <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#ff9999" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#largeGrid)" />
        </svg>

        <ResponsiveContainer width="100%" height={200} minWidth={0}>
          <LineChart data={pageData} margin={{ top: 5, right: 10, left: -30, bottom: 5 }}>
            {/* 격자는 SVG 배경으로 그리므로 recharts 격자는 숨김 */}
            <CartesianGrid strokeDasharray="" stroke="transparent" />
            <XAxis
              dataKey="x"
              type="number"
              domain={[pageStartX, pageEndX]}
              tickCount={SECONDS_PER_PAGE + 1}
              tick={{ fontSize: 11, fontWeight: 700 }}
              tickFormatter={v => `${v.toFixed(0)}s`}
            />
            <YAxis tick={{ fontSize: 11, fontWeight: 700 }} />
            <Tooltip
              formatter={(val: number) => [`${val.toFixed(3)} mV`, "진폭"]}
              labelFormatter={l => `${Number(l).toFixed(2)}초`} />
            {visiblePeaks.map(x => (
              <ReferenceLine key={x} x={x} stroke="#DC2626" strokeDasharray="2 2" strokeOpacity={0.7} />
            ))}
            <Line
              type="monotone" dataKey="y"
              stroke="#0E8080" strokeWidth={2}
              dot={false} isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 페이지 네비게이션 */}
      <div className="flex items-center justify-between mt-4">
        <button
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0}
          className="flex items-center gap-1 px-4 py-2 rounded-xl border-2 border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-all font-bold"
          style={{ fontSize: "1rem" }}>
          <ChevronLeft className="w-5 h-5" />이전
        </button>

        {/* 페이지 점 인디케이터 */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className="rounded-full transition-all"
              style={{
                width: i === page ? 20 : 8,
                height: 8,
                backgroundColor: i === page ? "#0E8080" : "#d1d5db",
              }}
            />
          ))}
        </div>

        <button
          onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
          disabled={page === totalPages - 1}
          className="flex items-center gap-1 px-4 py-2 rounded-xl border-2 border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-all font-bold"
          style={{ fontSize: "1rem" }}>
          다음<ChevronRight className="w-5 h-5" />
        </button>
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
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border border-[#ff9999]" style={{ backgroundColor: "rgba(255,240,240,0.5)" }} />
          <span>ECG 격자</span>
        </div>
      </div>
    </div>
  );
}