import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, Activity, Heart, AlertTriangle, Clock } from "lucide-react";
import { toKSTDatetime } from "../utils/formatKST";
import api from "../api/authApi";
import { ECGChart } from "../components/charts/ECGChart";
import { RiskGauge } from "../components/charts/RiskGauge";

interface Analysis {
  riskScore: number;
  riskLevel: "high" | "mid" | "low";
  heartRate: number;
  arrhythmiaClass: string;
  arrhythmiaProb: number;
  afDetected: boolean;
  afProb: number;
  hrvRmssd: number;
  hrvSdnn: number;
  arrhythmiaCount: number;
  analyzedAt: string;
}

interface MeasurementDetail {
  _id: string;
  fileName: string;
  measuredAt: string;
  samplingRate: number;
  ecgWaveformLite: number[];
  rPeaks: number[];
  status: string;
  analysis: Analysis | null;
}

const RISK_META = {
  high: { label: "위험", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
  mid:  { label: "주의", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  low:  { label: "양호", color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0" },
};

const CLASS_LABEL: Record<string, string> = {
  N: "정상 (N)", SVEB: "상심실성 이소박동 (SVEB)",
  VEB: "심실성 이소박동 (VEB)", F: "융합박동 (F)", Q: "판별불가 (Q)",
};

export function MeasurementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const patientUserId = (location.state as any)?.patientUserId as string | undefined;
  const [data, setData] = useState<MeasurementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const url = patientUserId
          ? `/measurements/patient/${patientUserId}/${id}`
          : `/measurements/${id}`;
        const res = await api.get(url);
        setData(res.data);
      } catch {
        setError("측정 데이터를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, patientUserId]);

  // 1번: 기본값 250으로 수정
  const sampleRate = data?.samplingRate || 250;

  const chartData = useMemo(() => {
    if (!data?.ecgWaveformLite?.length) return [];
    return data.ecgWaveformLite.map((y, i) => ({
      x: Math.round((i / sampleRate) * 1000) / 1000,
      y,
    }));
  }, [data, sampleRate]);

  const rPeakTimes = useMemo(() => {
    if (!data?.rPeaks?.length) return [];
    const maxIdx = data.ecgWaveformLite?.length || 0;
    const looksLikeIndex = data.rPeaks.every(v => Number.isInteger(v) && v <= maxIdx);
    if (looksLikeIndex) {
      return data.rPeaks.map(idx => Math.round((idx / sampleRate) * 1000) / 1000);
    }
    return data.rPeaks;
  }, [data, sampleRate]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6 flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-[#0E8080] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 font-bold mb-6">
          <ChevronLeft className="w-5 h-5" />뒤로가기
        </button>
        <p className="text-red-500 font-bold">{error || "데이터가 없습니다."}</p>
      </div>
    );
  }

  const analysis = data.analysis;
  const riskLevel = (analysis?.riskLevel ?? "low") as "high" | "mid" | "low";
  const meta = RISK_META[riskLevel];
  const measuredDate = toKSTDatetime(data.measuredAt ?? "");

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 font-bold mb-4"
          style={{ fontSize: "1rem" }}>
          <ChevronLeft className="w-5 h-5" />지난 기록으로
        </button>
        <h1 className="font-black text-[#0A2647]" style={{ fontSize: "1.9rem" }}>측정 상세</h1>
        <div className="flex items-center gap-2 text-gray-500 font-bold mt-1" style={{ fontSize: "1rem" }}>
          <Clock className="w-4 h-4" />{measuredDate}
        </div>
      </div>

      {/* 위험도 배너 */}
      {analysis && (
        <div className="rounded-2xl p-6 border-2" style={{ backgroundColor: meta.bg, borderColor: meta.border }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8" style={{ color: meta.color }} />
              <div>
                <div style={{ color: meta.color, fontSize: "1.6rem", fontWeight: 900 }}>
                  위험도 {riskLevel === "high" ? "상" : riskLevel === "mid" ? "중" : "하"} — {meta.label}
                </div>
                <div className="text-gray-500 font-bold mt-0.5" style={{ fontSize: "0.95rem" }}>
                  {data.fileName}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div style={{ color: meta.color, fontSize: "2.8rem", fontWeight: 900, lineHeight: 1 }}>
                {analysis.riskScore ?? 0}
              </div>
              <div className="text-gray-400 font-bold" style={{ fontSize: "0.95rem" }}>/ 100점</div>
            </div>
          </div>
          <div className="w-full bg-white/70 rounded-full h-3 mt-4 overflow-hidden">
            <div className="h-3 rounded-full transition-all"
              style={{ width: `${analysis.riskScore ?? 0}%`, backgroundColor: meta.color }} />
          </div>
        </div>
      )}

      {/* ECG 파형 — 2번: sampleRate prop 추가 */}
      {chartData.length > 0 ? (
        <div>
          <div className="text-gray-500 font-bold mb-2" style={{ fontSize: "0.95rem" }}>
            {chartData.length.toLocaleString()}개 샘플 · {sampleRate}Hz
          </div>
          <ECGChart data={chartData} rPeaks={rPeakTimes} zoom={1} sampleRate={sampleRate} />
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
          <Activity className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          <p className="text-gray-400 font-bold" style={{ fontSize: "1rem" }}>파형 데이터가 없습니다.</p>
        </div>
      )}

      {/* 위험도 게이지 */}
      {analysis?.riskScore != null && (
        <RiskGauge score={analysis.riskScore} riskLevel={riskLevel} />
      )}

      {/* 분석 수치 — HRV RMSSD, HRV SDNN 제거 */}
      {analysis && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-5">
            <Heart className="w-5 h-5 text-[#0E8080]" />
            <h3 className="text-[#0A2647] font-bold" style={{ fontSize: "1.2rem" }}>분석 수치</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="심박수" value={`${analysis.heartRate ?? 0} bpm`} />
            <StatCard label="부정맥 분류" value={CLASS_LABEL[analysis.arrhythmiaClass] ?? analysis.arrhythmiaClass ?? "—"} small />
            <StatCard label="부정맥 발생 횟수" value={`${analysis.arrhythmiaCount ?? 0}회`} />
            <StatCard
              label="심방세동 (AF)"
              value={analysis.afDetected ? `감지됨 (${(analysis.afProb * 100).toFixed(1)}%)` : "미감지"}
              highlight={analysis.afDetected}
            />
          </div>
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-500 font-bold" style={{ fontSize: "0.95rem" }}>
        이 결과는 참고용이며 의사의 진단을 대신하지 않습니다.
      </div>
    </div>
  );
}

function StatCard({ label, value, small, highlight }: {
  label: string; value: string; small?: boolean; highlight?: boolean;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <p className="text-gray-500 font-bold mb-1" style={{ fontSize: "0.9rem" }}>{label}</p>
      <p className={`font-black ${highlight ? "text-red-600" : "text-[#0A2647]"}`}
        style={{ fontSize: small ? "0.9rem" : "1.15rem" }}>
        {value}
      </p>
    </div>
  );
}