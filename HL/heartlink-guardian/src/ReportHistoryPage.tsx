import { useState } from "react";
import { Download, ChevronLeft, ChevronRight, Filter } from "lucide-react";

const ALL_REPORTS = Array.from({ length: 18 }, (_, i) => {
  const levels = ["상", "중", "하"] as const;
  const level = levels[i % 3];
  const colors = { 상: "#DC2626", 중: "#F59E0B", 하: "#16A34A" };
  const labels = { 상: "위험", 중: "주의", 하: "양호" };
  const scores = { 상: 65 + Math.round(Math.random() * 25), 중: 35 + Math.round(Math.random() * 20), 하: 5 + Math.round(Math.random() * 20) };
  const d = new Date(2026, 5, 1);
  d.setDate(d.getDate() - i * 2);
  return {
    id: `RPT-${String(i + 1).padStart(4, "0")}`,
    date: d.toISOString().slice(0, 10),
    time: `${String(8 + Math.round(Math.random() * 12)).padStart(2, "0")}:${String(Math.round(Math.random() * 59)).padStart(2, "0")}`,
    level,
    label: labels[level],
    color: colors[level],
    score: scores[level],
  };
});

const PAGE_SIZE = 5;

export function ReportHistoryPage() {
  const [periodFilter, setPeriodFilter] = useState("전체");
  const [levelFilter, setLevelFilter] = useState("전체");
  const [page, setPage] = useState(1);

  const filtered = ALL_REPORTS.filter(r => {
    if (levelFilter !== "전체" && r.level !== levelFilter) return false;
    if (periodFilter === "1주일") {
      const cutoff = new Date(2026, 4, 25);
      return new Date(r.date) >= cutoff;
    }
    if (periodFilter === "1개월") {
      const cutoff = new Date(2026, 4, 1);
      return new Date(r.date) >= cutoff;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="max-w-3xl mx-auto p-5">
      <div className="mb-7">
        <h1 className="font-black text-[#0A2647]" style={{ fontSize: "2.1rem" }}>지난 기록</h1>
        <p className="text-gray-500 mt-2 font-bold" style={{ fontSize: "1.1rem" }}>예전 건강 결과를 확인하고 저장할 수 있어요.</p>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <Filter className="w-5 h-5 text-gray-400" />
          <h4 className="text-gray-700 font-bold" style={{ fontSize: "1.1rem" }}>기간 · 위험도 선택</h4>
        </div>
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="block text-gray-600 mb-3 font-bold" style={{ fontSize: "1.1rem" }}>기간</label>
            <div className="flex flex-wrap gap-2">
              {["전체", "1주일", "1개월"].map(p => (
                <button
                  key={p}
                  onClick={() => { setPeriodFilter(p); setPage(1); }}
                  className={`px-5 py-3 rounded-xl border-2 transition-all font-bold ${periodFilter === p ? "border-[#0E8080] bg-[#0E8080]/10 text-[#0E8080]" : "border-gray-200 text-gray-600"}`}
                  style={{ minHeight: 56, fontSize: "1.1rem" }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-gray-600 mb-3 font-bold" style={{ fontSize: "1.1rem" }}>위험도</label>
            <div className="flex flex-wrap gap-2">
              {["전체", "상", "중", "하"].map(l => (
                <button
                  key={l}
                  onClick={() => { setLevelFilter(l); setPage(1); }}
                  className={`px-5 py-3 rounded-xl border-2 transition-all font-bold ${levelFilter === l ? "border-[#0A2647] bg-[#0A2647]/10 text-[#0A2647]" : "border-gray-200 text-gray-600"}`}
                  style={{ minHeight: 56, fontSize: "1.1rem" }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="p-5 border-b border-gray-100 font-bold text-gray-500" style={{ fontSize: "1.05rem" }}>
          총 {filtered.length}건
        </div>

        {paged.length === 0 ? (
          <div className="p-12 text-center text-gray-400 font-bold" style={{ fontSize: "1.2rem" }}>해당하는 결과가 없습니다.</div>
        ) : (
          paged.map((r, i) => (
            <div key={r.id} className={`flex items-center gap-4 p-5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}>
              <div className="w-2 h-16 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <span className="px-4 py-1.5 rounded-full text-white font-bold" style={{ backgroundColor: r.color, fontSize: "1.05rem" }}>
                    위험도 {r.level} — {r.label}
                  </span>
                  <span className="font-bold text-gray-600" style={{ fontSize: "1.05rem" }}>{r.score}점</span>
                </div>
                <div className="text-gray-500 font-bold" style={{ fontSize: "1rem" }}>
                  {r.date} {r.time}
                </div>
              </div>
              <button
                onClick={() => alert(`${r.id} PDF 저장`)}
                className="flex items-center gap-2 px-5 py-4 bg-[#0A2647] text-white rounded-xl hover:bg-[#144272] transition-colors flex-shrink-0 font-bold"
                style={{ minHeight: 60, fontSize: "1.05rem" }}
              >
                <Download className="w-5 h-5" />
                저장
              </button>
            </div>
          ))
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(p - 1, 1))}
            disabled={page === 1}
            className="p-3 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            style={{ minHeight: 56, minWidth: 56 }}
          >
            <ChevronLeft className="w-7 h-7 text-gray-600" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`rounded-xl border transition-colors font-bold ${page === p ? "bg-[#0A2647] text-white border-[#0A2647]" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              style={{ minWidth: 52, minHeight: 52, fontSize: "1.1rem" }}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage(p => Math.min(p + 1, totalPages))}
            disabled={page === totalPages}
            className="p-3 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            style={{ minHeight: 56, minWidth: 56 }}
          >
            <ChevronRight className="w-7 h-7 text-gray-600" />
          </button>
        </div>
      )}

      <p className="mt-5 text-center text-gray-400 font-bold" style={{ fontSize: "1rem" }}>
        저장된 파일은 병원에 가져가실 수 있어요.
      </p>
    </div>
  );
}