import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, RadialBarChart, RadialBar, PolarAngleAxis
} from "recharts";
import { ZoomIn, ZoomOut, Info } from "lucide-react";
import type { ECGData } from "./UploadPage";

// 더미 ECG (파일 없을 때)
function generateECG(points = 400): Array<{ x: number; y: number; rPeak?: boolean }> {
  const data = [];
  for (let i = 0; i < points; i++) {
    const t = (i / points) * 8;
    const cycle = t % 1;
    const p = 0.15 * Math.exp(-Math.pow((cycle - 0.15) * 20, 2));
    const q = -0.1 * Math.exp(-Math.pow((cycle - 0.38) * 40, 2));
    const r = 1.2 * Math.exp(-Math.pow((cycle - 0.4) * 60, 2));
    const s = -0.2 * Math.exp(-Math.pow((cycle - 0.42) * 50, 2));
    const tw = 0.25 * Math.exp(-Math.pow((cycle - 0.65) * 12, 2));
    const noise = (Math.random() - 0.5) * 0.03;
    const y = p + q + r + s + tw + noise;
    const rPeak = Math.abs(cycle - 0.4) < 0.008 && r > 0.8;
    data.push({ x: Math.round(t * 100) / 100, y: Math.round(y * 100) / 100, rPeak: rPeak || undefined });
  }
  return data;
}

// 실제 데이터에서 R-peak 간단 감지 (threshold 방식)
function detectRPeaks(points: Array<{ x: number; y: number }>, threshold = 0.6): number[] {
  const peaks: number[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    if (
      points[i].y > threshold &&
      points[i].y > points[i - 1].y &&
      points[i].y > points[i + 1].y
    ) {
      // 최소 간격 (0.3초) 이상 벌어져야 새 peak
      if (peaks.length === 0 || points[i].x - peaks[peaks.length - 1] > 0.3) {
        peaks.push(points[i].x);
      }
    }
  }
  return peaks;
}

const anomalies = [
  { time: "06:32", type: "불규칙 심장 박동 의심 (심방세동)", severity: "high", score: 0.82 },
  { time: "11:15", type: "심장이 너무 빠르게 뜀 (빈맥)", severity: "medium", score: 0.61 },
  { time: "15:44", type: "심장이 너무 느리게 뜀 (서맥)", severity: "low", score: 0.35 },
  { time: "21:08", type: "불규칙 심장 박동 의심 (심방세동)", severity: "high", score: 0.78 },
];

const SEVERITY_COLORS = { high: "#DC2626", medium: "#F59E0B", low: "#16A34A" };
const SEVERITY_LABELS = { high: "상", medium: "중", low: "하" };

interface VisualizationPageProps {
  ecgData?: ECGData | null;
}

