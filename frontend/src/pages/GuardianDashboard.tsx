import { Bell, Clock, ArrowRight, Loader2 } from "lucide-react";
import type { Patient } from "../components/layout/GuardianLayout";

const RISK_CONFIG = {
  high: { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", label: "위험",  kr: "상" },
  mid:  { color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", label: "주의",  kr: "중" },
  low:  { color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", label: "양호",  kr: "하" },
};

const DEFAULT_CONFIG = { color: "#9CA3AF", bg: "#F9FAFB", border: "#E5E7EB", label: "미측정", kr: "-" };

function formatDate(iso: string | null) {
  if (!iso) return "측정 기록 없음";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1)  return "방금 전";
  if (diffH < 24) return `오늘 ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  if (diffH < 48) return `어제 ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  return `${Math.floor(diffH / 24)}일 전`;
}

interface GuardianDashboardProps {
  patients: Patient[];
  onSelectMember: (userId: string) => void;
}

export function GuardianDashboard({ patients, onSelectMember }: GuardianDashboardProps) {
  const highCount = patients.filter(p => p.risk_level === "high").length;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-bold text-[#0A2647]" style={{ fontSize: "1.9rem" }}>연결된 가족 현황</h1>
          <p className="text-gray-600 mt-2 font-bold" style={{ fontSize: "1.1rem" }}>연결된 가족 구성원의 건강 상태를 확인합니다.</p>
        </div>
      </div>

      {/* 요약 바 */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {[
          { label: "연결 인원",  value: `${patients.length}명`, urgent: false },
          { label: "위험 단계",  value: `${highCount}명`,       urgent: highCount > 0 },
        ].map(s => (
          <div key={s.label} className={`bg-white rounded-xl p-5 text-center shadow-sm border ${s.urgent ? "border-red-200 bg-red-50" : "border-gray-100"}`}>
            <div className={`font-bold ${s.urgent ? "text-red-600" : "text-[#0A2647]"}`} style={{ fontSize: "1.8rem" }}>{s.value}</div>
            <div className="text-gray-500 mt-1 font-bold" style={{ fontSize: "1rem" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* 환자 카드 */}
      {patients.length === 0 ? (
        <div className="text-center py-16 text-gray-400 font-bold" style={{ fontSize: "1.1rem" }}>
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-gray-300" />
          연결된 가족이 없거나 불러오는 중입니다.
        </div>
      ) : (
        <div className="space-y-5">
          {patients.map(p => {
            const cfg = p.risk_level ? RISK_CONFIG[p.risk_level] : DEFAULT_CONFIG;
            return (
              <button
                key={p.user_id}
                onClick={() => onSelectMember(p.user_id)}
                className="w-full text-left bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                style={{ border: `2px solid ${cfg.border}` }}
              >
                <div className="flex">
                  <div className="w-2 shrink-0" style={{ backgroundColor: cfg.color }} />
                  <div className="flex-1 p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-gray-800 font-bold" style={{ fontSize: "1.4rem" }}>{p.nickname}</span>
                          {p.age && <span className="text-gray-500 font-bold" style={{ fontSize: "1rem" }}>{p.age}세</span>}
                        </div>
                        <div className="flex items-center gap-2 text-gray-500 font-bold" style={{ fontSize: "1rem" }}>
                          <Clock className="w-5 h-5" />
                          최근 측정: {formatDate(p.latest_measured_at)}
                        </div>
                      </div>
                      <span className="px-4 py-1.5 rounded-full text-white font-bold shrink-0" style={{ backgroundColor: cfg.color, fontSize: "1rem" }}>
                        {p.risk_level ? `위험도 ${cfg.kr} — ${cfg.label}` : cfg.label}
                      </span>
                    </div>

                    {p.risk_score !== null && (
                      <div className="mt-5">
                        <div className="flex items-center justify-between font-bold mb-2" style={{ fontSize: "1rem" }}>
                          <span className="text-gray-500">위험도 점수</span>
                          <span style={{ color: cfg.color, fontWeight: 800 }}>{p.risk_score}점</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3">
                          <div className="h-3 rounded-full" style={{ width: `${p.risk_score}%`, backgroundColor: cfg.color }} />
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-end gap-2 font-bold" style={{ color: cfg.color, fontSize: "1rem" }}>
                      <span>상세 보기</span>
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-center text-gray-400 font-bold" style={{ fontSize: "1rem" }}>최대 3명까지 연결할 수 있습니다.</p>
    </div>
  );
}
