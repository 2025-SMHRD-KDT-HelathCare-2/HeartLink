import { useState, useEffect, useMemo } from "react";
import { Download, ChevronLeft, ChevronRight, Filter, FileText } from "lucide-react";
// import api from "../api/authApi";  // 백엔드 연동 시 주석 해제

// ===== 백엔드 응답 구조 =====
interface ReportHistoryItem {
  id: string;
  date: string;   // "2026-06-01"
  time: string;   // "09:32"
  level: "상" | "중" | "하";
  score: number;
}

const LEVEL_META = {
  상: { color: "#DC2626", label: "위험" },
  중: { color: "#F59E0B", label: "주의" },
  하: { color: "#16A34A", label: "양호" },
};

// ===== 임시 더미: 1년치(약 130개, 3일 간격) =====
function generateDummyReports(): ReportHistoryItem[] {
  const levels = ["상", "중", "하"] as const;
  return Array.from({ length: 130 }, (_, i) => {
    const level = levels[i % 3];
    const scoreRange = { 상: [65, 90], 중: [35, 55], 하: [5, 25] }[level];
    const d = new Date(2026, 5, 16);
    d.setDate(d.getDate() - i * 3);
    return {
      id: `RPT-${String(i + 1).padStart(4, "0")}`,
      date: d.toISOString().slice(0, 10),
      time: `${String(8 + (i % 12)).padStart(2, "0")}:${String((i * 7) % 60).padStart(2, "0")}`,
      level,
      score: scoreRange[0] + ((i * 13) % (scoreRange[1] - scoreRange[0])),
    };
  });
}

const PERIOD_OPTIONS = ["전체", "1주일", "1개월", "3개월", "6개월", "1년"] as const;
const PAGE_SIZE = 8;

export function ReportHistoryPage() {
  const [reports, setReports] = useState<ReportHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<typeof PERIOD_OPTIONS[number]>("전체");
  const [levelFilter, setLevelFilter] = useState("전체");
  const [page, setPage] = useState(1);

  // ===== 백엔드 연동 =====
  useEffect(() => {
    (async () => {
      try {
        // 백엔드 완성 시 주석 해제 (period 파라미터로 서버 필터링도 가능)
        // const res = await api.get("/reports", { params: { period: periodFilter } });
        // setReports(res.data);

        // 임시 더미
        await new Promise(r => setTimeout(r, 400));
        setReports(generateDummyReports());
      } catch (err) {
        console.error("리포트 이력 조회 실패", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const now = new Date(2026, 5, 16);
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

  // 필터 바뀌면 1페이지로
  useEffect(() => { setPage(1); }, [periodFilter, levelFilter]);

  return (
    <div className="max-w-3xl mx-auto p-5">
      <div className="mb-7">
        <h1 className="font-black text-[#0A2647]" style={{ fontSize: "2.1rem" }}>지난 기록</h1>
        <p className="text-gray-500 mt-2 font-bold" style={{ fontSize: "1.1rem" }}>최근 1년간의 건강 결과를 확인하고 저장할 수 있어요.</p>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <Filter className="w-5 h-5 text-gray-400" />
          <h4 className="text-gray-700 font-bold" style={{ fontSize: "1.1rem" }}>기간 · 위험도 선택</h4>
        </div>

        {/* 기간 */}
        <p className="text-gray-500 font-bold mb-2" style={{ fontSize: "1rem" }}>기간</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {PERIOD_OPTIONS.map(p => (
            <button key={p} onClick={() => setPeriodFilter(p)}
              className={`px-4 py-2.5 rounded-xl border-2 transition-all font-bold ${periodFilter === p ? "border-[#0A2647] bg-[#0A2647]/10 text-[#0A2647]" : "border-gray-200 text-gray-500"}`}
              style={{ fontSize: "1rem" }}>
              {p}
            </button>
          ))}
        </div>

        {/* 위험도 */}
        <p className="text-gray-500 font-bold mb-2" style={{ fontSize: "1rem" }}>위험도</p>
        <div className="flex flex-wrap gap-2">
          {["전체", "상", "중", "하"].map(l => (
            <button key={l} onClick={() => setLevelFilter(l)}
              className={`px-4 py-2.5 rounded-xl border-2 transition-all font-bold ${levelFilter === l ? "border-[#0E8080] bg-[#0E8080]/10 text-[#0E8080]" : "border-gray-200 text-gray-500"}`}
              style={{ fontSize: "1rem" }}>
              {l === "전체" ? "전체" : `${l} (${LEVEL_META[l as "상"|"중"|"하"].label})`}
            </button>
          ))}
        </div>
      </div>

      {/* 결과 개수 */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-600 font-bold" style={{ fontSize: "1.05rem" }}>
          총 <span className="text-[#0A2647]">{filtered.length}</span>개의 기록
        </p>
      </div>

      {/* 로딩 */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-[#0E8080] border-t-transparent rounded-full animate-spin" />
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
              <div key={r.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
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
                <button onClick={() => alert(`${r.date} 리포트 PDF 저장`)}
                  className="p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors flex-shrink-0"
                  style={{ minHeight: 52, minWidth: 52 }}>
                  <Download className="w-6 h-6 text-gray-600" />
                </button>
              </div>
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
    </div>
  );
}