export function VisualizationPage({ ecgData }: VisualizationPageProps) {
  const [period, setPeriod] = useState("일");
  const [zoom, setZoom] = useState(1);
  const [popup, setPopup] = useState<(typeof anomalies)[0] | null>(null);

  const dummyData = useMemo(() => generateECG(400), []);

  // 실제 데이터 있으면 사용, 없으면 더미
  const chartData = useMemo(() => {
    if (ecgData && ecgData.points.length > 0) {
      return ecgData.points.map(p => ({ x: p.x, y: p.y }));
    }
    return dummyData;
  }, [ecgData, dummyData]);

  const rPeaks = useMemo(() => {
    if (ecgData && ecgData.points.length > 0) {
      // 실제 데이터의 최대값 기준으로 threshold 동적 설정
      const max = Math.max(...ecgData.points.map(p => p.y));
      return detectRPeaks(ecgData.points, max * 0.6);
    }
    return dummyData.filter(d => d.rPeak).map(d => d.x);
  }, [ecgData, dummyData]);

  const riskScore = 72;
  const visibleCount = Math.floor(chartData.length / zoom);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="font-bold text-[#0A2647]" style={{ fontSize: "1.9rem" }}>심전도 분석 결과</h1>
        {ecgData ? (
          <p className="text-[#0E8080] mt-2 font-bold" style={{ fontSize: "1.1rem" }}>
            📁 {ecgData.fileName} · {ecgData.points.length.toLocaleString()}개 샘플 · {ecgData.sampleRate}Hz
          </p>
        ) : (
          <p className="text-gray-600 mt-2 font-bold" style={{ fontSize: "1.1rem" }}>
            심장이 뛸 때 나오는 전기 신호를 그래프로 나타낸 것입니다.
          </p>
        )}
      </div>

      {/* 파일 없을 때 안내 */}
      {!ecgData && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 mb-6">
          <p className="text-amber-800 font-bold" style={{ fontSize: "1.05rem" }}>
            📂 현재 샘플 데이터를 보여주고 있습니다. 실제 파형을 보려면 먼저 <strong>기기 데이터 올리기</strong>에서 파일을 업로드하세요.
          </p>
        </div>
      )}

      {/* 기간 탭 */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {["일", "주", "월"].map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-8 py-3 rounded-lg transition-all font-bold ${period === p ? "bg-white shadow text-[#0A2647]" : "text-gray-500 hover:text-gray-700"}`}
            style={{ minHeight: 52, fontSize: "1.1rem" }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* ECG 파형 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[#0A2647] font-bold" style={{ fontSize: "1.3rem" }}>심장 뛰는 모양 그래프</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setZoom(z => Math.min(z + 0.5, 4))}
              className="p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              style={{ minHeight: 52, minWidth: 52 }}
            >
              <ZoomIn className="w-6 h-6 text-gray-600" />
            </button>
            <button
              onClick={() => setZoom(z => Math.max(z - 0.5, 0.5))}
              className="p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              style={{ minHeight: 52, minWidth: 52 }}
            >
              <ZoomOut className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData.slice(0, visibleCount)}
              margin={{ top: 5, right: 10, left: -30, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="x" tick={{ fontSize: 12, fontWeight: 700 }} label={{ value: "시간 (초)", position: "insideBottomRight", offset: 0, fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12, fontWeight: 700 }} />
              <Tooltip formatter={(val: number) => [`${val.toFixed(3)} mV`, "진폭"]} labelFormatter={l => `${l}초`} />
              {rPeaks
                .filter(x => x <= (chartData[visibleCount - 1]?.x ?? Infinity))
                .map(x => (
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

      {/* 위험도 게이지 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <h3 className="text-[#0A2647] font-bold mb-4" style={{ fontSize: "1.3rem" }}>위험도 점수 (0~100점, 높을수록 위험)</h3>
        <div className="flex flex-col items-center">
          <div style={{ height: 200, width: "100%", maxWidth: 320, margin: "0 auto" }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart cx="50%" cy="80%" innerRadius="60%" outerRadius="90%" startAngle={180} endAngle={0}
                data={[{ value: riskScore, fill: riskScore >= 70 ? "#DC2626" : riskScore >= 40 ? "#F59E0B" : "#16A34A" }]}>
                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                <RadialBar dataKey="value" cornerRadius={10} background={{ fill: "#f0f0f0" }} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center -mt-8">
            <div style={{ fontSize: "2.2rem", fontWeight: 800, color: "#DC2626" }}>{riskScore}</div>
            <div className="text-gray-500 font-bold" style={{ fontSize: "1rem" }}>/ 100점</div>
            <div className="mt-2 px-4 py-1.5 rounded-full text-white font-bold bg-red-600" style={{ fontSize: "1rem" }}>위험도 상</div>
          </div>
        </div>
      </div>

      {/* 이상 신호 타임라인 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-[#0A2647] font-bold mb-5" style={{ fontSize: "1.3rem" }}>오늘 이상한 신호가 감지된 시간대</h3>
        <div className="relative">
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200" />
          <div className="space-y-5">
            {anomalies.map((a, i) => (
              <div key={i} className="flex items-center gap-4 cursor-pointer group" onClick={() => setPopup(popup?.time === a.time ? null : a)}>
                <div
                  className="w-5 h-5 rounded-full border-2 border-white shadow flex-shrink-0 z-10 group-hover:scale-110 transition-transform"
                  style={{ backgroundColor: SEVERITY_COLORS[a.severity as keyof typeof SEVERITY_COLORS], marginLeft: 16 }}
                />
                <div className="flex-1 flex items-center gap-3 flex-wrap">
                  <span className="text-gray-500 font-bold w-14" style={{ fontSize: "1rem" }}>{a.time}</span>
                  <span className="text-gray-700 font-bold" style={{ fontSize: "1.05rem" }}>{a.type}</span>
                  <span className="px-3 py-1 rounded-full text-white font-bold" style={{ backgroundColor: SEVERITY_COLORS[a.severity as keyof typeof SEVERITY_COLORS], fontSize: "0.95rem" }}>
                    {SEVERITY_LABELS[a.severity as keyof typeof SEVERITY_LABELS]}
                  </span>
                  <span className="text-gray-400 font-bold ml-auto" style={{ fontSize: "0.95rem" }}>위험 신호 강도 {Math.round(a.score * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {popup && (
          <div className="mt-5 p-5 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-start gap-3">
              <Info className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-blue-700 font-bold" style={{ fontSize: "1.1rem" }}>{popup.time} — {popup.type}</div>
                <div className="text-blue-600 font-bold mt-1" style={{ fontSize: "1rem" }}>
                  위험 신호 강도: {Math.round(popup.score * 100)}% · 자세한 결과는 '보호자용 리포트'에서 확인하세요.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-5 text-gray-600 font-bold" style={{ fontSize: "1rem" }}>
        <Info className="w-5 h-5 inline mr-2 text-gray-400" />
        이 서비스는 의료기기가 아니며 의사의 진단을 대신하지 않습니다.
      </div>
    </div>
  );
}