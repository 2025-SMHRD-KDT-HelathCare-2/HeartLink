// src/components/charts/ECGChart.tsx

// ============================================================================
// ECG 실시간/리포트 파형 차트
//
// [성능 최적화 포인트 — 보이는 모양/동작은 동일]
//   1) 큰 파형을 LTTB 다운샘플링으로 "화면 폭 픽셀 수" 정도까지 줄입니다.
//      → 점 2,500개를 ~800개로 줄여도 심전도 모양은 거의그대로,
//        recharts 가 그릴 DOM/계산량은 크게 줄어 렌더가 빨라집니다.
//   2) slice / filter / 다운샘플 결과를 useMemo 로 감싸 불필요한 재계산을 막습니다.
//   페이지네이션/줌/reveal 로직은 100% 동일합니다.
//
// [멘토링 반영]
//   - y축에 숫자 눈금(mV) 여러 개를 나열하는 대신, 실제 병원 ECG 모니터처럼
//     "캘리브레이션 마커(꺾쇠 모양 펄스, 1mV 기준선)" 하나만 표시합니다.
// ============================================================================
import {
  LineChart, Line, XAxis, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { COLORS } from "../../styles/tokens";
import { CHART_AXIS } from "../../styles/chartTokens";
import { lttbDownsample } from "../../utils/downsample";
import styles from "./ECGChart.module.css";

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

// 한 페이지(10초)에 그릴 "최대 점 개수".
// 화면 폭이 대략 600~900px 이므로, 그 이상은 눈에 안 보이는 점이라 줄여도 무방합니다.
const MAX_POINTS_PER_PAGE = 800;

// 캘리브레이션 마커(꺾쇠) 크기 — 1mV 기준
const CALIBRATION_MV = 1;

export function ECGChart({ data, rPeaks, zoom = 1, revealPercent, sampleRate: _sampleRate = 250 }: ECGChartProps) {
  // zoom 에 맞춘 기준 데이터 — slice 결과를 메모이즈
  const baseData = useMemo(() => {
    const visibleCount = Math.floor(data.length / zoom);
    return data.slice(0, visibleCount);
  }, [data, zoom]);

  // reveal(실시간 재생 진행률)에 맞춰 일부만 노출
  const revealedData = useMemo(() => {
    if (revealPercent === undefined || revealPercent >= 100) return baseData;
    if (baseData.length === 0) return baseData;
    const cutoff = Math.floor((baseData.length * revealPercent) / 100);
    return baseData.slice(0, Math.max(cutoff, 2));
  }, [baseData, revealPercent]);

  // 전체 지속 시간(초) 기준으로 10초 단위 페이지 분할
  const totalDuration = revealedData.length > 0
    ? revealedData[revealedData.length - 1].x
    : 0;
  const totalPages = Math.max(1, Math.ceil(totalDuration /SECONDS_PER_PAGE));

  const [page, setPage] = useState(0);
  const safePage = Math.min(page, totalPages - 1);

  const pageStartX = safePage * SECONDS_PER_PAGE;
  const pageEndX = pageStartX + SECONDS_PER_PAGE;

  // 현재 페이지(10초)에 해당하는 점만 추리고, 그 다음 다운샘플링으로 줄입니다.
  const pageData = useMemo(() => {
    const sliced = revealedData.filter(d => d.x >= pageStartX && d.x < pageEndX);
    // 점이 너무 많으면 LTTB 로 줄여서 그립니다. (모양 보존)
    return lttbDownsample(sliced, MAX_POINTS_PER_PAGE);
  }, [revealedData, pageStartX, pageEndX]);

  // R-peak 중 현재 페이지 범위에 드는 것만 — filter 결과메모이즈
  const visiblePeaks = useMemo(
    () => rPeaks.filter(x => x >= pageStartX && x < pageEndX),
    [rPeaks, pageStartX, pageEndX]
  );

  // y축 표시 범위 계산 (캘리브레이션 마커 높이를 데이터 범위에 맞추기 위함)
  const yDomain = useMemo(() => {
    if (pageData.length === 0) return [-1, 1];
    let min = Infinity, max = -Infinity;
    for (const d of pageData) {
      if (d.y < min) min = d.y;
      if (d.y > max) max = d.y;
    }
    const pad = (max - min) * 0.1 || 0.5;
    return [min - pad, max + pad];
  }, [pageData]);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-sub" style={{ color:COLORS.primary }}>심장 뛰는 모양 그래프</h3>
        <span className="text-gray-400 font-bold" style={{fontSize: "0.95rem" }}>
          {safePage + 1} / {totalPages} 페이지
        </span>
      </div>

      {/* 격자 배경 + 차트 (스타일은 CSS Module 로 분리) */}
      <div className={styles.plotArea}>
        <div className={styles.gridBackground} />

        <div className={styles.chartLayer} style={{ position: "relative" }}>
          {/* 캘리브레이션 마커(꺾쇠) — y축 숫자 눈금 대신 1mV 기준 펄스 표시 */}
          <CalibrationMark />

          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pageData} margin={{ top: 5, right: 10, left: 10, bottom: 25 }}>
              <XAxis
                dataKey="x"
                type="number"
                domain={[pageStartX, pageEndX]}
                tickCount={11}
                tick={CHART_AXIS.tick}
                tickFormatter={v => `${v.toFixed(0)}s`}
                stroke={CHART_AXIS.axisStroke}
              />
              <Tooltip
                formatter={(val) => [`${Number(val).toFixed(3)} mV`, "진폭"]}
                labelFormatter={l => `${Number(l).toFixed(2)}초`}
                contentStyle={{ fontSize: "0.85rem", fontWeight: 700 }}
              />
              {visiblePeaks.map(x => (
                <ReferenceLine key={x} x={x} stroke={COLORS.danger} strokeDasharray="2 2" strokeOpacity={0.8} />
              ))}
              <Line
                type="monotone" dataKey="y"
                stroke={COLORS.primary} strokeWidth={1.5}
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
          className="flex items-center gap-1 px-4 py-2 rounded-xl border-2 border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-all font-bold text-small">
          <ChevronLeft className="w-5 h-5" />이전 10초
        </button>

        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button key={i} onClick={() => setPage(i)}
              className={styles.pageDot}
              style={{
                width: i === safePage ? 20 : 8,
                backgroundColor: i === safePage ? COLORS.primary : "#d1d5db",
              }}
            />
          ))}
        </div>

        <button
          onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
          disabled={safePage === totalPages - 1}
          className="flex items-center gap-1 px-4 py-2 rounded-xl border-2 border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-all font-bold text-small">
          다음 10초<ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-5 mt-3 font-bold flex-wrap" style={{ fontSize: "0.95rem", color: COLORS.muted ?? "#6b7280" }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5" style={{ backgroundColor: COLORS.primary }} />
          <span>심전도 파형</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={styles.legendDashed} />
          <span>심장 박동 위치</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={styles.legendGridBox} />
          <span>심전도 격자 (대/소)</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="14" height="20" viewBox="0 0 14 20">
            <path d="M2 18 L2 8 L7 8 L7 2 L12 2 L12 18" fill="none" stroke={COLORS.muted ?? "#6b7280"} strokeWidth="2" />
          </svg>
          <span>{CALIBRATION_MV}mV 기준선</span>
        </div>
      </div>
    </div>
  );
}

// 병원 모니터 스타일 캘리브레이션 펄스(꺾쇠 모양) — 차트 좌측 상단에 고정 표시
function CalibrationMark() {
  return (
    <div
      style={{
        position: "absolute",
        top: 5,
        left: 4,
        zIndex: 1,
        pointerEvents: "none",
      }}
    >
      <svg width="20" height="40" viewBox="0 0 20 40">
        <path
          d="M2 35 L2 20 L10 20 L10 5 L18 5 L18 35"
          fill="none"
          stroke={COLORS.muted ?? "#9ca3af"}
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}