import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle, Info, Clock, Volume2, Bell, Sparkles } from "lucide-react";
import api from "../api/authApi";

type RiskLevel = "high" | "mid" | "low";

interface MeasurementItem {
  id: string;              // measurement _id
  analysisId: string | null; // analysis._id (분석 완료된 경우만 존재)
  riskLevel: "상" | "중" | "하";
  riskScore: number;
  date: string;             // measuredAt 포맷
  status: string;           // processing / completed / failed
}

const RISK_META = {
  상: { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", label: "위험", icon: AlertTriangle },
  중: { color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", label: "주의", icon: Info },
  하: { color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", label: "양호", icon: CheckCircle },
};

const LEVEL_MAP: Record<string, "상" | "중" | "하"> = { high: "상", mid: "중", low: "하" };

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const date = iso.slice(0, 10);
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${date} ${time}`;
}

// ===== 오늘의 알림 (위험도 '상'만, 당일) =====
interface DailyAlert {
  id: string;
  message: string;
  time: string;
}

function DailyAlertSection() {
  const [alerts, setAlerts] = useState<DailyAlert[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/notifications");
        const today = new Date().toISOString().slice(0, 10);
        const todays = (res.data || []).filter((n: any) =>
          n.level === "high" && (n.createdAt || "").slice(0, 10) === today
        );
        setAlerts(todays.map((n: any) => ({
          id: n._id,
          message: n.message,
          time: (n.createdAt || "").slice(11, 16),
        })));
      } catch (err) {
        console.error("오늘의 알림 조회 실패", err);
      }
    })();
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="w-6 h-6 text-[#DC2626]" />
        <h3 className="text-[#DC2626] font-black" style={{ fontSize: "1.25rem" }}>오늘의 알림</h3>
      </div>
      <div className="space-y-3">
        {alerts.map(a => (
          <div key={a.id} className="bg-[#FEF2F2] border-2 border-[#FECACA] rounded-2xl p-5 flex items-start gap-3">
            <AlertTriangle className="w-7 h-7 flex-shrink-0 mt-0.5" style={{ color: "#DC2626" }} />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-3 py-1 rounded-full text-white font-bold" style={{ backgroundColor: "#DC2626", fontSize: "0.85rem" }}>위험</span>
                <span className="text-gray-400 font-bold ml-auto" style={{ fontSize: "0.9rem" }}>{a.time}</span>
              </div>
              <p className="text-gray-700 font-bold leading-relaxed" style={{ fontSize: "1.05rem" }}>{a.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReportPage() {
  const navigate = useNavigate();
  const [measurements, setMeasurements] = useState<MeasurementItem[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generatedAnalysisId, setGeneratedAnalysisId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/measurements");
        console.log("[디버그] /measurements 응답:", res.data);
        const mapped: MeasurementItem[] = (res.data || [])
          .filter((m: any) => m.status === "completed")
          .map((m: any) => ({
            id: m._id,
            analysisId: m.analysis?._id ?? null,
            riskLevel: LEVEL_MAP[m.analysis?.riskLevel as RiskLevel] ?? "하",
            riskScore: m.analysis?.riskScore ?? 0,
            date: formatDate(m.measuredAt),
            status: m.status,
          }));
        setMeasurements(mapped);
      } catch (err) {
        console.error("측정 목록 조회 실패", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-5 flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-[#0E8080] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (measurements.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-5">
        <div className="mb-7">
          <h1 className="font-black text-[#0A2647]" style={{ fontSize: "2.2rem" }}>내 건강 결과</h1>
        </div>
        <div className="bg-white rounded-2xl p-12 shadow-sm border-2 border-gray-100 text-center">
          <p className="text-gray-400 font-bold" style={{ fontSize: "1.1rem" }}>아직 측정 결과가 없어요. 심전도 파일을 올려 보세요.</p>
        </div>
      </div>
    );
  }

  const item = measurements[Math.min(selectedIdx, measurements.length - 1)];
  const meta = RISK_META[item.riskLevel];
  const RiskIcon = meta.icon;

  const handleGenerateReport = async () => {
    if (!item.analysisId) return;
    try {
      setGenerating(true);
      // TODO: 백엔드와 엔드포인트/파라미터 이름 확정 필요
      const res = await api.post("/reports/generate", {
        analysisId: item.analysisId,
        measurementId: item.id,
      });
      const newAnalysisId = res.data?.analysisId ?? item.analysisId;
      setGeneratedAnalysisId(newAnalysisId);
    } catch (err) {
      console.error("리포트 생성 실패", err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-5">
      <div className="mb-7">
        <h1 className="font-black text-[#0A2647]" style={{ fontSize: "2.2rem" }}>내 건강 결과</h1>
        <p className="text-gray-500 mt-1 font-bold" style={{ fontSize: "1.15rem" }}>인공지능이 분석한 오늘 심장 상태예요.</p>
      </div>

      <DailyAlertSection />

      {/* 측정 결과 목록 */}
      <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-100 mb-6 overflow-hidden">
        <div className="p-5 border-b-2 border-gray-100">
          <h3 className="text-gray-800 font-black" style={{ fontSize: "1.25rem" }}>최근 측정 목록</h3>
        </div>
        {measurements.map((m, i) => {
          const mm = RISK_META[m.riskLevel];
          return (
            <button
              key={m.id}
              onClick={() => setSelectedIdx(i)}
              className={`w-full flex items-center gap-4 p-5 text-left transition-colors border-b-2 border-gray-50 last:border-0 ${selectedIdx === i ? "bg-blue-50" : "hover:bg-gray-50"}`}
              style={{ minHeight: 80 }}
            >
              <div className="w-4 h-16 rounded-full flex-shrink-0" style={{ backgroundColor: mm.color }} />
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <span className="px-4 py-2 rounded-full text-white font-black" style={{ backgroundColor: mm.color, fontSize: "1.15rem" }}>
                    위험도 {m.riskLevel} — {mm.label}
                  </span>
                  <span className="text-gray-600 font-black" style={{ fontSize: "1.1rem" }}>{m.riskScore}점</span>
                </div>
                <p className="text-gray-500 mt-1 flex items-center gap-1 font-bold" style={{ fontSize: "1rem" }}>
                  <Clock className="w-4 h-4" />{m.date}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* 위험도 배너 */}
      <div className="rounded-2xl p-7 mb-5 border-4" style={{ backgroundColor: meta.bg, borderColor: meta.color }}>
        <div className="flex items-center gap-5 mb-5">
          <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: meta.color, width: 88, height: 88 }}>
            <RiskIcon className="text-white" style={{ width: 48, height: 48 }} />
          </div>
          <div className="flex-1">
            <div style={{ color: meta.color, fontSize: "2.2rem", fontWeight: 900, lineHeight: 1.1 }}>
              위험도 {item.riskLevel}
            </div>
            <div style={{ color: meta.color, fontSize: "1.6rem", fontWeight: 800 }}>{meta.label}</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div style={{ color: meta.color, fontSize: "3.5rem", fontWeight: 900, lineHeight: 1 }}>{item.riskScore}</div>
            <div className="text-gray-500 font-bold" style={{ fontSize: "1.1rem" }}>/ 100점</div>
          </div>
        </div>
        <div className="w-full bg-white/80 rounded-full mb-5 overflow-hidden" style={{ height: 20 }}>
          <div className="rounded-full h-full transition-all" style={{ width: `${item.riskScore}%`, backgroundColor: meta.color }} />
        </div>
      </div>

      {/* 리포트 생성: 선택된 측정 결과를 "현재 리포트"로 고정 */}
      <button
        onClick={handleGenerateReport}
        disabled={generating || !item.analysisId}
        className="w-full flex items-center justify-center gap-3 py-5 bg-gradient-to-r from-[#0A2647] to-[#0E8080] text-white rounded-2xl hover:opacity-90 transition-all font-black mb-4 shadow-lg disabled:opacity-50"
        style={{ minHeight: 68, fontSize: "1.2rem" }}
      >
        <Sparkles className="w-6 h-6" />
        {generating ? "리포트 생성 중..." : generatedAnalysisId === item.analysisId ? "이 측정으로 리포트 생성됨" : "이 측정으로 리포트 생성"}
      </button>

      {/* 최근 AI리포트 듣기 버튼 - 리포트 생성 버튼으로 고정된 리포트만 듣기 */}
      <button
        onClick={() => {
          if (!generatedAnalysisId) return;
          navigate("/report-detail", { state: { analysisId: generatedAnalysisId } });
        }}
        disabled={!generatedAnalysisId}
        className="w-full flex items-center justify-center gap-3 py-6 rounded-2xl border-4 border-[#0A2647] text-[#0A2647] bg-white hover:bg-[#0A2647] hover:text-white transition-all font-black mb-6 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-[#0A2647]"
        style={{ minHeight: 80, fontSize: "1.4rem" }}
      >
        <Volume2 style={{ width: 34, height: 34 }} />🔊 최근 AI리포트 듣기
      </button>
      {!generatedAnalysisId && (
        <p className="text-gray-400 font-bold text-center -mt-4 mb-6" style={{ fontSize: "1rem" }}>
          위 "리포트 생성" 버튼을 먼저 눌러 주세요.
        </p>
      )}

      <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-5 text-gray-500 leading-relaxed font-bold" style={{ fontSize: "1rem" }}>
        <Info className="w-5 h-5 inline mr-2 text-gray-400" />
        이 리포트는 참고용이며 의사의 진단을 대신하지 않습니다.
      </div>
    </div>
  );
}