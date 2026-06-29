// ============================================================================
// 보호자 리포트 기록 목록 (특정 사용자 일간/주간 모아보기)
// - ReportHistoryListPage 와 동일 패턴: 위험도 색 토큰화 + 헤더/배경 토큰
// ============================================================================
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, FileText, CalendarDays, BarChart2, Clock } from "lucide-react";
import api from "../api/authApi";
import { COLORS } from "../styles/tokens";

type ReportPeriod = "daily" | "weekly";

interface ReportItem {
  id: string;
  memberName: string;
  reportPeriod: ReportPeriod;
  riskLevel: "상" | "중" | "하";
  riskScore: number;
  createdAt: string;
  status: string;
}

const LEVEL_MAP: Record<string, "상" | "중" | "하"> = { high: "상", mid: "중", low: "하" };

// 위험도 색상 → tokens.ts(COLORS)로 일원화
const RISK_META = {
  상: { color: COLORS.danger,  label: "위험" },
  중: { color: COLORS.warning, label: "주의" },
  하: { color: COLORS.safe,    label: "양호" },
};

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
        const res = await api.get(`/reports/patient/${userId}`);
        const mapped: ReportItem[] = (res.data || [])
          .filter((r: any) => r.status === "completed")
          .map((r: any) => ({
            id: r._id,
            memberName: r.memberName ?? "",
            reportPeriod: r.reportPeriod as ReportPeriod,
            riskLevel: LEVEL_MAP[r.maxRiskLevel] ?? "하",
            riskScore: 0, // 목록엔 riskScore 없음, 상세에서 확인
            createdAt: r.createdAt,
            status: r.status,
          }));
        setReports(mapped);
      } catch (err) {
        console.error("리포트 목록 조회 실패", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const filtered = filter === "all" ? reports : reports.filter(r => r.reportPeriod === filter);

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.appBg }}>
      <header className="text-white px-5 py-4 flex items-center gap-3 sticky top-0 z-20 shadow-lg"
        style={{ backgroundColor: COLORS.primary }}>
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          <div>
            <div className="font-black text-sub">리포트 기록</div>
            <div className="text-white/60 font-bold text-tiny">일간 · 주간 리포트 모아보기</div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-5">
        {/* 필터 탭 — 선택 시 primary 배경(동적이므로 인라인) */}
        <div className="flex bg-white rounded-xl p-1 mb-5 shadow-sm border border-gray-100">
          {([["all", "전체"], ["daily", "일간"], ["weekly", "주간"]] as const).map(([val, label]) => {
            const active = filter === val;
            return (
              <button key={val} onClick={() => setFilter(val)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-lg transition-all font-bold text-small ${
                  active ? "text-white shadow" : "text-gray-500 hover:bg-gray-50"
                }`}
                style={active ? { backgroundColor: COLORS.primary } : undefined}>
                {val === "daily" && <CalendarDays className="w-4 h-4" />}
                {val === "weekly" && <BarChart2 className="w-4 h-4" />}
                {label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: COLORS.primary, borderTopColor: "transparent" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
            <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400 font-bold text-[1.1rem]">리포트가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => {
              const meta = RISK_META[r.riskLevel];
              const isDaily = r.reportPeriod === "daily";
              return (
                <button key={r.id}
                  onClick={() => navigate(`/guardian-report-detail/${userId}/${r.reportPeriod}/${r.id}`)}
                  className="w-full bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 text-left hover:bg-gray-50 transition-colors">
                  {/* 일간/주간 아이콘 — 둘 다 primary 배경 */}
                  <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: COLORS.primary }}>
                    {isDaily
                      ? <CalendarDays className="w-6 h-6 text-white" />
                      : <BarChart2 className="w-6 h-6 text-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-black text-gray-800 text-[1.1rem]">
                        {r.memberName} {isDaily ? "일간" : "주간"} 리포트
                      </span>
                      <span className="px-3 py-1 rounded-full text-white font-bold text-tiny"
                        style={{ backgroundColor: meta.color }}>
                        {meta.label} {r.riskScore}점
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-400 font-bold text-tiny">
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
