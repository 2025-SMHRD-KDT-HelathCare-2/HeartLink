import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle, Info, Clock, Volume2, Bell } from "lucide-react";
import api from "../api/authApi";


interface ReportItem {
  id: string;             // _id
  analysisId: string;     // TTS 호출용
  riskLevel: "상" | "중" | "하";
  riskScore: number;
  summary: string;        // reportTextUser
  action: string;         // recommendedAction (단일 문자열)
  date: string;           // createdAt
}

const RISK_META = {
  상: { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", label: "위험", icon: AlertTriangle },
  중: { color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", label: "주의", icon: Info },
  하: { color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", label: "양호", icon: CheckCircle },
};


function formatDate(iso: string) {
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
          n.level === "상" && (n.createdAt || "").slice(0, 10) === today
        );
        setAlerts(todays.map((n: any) => ({
          id: n.id,
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
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/reports");
        const mapped: ReportItem[] = (res.data || []).map((r: any) => ({
          id: r._id,
          analysisId: r.analysisId?._id ?? r.analysisId,
          riskScore: r.analysisId?.riskScore ?? r.riskScore ?? 0,
          riskLevel: (() => { const s = r.analysisId?.riskScore ?? r.riskScore ?? 0; return s >= 70 ? "상" : s >= 40 ? "중" : "하"; })(),
          summary: r.report_text_user ?? r.reportTextUser ?? "",
          action: r.recommendedAction ?? "",
          date: formatDate(r.createdAt),
        }));
        setReports(mapped);
      } catch (err) {
        console.error("리포트 목록 조회 실패", err);
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

  if (reports.length === 0) {
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

  const report = reports[Math.min(selectedIdx, reports.length - 1)];
  const meta = RISK_META[report.riskLevel];
  const RiskIcon = meta.icon;

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
          const m = RISK_META[r.riskLevel];
          return (
            <button
              key={r.id}
              onClick={() => setSelectedIdx(i)}
              className={`w-full flex items-center gap-4 p-5 text-left transition-colors border-b-2 border-gray-50 last:border-0 ${selectedIdx === i ? "bg-blue-50" : "hover:bg-gray-50"}`}
              style={{ minHeight: 80 }}
            >
              <div className="w-4 h-16 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <span className="px-4 py-2 rounded-full text-white font-black" style={{ backgroundColor: m.color, fontSize: "1.15rem" }}>
                    위험도 {r.riskLevel} — {m.label}
                  </span>
                  <span className="text-gray-600 font-black" style={{ fontSize: "1.1rem" }}>{r.riskScore}점</span>
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
      <div className="rounded-2xl p-7 mb-5 border-4" style={{ backgroundColor: meta.bg, borderColor: meta.color }}>
        <div className="flex items-center gap-5 mb-5">
          <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: meta.color, width: 88, height: 88 }}>
            <RiskIcon className="text-white" style={{ width: 48, height: 48 }} />
          </div>
          <div className="flex-1">
            <div style={{ color: meta.color, fontSize: "2.2rem", fontWeight: 900, lineHeight: 1.1 }}>
              위험도 {report.riskLevel}
            </div>
            <div style={{ color: meta.color, fontSize: "1.6rem", fontWeight: 800 }}>{meta.label}</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div style={{ color: meta.color, fontSize: "3.5rem", fontWeight: 900, lineHeight: 1 }}>{report.riskScore}</div>
            <div className="text-gray-500 font-bold" style={{ fontSize: "1.1rem" }}>/ 100점</div>
          </div>
        </div>
        <div className="w-full bg-white/80 rounded-full mb-5 overflow-hidden" style={{ height: 20 }}>
          <div className="rounded-full h-full transition-all" style={{ width: `${report.riskScore}%`, backgroundColor: meta.color }} />
        </div>
        <p className="text-gray-800 leading-relaxed font-black" style={{ fontSize: "1.4rem" }}>{report.summary}</p>
      </div>

      {/* 최근 AI리포트 듣기 버튼 - 상세 페이지로 이동 (analysisId 전달) */}
      <button
        onClick={() => navigate("/report-detail", { state: { analysisId: report.analysisId } })}
        className="w-full flex items-center justify-center gap-3 py-6 rounded-2xl border-4 border-[#0A2647] text-[#0A2647] bg-white hover:bg-[#0A2647] hover:text-white transition-all font-black mb-6"
        style={{ minHeight: 80, fontSize: "1.4rem" }}
      >
        <Volume2 style={{ width: 34, height: 34 }} />🔊 최근 AI리포트 듣기
      </button>

      {/* 지금 하셔야 할 일 (단일 문자열) */}
      {report.action && (
        <div className="bg-white rounded-2xl p-7 shadow-sm border-2 border-gray-100 mb-6">
          <h3 className="text-[#0A2647] font-black mb-5" style={{ fontSize: "1.6rem" }}>지금 하셔야 할 일</h3>
          <div className="flex items-start gap-4">
            <span className="rounded-full flex items-center justify-center text-white font-black flex-shrink-0" style={{ backgroundColor: meta.color, minWidth: 48, width: 48, height: 48, fontSize: "1.2rem" }}>!</span>
            <span className="text-gray-800 leading-relaxed font-black" style={{ fontSize: "1.3rem" }}>{report.action}</span>
          </div>
        </div>
      )}

      <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-5 text-gray-500 leading-relaxed font-bold" style={{ fontSize: "1rem" }}>
        <Info className="w-5 h-5 inline mr-2 text-gray-400" />
        이 리포트는 참고용이며 의사의 진단을 대신하지 않습니다.
      </div>
    </div>
  );
}