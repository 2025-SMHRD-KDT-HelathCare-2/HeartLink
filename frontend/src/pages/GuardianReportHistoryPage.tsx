import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, FileText, CalendarDays, BarChart2, Clock } from "lucide-react";
import api from "../api/authApi";

type ReportPeriod = "daily" | "weekly";

interface ReportItem {
  id: string;
  reportPeriod: ReportPeriod;
  riskLevel: "상" | "중" | "하";
  riskScore: number;
  createdAt: string;
}

const LEVEL_MAP: Record<string, "상" | "중" | "하"> = { high: "상", mid: "중", low: "하" };

const RISK_META = {
  상: { color: "#DC2626", label: "위험" },
  중: { color: "#D97706", label: "주의" },
  하: { color: "#16A34A", label: "양호" },
};

// ===== 임시 더미 (백엔드 완성 시 제거) =====
const DUMMY: ReportItem[] = [
  { id: "r1", reportPeriod: "daily", riskLevel: "상", riskScore: 78, createdAt: "2026-06-24T09:32:00" },
  { id: "r2", reportPeriod: "weekly", riskLevel: "중", riskScore: 52, createdAt: "2026-06-23T10:00:00" },
  { id: "r3", reportPeriod: "daily", riskLevel: "하", riskScore: 22, createdAt: "2026-06-22T08:15:00" },
  { id: "r4", reportPeriod: "weekly", riskLevel: "하", riskScore: 18, createdAt: "2026-06-16T10:00:00" },
];

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${iso.slice(0, 10)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function GuardianReportHistoryPage() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "daily" | "weekly">("all");

  useEffect(() => {
    (async () => {
      try {
        // 백엔드 완성 시 주석 해제
        // const res = await api.get(`/reports/guardian/${userId}`);
        // const mapped = (res.data || []).map((r: any) => ({
        //   id: r._id,
        //   reportPeriod: r.reportPeriod as ReportPeriod,
        //   riskLevel: LEVEL_MAP[r.riskLevel] ?? "하",
        //   riskScore: r.riskScore ?? 0,
        //   createdAt: r.createdAt,
        // }));
        // setReports(mapped);
        await new Promise(r => setTimeout(r, 400));
        setReports(DUMMY);
      } catch (err) {
        console.error("리포트 목록 조회 실패", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const filtered = filter === "all" ? reports : reports.filter(r => r.reportPeriod === filter);

  return (
    <div className="min-h-screen bg-[#F4F7FA]">
      <header className="bg-[#0A2647] text-white px-5 py-4 flex items-center gap-3 sticky top-0 z-20 shadow-lg">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          <div>
            <div className="font-black" style={{ fontSize: "1.3rem" }}>리포트 기록</div>
            <div className="text-white/60 font-bold" style={{ fontSize: "0.9rem" }}>일간 · 주간 리포트 모아보기</div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-5">
        {/* 필터 탭 */}
        <div className="flex bg-white rounded-xl p-1 mb-5 shadow-sm border border-gray-100">
          {([["all", "전체"], ["daily", "일간"], ["weekly", "주간"]] as const).map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-lg transition-all font-bold ${
                filter === val ? "bg-[#0A2647] text-white shadow" : "text-gray-500 hover:bg-gray-50"
              }`} style={{ fontSize: "1rem" }}>
              {val === "daily" && <CalendarDays className="w-4 h-4" />}
              {val === "weekly" && <BarChart2 className="w-4 h-4" />}
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-[#0E8080] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
            <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400 font-bold" style={{ fontSize: "1.1rem" }}>리포트가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => {
              const meta = RISK_META[r.riskLevel];
              const isDaily = r.reportPeriod === "daily";
              return (
                <button key={r.id}
                  onClick={() => navigate(`/guardian-report-detail/${userId}`, { state: { reportId: r.id, type: r.reportPeriod } })}
                  className="w-full bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 text-left hover:bg-gray-50 transition-colors">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: isDaily ? "#0E8080" : "#0A2647" }}>
                    {isDaily
                      ? <CalendarDays className="w-6 h-6 text-white" />
                      : <BarChart2 className="w-6 h-6 text-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-black text-gray-800" style={{ fontSize: "1.1rem" }}>
                        {isDaily ? "일간" : "주간"} 리포트
                      </span>
                      <span className="px-3 py-1 rounded-full text-white font-bold"
                        style={{ backgroundColor: meta.color, fontSize: "0.85rem" }}>
                        {meta.label} {r.riskScore}점
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-400 font-bold" style={{ fontSize: "0.9rem" }}>
                      <Clock className="w-3.5 h-3.5" />{formatDate(r.createdAt)}
                    </div>
                  </div>
                  <div className="w-2 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
