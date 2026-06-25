import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Filter, FileText, ChevronRight as ArrowRight, BarChart2, Loader2, AlertCircle } from "lucide-react";
import api from "../api/authApi";
import { toKSTDate, toKSTTime } from "../utils/formatKST";

// ===== 측정 이력 =====
interface ReportHistoryItem {
  id: string;
  date: string;
  time: string;
  level: "상" | "중" | "하";
  score: number;
}

// ===== 주간 리포트 =====
interface WeeklyReportItem {
  id: string;
  periodStart: string;
  periodEnd: string;
  maxRiskLevel: string;
  status: "generating" | "completed" | "failed";
}

const LEVEL_META = {
  상: { color: "#DC2626", label: "위험" },
  중: { color: "#F59E0B", label: "주의" },
  하: { color: "#16A34A", label: "양호" },
};

const WEEKLY_LEVEL_META: Record<string, { color: string; label: string }> = {
  high: { color: "#DC2626", label: "위험" },
  mid:  { color: "#F59E0B", label: "주의" },
  low:  { color: "#16A34A", label: "양호" },
};

const PERIOD_OPTIONS = ["전체", "1주일", "1개월", "3개월", "6개월", "1년"] as const;
const PAGE_SIZE = 8;

export function ReportHistoryPage() {
  const navigate = useNavigate();

  // 측정 이력
  const [reports, setReports] = useState<ReportHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<typeof PERIOD_OPTIONS[number]>("전체");
  const [levelFilter, setLevelFilter] = useState("전체");
  const [page, setPage] = useState(1);

  // 주간 리포트
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReportItem[]>([]);
  const [weeklyLoading, setWeeklyLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/measurements");
        const mapped: ReportHistoryItem[] = (res.data || []).map((r: any) => ({
          id: r._id,
          date: toKSTDate(r.measuredAt || ""),
          time: toKSTTime(r.measuredAt || ""),
          level: ({ high: "상", mid: "중", low: "하" } as Record<string, "상" | "중" | "하">)[r.analysis?.riskLevel] ?? "하",
          score: r.analysis?.riskScore ?? 0,
        }));
        setReports(mapped);
      } catch (err) {
        console.error("측정 이력 조회 실패", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/reports");
        const weekly = (res.data || [])
          .filter((r: any) => r.reportPeriod === "weekly")
          .map((r: any) => ({
            id: r._id,
            periodStart: r.periodStart,
            periodEnd: r.periodEnd,
            maxRiskLevel: r.maxRiskLevel ?? "low",
            status: r.status ?? "completed",
          }));
        setWeeklyReports(weekly);
      } catch (err) {
        console.error("주간 리포트 조회 실패", err);
      } finally {
        setWeeklyLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    return reports.filter(r => {
      if (levelFilter !== "전체" && r.level !== levelFilter) return false;
      if (periodFilter === "전체") return true;
      const cutoff = new Date(now);
      const daysMap: Record<string, number> = {
        "1주일": 7, "1개월": 30, "3개월": 90, "6개월": 180, "1년": 365,
      };
      cutoff.setDate(cutoff.getDate() - daysMap[periodFilter]);
      return new Date(r.date) >= cutoff;
    });
  }, [reports, levelFilter, periodFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [periodFilter, levelFilter]);

  return (
    <div className="max-w-3xl mx-auto p-5">
      <div className="mb-7">
        <h1 className="font-black text-[#0D9488]" style={{ fontSize: "2.1rem" }}>지난 기록</h1>
        <p className="text-gray-500 mt-2 font-bold" style={{ fontSize: "1.1rem" }}>최근 1년간의 건강 결과를 확인하고 저장할 수 있어요.</p>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <Filter className="w-5 h-5 text-gray-400" />
          <h4 className="text-gray-700 font-bold" style={{ fontSize: "1.1rem" }}>기간 · 위험도 선택</h4>
        </div>
        <p className="text-gray-500 font-bold mb-2" style={{ fontSize: "1rem" }}>기간</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {PERIOD_OPTIONS.map(p => (
            <button key={p} onClick={() => setPeriodFilter(p)}
              className={`px-4 py-2.5 rounded-xl border-2 transition-all font-bold ${periodFilter === p ? "border-[#0D9488] bg-[#0D9488]/10 text-[#0D9488]" : "border-gray-200 text-gray-500"}`}
              style={{ fontSize: "1rem" }}>
              {p}
            </button>
          ))}
        </div>
        <p className="text-gray-500 font-bold mb-2" style={{ fontSize: "1rem" }}>위험도</p>
        <div className="flex flex-wrap gap-2">
          {["전체", "상", "중", "하"].map(l => (
            <button key={l} onClick={() => setLevelFilter(l)}
              className={`px-4 py-2.5 rounded-xl border-2 transition-all font-bold ${levelFilter === l ? "border-[#0D9488] bg-[#0D9488]/10 text-[#0D9488]" : "border-gray-200 text-gray-500"}`}
              style={{ fontSize: "1rem" }}>
              {l === "전체" ? "전체" : `${l} (${LEVEL_META[l as "상"|"중"|"하"].label})`}
            </button>
          ))}
        </div>
      </div>

      {/* 측정 이력 결과 */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-600 font-bold" style={{ fontSize: "1.05rem" }}>
          총 <span className="text-[#0D9488]">{filtered.length}</span>개의 기록
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : paged.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
          <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 font-bold" style={{ fontSize: "1.1rem" }}>해당 조건의 기록이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {paged.map(r => {
            const meta = LEVEL_META[r.level];
            return (
              <button key={r.id}
                onClick={() => navigate(`/measurement/${r.id}`)}
                className="w-full bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 hover:border-[#0D9488] hover:shadow-md transition-all text-left">
                <div className="w-2 h-14 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-gray-800 font-black" style={{ fontSize: "1.15rem" }}>{r.date}</span>
                    <span className="text-gray-400 font-bold" style={{ fontSize: "1rem" }}>{r.time}</span>
                  </div>
                  <span className="inline-block px-3 py-1 rounded-full text-white font-bold mt-1"
                    style={{ backgroundColor: meta.color, fontSize: "0.9rem" }}>
                    {meta.label} {r.score}점
                  </span>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {/* 페이지네이션 */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="p-3 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
            style={{ minHeight: 48, minWidth: 48 }}>
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="px-4 font-bold text-gray-600" style={{ fontSize: "1.05rem" }}>
            {page} / {totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="p-3 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
            style={{ minHeight: 48, minWidth: 48 }}>
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      )}

      {/* ===== 주간 리포트 섹션 ===== */}
      <div className="mt-10">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="w-6 h-6 text-[#0D9488]" />
          <h2 className="font-black text-[#0D9488]" style={{ fontSize: "1.5rem" }}>주간 리포트</h2>
        </div>
        <p className="text-gray-500 font-bold mb-5" style={{ fontSize: "1rem" }}>스케줄러가 자동으로 생성한 주간 분석 리포트예요.</p>

        {weeklyLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : weeklyReports.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
            <BarChart2 className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400 font-bold" style={{ fontSize: "1.1rem" }}>아직 주간 리포트가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {weeklyReports.map(r => {
              const meta = WEEKLY_LEVEL_META[r.maxRiskLevel] ?? WEEKLY_LEVEL_META.low;
              const isGenerating = r.status === "generating";
              const isFailed = r.status === "failed";
              const isCompleted = r.status === "completed";

              return (
                <button key={r.id}
                  onClick={() => isCompleted && navigate("/report-detail", { state: { reportId: r.id, type: "weekly" } })}
                  disabled={!isCompleted}
                  className={`w-full bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 text-left transition-all
                    ${isCompleted ? "hover:border-[#0D9488] hover:shadow-md cursor-pointer" : "cursor-default opacity-70"}`}>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: isCompleted ? "#0D9488" : "#9CA3AF" }}>
                    {isGenerating
                      ? <Loader2 className="w-6 h-6 text-white animate-spin" />
                      : isFailed
                        ? <AlertCircle className="w-6 h-6 text-white" />
                        : <BarChart2 className="w-6 h-6 text-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-black text-gray-800" style={{ fontSize: "1.1rem" }}>
                        {toKSTDate(r.periodStart)} ~ {toKSTDate(r.periodEnd)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {isGenerating && (
                        <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-600 font-bold" style={{ fontSize: "0.85rem" }}>
                          생성 중...
                        </span>
                      )}
                      {isFailed && (
                        <span className="px-3 py-1 rounded-full bg-red-100 text-red-600 font-bold" style={{ fontSize: "0.85rem" }}>
                          생성 실패
                        </span>
                      )}
                      {isCompleted && (
                        <span className="px-3 py-1 rounded-full text-white font-bold"
                          style={{ backgroundColor: meta.color, fontSize: "0.85rem" }}>
                          {meta.label}
                        </span>
                      )}
                    </div>
                  </div>
                  {isCompleted && <ArrowRight className="w-5 h-5 text-gray-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}