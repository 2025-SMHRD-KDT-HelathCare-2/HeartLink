import { useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Info } from "lucide-react";
import { ECGChart } from "../components/charts/ECGChart";
import { RiskGauge } from "../components/charts/RiskGauge";
import { AnomalyTimeline } from "../components/charts/AnomalyTimeline";

interface ECGResponse {
  ecgPoints: Array<{ x: number; y: number }>;
  rPeaks: number[];
  sampleRate: number;
  fileName: string;
}

// 더미 데이터 (백엔드 연결 전 샘플)
function generateDummyECG(points = 400): Array<{ x: number; y: number }> {
  const data = [];
  for (let i = 0; i < points; i++) {
    const t = (i / points) * 8;
    const cycle = t % 1;
    const p  =  0.15 * Math.exp(-Math.pow((cycle - 0.15) * 20, 2));
    const q  = -0.10 * Math.exp(-Math.pow((cycle - 0.38) * 40, 2));
    const r  =  1.20 * Math.exp(-Math.pow((cycle - 0.40) * 60, 2));
    const s  = -0.20 * Math.exp(-Math.pow((cycle - 0.42) * 50, 2));
    const tw =  0.25 * Math.exp(-Math.pow((cycle - 0.65) * 12, 2));
    const noise = (Math.random() - 0.5) * 0.03;
    data.push({ x: Math.round(t * 100) / 100, y: Math.round((p+q+r+s+tw+noise) * 100) / 100 });
  }
  return data;
}

function detectRPeaks(points: Array<{ x: number; y: number }>, threshold = 0.6): number[] {
  const peaks: number[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    if (points[i].y > threshold && points[i].y > points[i-1].y && points[i].y > points[i+1].y) {
      if (peaks.length === 0 || points[i].x - peaks[peaks.length - 1] > 0.3) {
        peaks.push(points[i].x);
      }
    }
  }
  return peaks;
}

const DUMMY_ANOMALIES = [
  { time: "06:32", type: "불규칙 심장 박동 의심", severity: "high"   as const, score: 0.82 },
  { time: "11:15", type: "심장이 너무 빠르게 뜀", severity: "medium" as const, score: 0.61 },
  { time: "15:44", type: "심장이 너무 느리게 뜀", severity: "low"    as const, score: 0.35 },
];

export function VisualizationPage() {
  const location = useLocation();
  const ecgData = location.state?.ecgData as ECGResponse | undefined;
  const [zoom, setZoom] = useState(1);

  const dummyData = useMemo(() => generateDummyECG(400), []);

  const chartData = useMemo(() => {
    if (ecgData?.ecgPoints?.length) return ecgData.ecgPoints;
    return dummyData;
  }, [ecgData, dummyData]);

  const rPeaks = useMemo(() => {
    if (ecgData?.rPeaks?.length) return ecgData.rPeaks;
    return detectRPeaks(dummyData, 0.6);
  }, [ecgData, dummyData]);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="font-black text-[#0A2647]" style={{ fontSize: "2rem" }}>심전도 그래프</h1>
        {ecgData ? (
          <p className="text-[#0E8080] mt-2 font-bold" style={{ fontSize: "1.1rem" }}>
            📁 {ecgData.fileName} · {ecgData.ecgPoints.length.toLocaleString()}개 샘플 · {ecgData.sampleRate}Hz
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
            📂 현재 샘플 데이터입니다. 실제 파형을 보려면 <strong>파일 올리기</strong>에서 CSV 파일을 업로드하세요.
          </p>
        </div>
      )}

      <div className="space-y-6">
        <ECGChart
          data={chartData}
          rPeaks={rPeaks}
          zoom={zoom}
          onZoomIn={() => setZoom(z => Math.min(z + 0.5, 4))}
          onZoomOut={() => setZoom(z => Math.max(z - 0.5, 0.5))}
        />
        <RiskGauge score={72} />
        <AnomalyTimeline anomalies={DUMMY_ANOMALIES} />
      </div>

      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-5 text-gray-500 font-bold" style={{ fontSize: "1rem" }}>
        <Info className="w-5 h-5 inline mr-2 text-gray-400" />
        이 서비스는 의료기기가 아니며 의사의 진단을 대신하지 않습니다.
      </div>
    </div>
  );
}