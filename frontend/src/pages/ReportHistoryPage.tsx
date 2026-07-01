import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Filter, FileText, ChevronRight as ArrowRight } from "lucide-react";
import api from "../api/authApi";
import { toKSTDate, toKSTTime } from "../utils/formatKST";
import { Card } from "../components/ui";
import { COLORS } from "../styles/tokens";

interface ReportHistoryItem {
  id: string;
  date: string;
  time: string;
  level: "상" | "중" | "하";
  score: number;
}

const LEVEL_META = {
  상: { color: COLORS.danger,  label: "위험" },
  중: { color: COLORS.warning, label: "주의" },
  하: { color: COLORS.safe,    label: "양호" },
};

const PERIOD_OPTIONS = ["전체", "1주일", "1개월", "3개월", "6개월", "1년"] as const;
const PAGE_SIZE = 8;

export function ReportHistoryPage() {
  const navigate = useNavigate();

  const [reports, setReports] = useState<ReportHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<typeof PERIOD_OPTIONS[number]>("전체");
  const [levelFilter, setLevelFilter] = useState("전체");
  const [page, setPage] = useState(1);

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

  const chipStyle = (active: boolean) =>
    active
      ? { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft, color: COLORS.primary }
      : undefined;

  return (
    <div className="max-w-3xl mx-auto p-5">

      <Card variant="gradient" padding="lg" className="mb-6">
        <h1 className="font-black text-hero leading-tight">지난 기록</h1>
        <p className="mt-2 font-bold text-body opacity-90">
          최근 1년간의 건강 결과를 확인하고 저장할 수 있어요.
        </p>
      </Card>

      <Card padding="lg" className="mb-6">
        <div className="flex items-center gap-2 mb-5">
          <Filter className="w-5 h-5 text-gray-400" />
          <h4 className="text-gray-700 font-bold text-[1.1rem]">기간 · 위험도 선택</h4>
        </div>

        <p className="text-gray-500 font-bold mb-2 text-small">기간</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {PERIOD_OPTIONS.map(p => {
            const active = periodFilter === p;
            return (
              <button key={p} onClick={() => setPeriodFilter(p)}
                className={`px-4 py-2.5 rounded-xl border-2 transition-all font-bold text-small ${active ? "" : "border-gray-200 text-gray-500"}`}
                style={chipStyle(active)}>
                {p}
              </button>
            );
          })}
        </div>

        <p className="text-gray-500 font-bold mb-2 text-small">위험도</p>
        <div className="flex flex-wrap gap-2">
          {["전체", "상", "중", "하"].map(l => {
            const active = levelFilter === l;
            return (
              <button key={l} onClick={() => setLevelFilter(l)}
                className={`px-4 py-2.5 rounded-xl border-2 transition-all font-bold text-small ${active ? "" : "border-gray-200 text-gray-500"}`}
                style={chipStyle(active)}>
                {l === "전체" ? "전체" : `${l} (${LEVEL_META[l as "상"|"중"|"하"].label})`}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-600 font-bold text-small">
          총 <span className="text-primary">{filtered.length}</span>개의 기록
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: COLORS.primary, borderTopColor: "transparent" }} />
        </div>
      ) : paged.length === 0 ? (
        <Card padding="lg" className="py-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 font-bold text-[1.1rem]">해당 조건의 기록이 없습니다.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {paged.map(r => {
            const meta = LEVEL_META[r.level];
            return (
              <Card
                key={r.id}
                padding="md"
                onClick={() => navigate(`/measurement/${r.id}`)}
                className="flex items-center gap-4 cursor-pointer hover:shadow-card-hover transition-all text-left"
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = COLORS.primary)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
              >
                <div className="w-2 h-14 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-gray-800 font-black text-body">{r.date}</span>
                    <span className="text-gray-400 font-bold text-small">{r.time}</span>
                  </div>
                  <span className="inline-block px-3 py-1 rounded-full text-white font-bold mt-1 text-tiny"
                    style={{ backgroundColor: meta.color }}>
                    {meta.label} {r.score}점
                  </span>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 shrink-0" />
              </Card>
            );
          })}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="p-3 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
            style={{ minHeight: 48, minWidth: 48 }}>
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="px-4 font-bold text-gray-600 text-small">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="p-3 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
            style={{ minHeight: 48, minWidth: 48 }}>
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      )}
    </div>
  );
}