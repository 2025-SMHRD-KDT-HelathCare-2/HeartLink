import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle, Info, Clock, Volume2, Bell, FileText } from "lucide-react";
import api from "../api/authApi";
import { getMyNotifications, type AppNotification } from "../api/notificationApi";

const LEVEL_MAP: Record<string, "상" | "중" | "하"> = { high: "상", mid: "중", low: "하" };

const RISK_CONFIG = {
  상: { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", label: "위험", icon: AlertTriangle },
  중: { color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", label: "주의", icon: Info },
  하: { color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", label: "양호", icon: CheckCircle },
};

interface ReportItem {
  id: string;
  riskLevel: "상" | "중" | "하";
  riskScore: number | null;
  reportTextUser: string;
  recommendedAction: string;
  date: string;
}

function useTTS() {
  const [playing, setPlaying] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    u.rate = 0.85;
    u.pitch = 1;
    u.onstart = () => setPlaying(true);
    u.onend = () => setPlaying(false);
    u.onerror = () => setPlaying(false);
    utteranceRef.current = u;
    window.speechSynthesis.speak(u);
  };

  const stop = () => {
    window.speechSynthesis.cancel();
    setPlaying(false);
  };

  useEffect(() => () => { window.speechSynthesis.cancel(); }, []);
  return { playing, speak, stop };
}

function DailyAlertSection() {
  const [alerts, setAlerts] = useState<AppNotification[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const all = await getMyNotifications();
        const today = new Date().toISOString().slice(0, 10);
        setAlerts(all.filter(a => a.level === "상" && a.createdAt.slice(0, 10) === today));
      } catch {
        // 알림 조회 실패 시 표시 안 함
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
            <AlertTriangle className="w-7 h-7 shrink-0 mt-0.5" style={{ color: "#DC2626" }} />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-3 py-1 rounded-full text-white font-bold" style={{ backgroundColor: "#DC2626", fontSize: "0.85rem" }}>위험</span>
                <span className="text-gray-400 font-bold ml-auto" style={{ fontSize: "0.9rem" }}>
                  {new Date(a.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                </span>
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
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const { stop } = useTTS();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/reports");
        const items: ReportItem[] = res.data.map((r: any) => {
          const d = new Date(r.createdAt);
          return {
            id: r._id,
            riskLevel: LEVEL_MAP[r.riskLevel] ?? "하",
            riskScore: r.analysisId?.riskScore ?? null,
            reportTextUser: r.reportTextUser ?? "",
            recommendedAction: r.recommendedAction ?? "",
            date: `${d.toISOString().slice(0, 10)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
          };
        });
        setReports(items);
      } catch (err) {
        console.error("리포트 조회 실패", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-[#0E8080] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 font-bold" style={{ fontSize: "1.1rem" }}>결과를 불러오고 있어요...</p>
        </div>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-5">
        <div className="mb-7">
          <h1 className="font-black text-[#0A2647]" style={{ fontSize: "2.2rem" }}>내 건강 결과</h1>
          <p className="text-gray-500 mt-1 font-bold" style={{ fontSize: "1.15rem" }}>인공지능이 분석한 오늘 심장 상태예요.</p>
        </div>
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
          <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 font-bold" style={{ fontSize: "1.1rem" }}>아직 분석 결과가 없어요.</p>
          <p className="text-gray-400 font-bold mt-1" style={{ fontSize: "1rem" }}>심전도 파일을 업로드해 보세요.</p>
        </div>
      </div>
    );
  }

  const report = reports[selectedIdx];
  const config = RISK_CONFIG[report.riskLevel];
  const RiskIcon = config.icon;

  return (
    <div className="max-w-2xl mx-auto p-5">
      <div className="mb-7">
        <h1 className="font-black text-[#0A2647]" style={{ fontSize: "2.2rem" }}>내 건강 결과</h1>
        <p className="text-gray-500 mt-1 font-bold" style={{ fontSize: "1.15rem" }}>인공지능이 분석한 오늘 심장 상태예요.</p>
      </div>

      <DailyAlertSection />

      {/* 리포트 목록 */}
      <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-100 mb-6 overflow-hidden">
        <div className="p-5 border-b-2 border-gray-100">
          <h3 className="text-gray-800 font-black" style={{ fontSize: "1.25rem" }}>최근 결과 목록</h3>
        </div>
        {reports.map((r, i) => {
          const cfg = RISK_CONFIG[r.riskLevel];
          return (
            <button
              key={r.id}
              onClick={() => { setSelectedIdx(i); stop(); }}
              className={`w-full flex items-center gap-4 p-5 text-left transition-colors border-b-2 border-gray-50 last:border-0 ${selectedIdx === i ? "bg-blue-50" : "hover:bg-gray-50"}`}
              style={{ minHeight: 80 }}
            >
              <div className="w-4 h-16 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <span className="px-4 py-2 rounded-full text-white font-black" style={{ backgroundColor: cfg.color, fontSize: "1.15rem" }}>
                    위험도 {r.riskLevel} — {cfg.label}
                  </span>
                  {r.riskScore != null && (
                    <span className="text-gray-600 font-black" style={{ fontSize: "1.1rem" }}>{r.riskScore}점</span>
                  )}
                </div>
                <p className="text-gray-500 mt-1 flex items-center gap-1 font-bold" style={{ fontSize: "1rem" }}>
                  <Clock className="w-4 h-4" />{r.date}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* 위험도 배너 */}
      <div className="rounded-2xl p-7 mb-5 border-4" style={{ backgroundColor: config.bg, borderColor: config.color }}>
        <div className="flex items-center gap-5 mb-5">
          <div className="rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: config.color, width: 88, height: 88 }}>
            <RiskIcon className="text-white" style={{ width: 48, height: 48 }} />
          </div>
          <div className="flex-1">
            <div style={{ color: config.color, fontSize: "2.2rem", fontWeight: 900, lineHeight: 1.1 }}>
              위험도 {report.riskLevel}
            </div>
            <div style={{ color: config.color, fontSize: "1.6rem", fontWeight: 800 }}>{config.label}</div>
          </div>
          {report.riskScore != null && (
            <div className="text-right shrink-0">
              <div style={{ color: config.color, fontSize: "3.5rem", fontWeight: 900, lineHeight: 1 }}>{report.riskScore}</div>
              <div className="text-gray-500 font-bold" style={{ fontSize: "1.1rem" }}>/ 100점</div>
            </div>
          )}
        </div>
        {report.riskScore != null && (
          <div className="w-full bg-white/80 rounded-full mb-5 overflow-hidden" style={{ height: 20 }}>
            <div className="rounded-full h-full transition-all" style={{ width: `${report.riskScore}%`, backgroundColor: config.color }} />
          </div>
        )}
        <p className="text-gray-800 leading-relaxed font-black" style={{ fontSize: "1.4rem" }}>{report.recommendedAction}</p>
      </div>

      {/* 최근 AI리포트 듣기 버튼 */}
      <button
        onClick={() => navigate("/report-detail")}
        className="w-full flex items-center justify-center gap-3 py-6 rounded-2xl border-4 border-[#0A2647] text-[#0A2647] bg-white hover:bg-[#0A2647] hover:text-white transition-all font-black mb-6"
        style={{ minHeight: 80, fontSize: "1.4rem" }}
      >
        <Volume2 style={{ width: 34, height: 34 }} />🔊 최근 AI리포트 듣기
      </button>

      {/* AI 리포트 내용 */}
      {report.reportTextUser && (
        <div className="bg-white rounded-2xl p-7 shadow-sm border-2 border-gray-100 mb-6">
          <h3 className="text-[#0A2647] font-black mb-4" style={{ fontSize: "1.6rem" }}>AI 건강 안내</h3>
          <p className="text-gray-800 leading-relaxed font-bold" style={{ fontSize: "1.25rem" }}>
            {report.reportTextUser}
          </p>
        </div>
      )}

      <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-5 text-gray-500 leading-relaxed font-bold" style={{ fontSize: "1rem" }}>
        <Info className="w-5 h-5 inline mr-2 text-gray-400" />
        이 결과는 참고용이에요. 이상이 있으면 꼭 병원을 방문하세요.
      </div>
    </div>
  );
}
