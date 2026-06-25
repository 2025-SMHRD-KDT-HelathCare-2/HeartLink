import { Bell, Clock, ArrowRight } from "lucide-react";
import type { Patient } from "../components/layout/GuardianLayout";
import type { AppNotification } from "../api/notificationApi";

const RISK_CONFIG = {
  high: { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", label: "위험", kr: "상" },
  mid:  { color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", label: "주의", kr: "중" },
  low:  { color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", label: "양호", kr: "하" },
};
const DEFAULT_CFG = { color: "#9CA3AF", bg: "#F9FAFB", border: "#E5E7EB", label: "미분석", kr: "-" };

function formatLastMeasured(iso: string | null): string {
  if (!iso) return "측정 없음";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  const timeStr = new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  if (h < 1) return "방금 전";
  if (h < 24) return `오늘 ${timeStr}`;
  if (h < 48) return `어제 ${timeStr}`;
  return `${Math.floor(h / 24)}일 전 ${timeStr}`;
}

interface GuardianDashboardProps {
  patients: Patient[];
  notifications: AppNotification[];
  onSelectMember: (userId: string) => void;
}

export function GuardianDashboard({ patients, notifications, onSelectMember }: GuardianDashboardProps) {
  const highRiskCount = patients.filter(p => p.risk_level === "high").length;
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const notifsByNickname = new Map<string, AppNotification[]>();
  for (const n of notifications) {
    const name = n.memberName ?? "";
    notifsByNickname.set(name, [...(notifsByNickname.get(name) ?? []), n]);
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="font-bold text-[#0D9488]" style={{ fontSize: "1.9rem" }}>연결된 가족 현황</h1>
        <p className="text-gray-600 mt-2 font-bold" style={{ fontSize: "1.1rem" }}>연결된 가족 구성원의 건강 상태를 확인합니다.</p>
      </div>

      {/* 요약 바 */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "연결 인원",  value: `${patients.length}명`, urgent: false, count: 0 },
          { label: "미확인 알림", value: `${unreadCount}건`,    urgent: true,  count: unreadCount },
          { label: "위험 단계",  value: `${highRiskCount}명`,   urgent: true,  count: highRiskCount },
        ].map(s => (
          <div key={s.label} className={`bg-white rounded-xl p-5 text-center shadow-sm border ${s.urgent && s.count > 0 ? "border-red-200 bg-red-50" : "border-gray-100"}`}>
            <div className={`font-bold ${s.urgent && s.count > 0 ? "text-red-600" : "text-[#0D9488]"}`} style={{ fontSize: "1.8rem" }}>
              {s.value}
            </div>
            <div className="text-gray-500 mt-1 font-bold" style={{ fontSize: "1rem" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {patients.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
          <p className="text-gray-400 font-bold" style={{ fontSize: "1.1rem" }}>연결된 가족 구성원이 없습니다.</p>
          <p className="text-gray-400 mt-2 font-bold" style={{ fontSize: "0.95rem" }}>마이페이지에서 사용자를 등록하세요.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {patients.map(patient => {
            const cfg = patient.risk_level ? RISK_CONFIG[patient.risk_level] : DEFAULT_CFG;
            const patientNotifs = notifsByNickname.get(patient.nickname) ?? [];
            const unreadNotifs  = patientNotifs.filter(n => !n.isRead);
            const todayAlert    = patientNotifs.find(n =>
              Date.now() - new Date(n.createdAt).getTime() < 24 * 3600 * 1000
            );

            return (
              // 카드 전체는 div로 (클릭 반응 없음)
              <div
                key={patient.user_id}
                className="w-full text-left bg-white rounded-2xl shadow-sm overflow-hidden"
                style={{ border: `2px solid ${cfg.border}` }}
              >
                <div className="flex">
                  <div className="w-2 shrink-0" style={{ backgroundColor: cfg.color }} />
                  <div className="flex-1 p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-gray-800 font-bold" style={{ fontSize: "1.4rem" }}>{patient.nickname}</span>
                          {patient.age != null && (
                            <span className="text-gray-500 font-bold" style={{ fontSize: "1rem" }}>{patient.age}세</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-gray-500 font-bold" style={{ fontSize: "1rem" }}>
                          <Clock className="w-5 h-5" />
                          최근 측정: {formatLastMeasured(patient.latest_measured_at)}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="px-4 py-1.5 rounded-full text-white font-bold" style={{ backgroundColor: cfg.color, fontSize: "1rem" }}>
                          위험도 {cfg.kr} — {cfg.label}
                        </span>
                        {unreadNotifs.length > 0 && (
                          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-full px-3 py-1.5">
                            <Bell className="w-4 h-4 text-red-500" />
                            <span className="text-red-600 font-bold" style={{ fontSize: "1rem" }}>미확인 {unreadNotifs.length}건</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {patient.risk_score != null && (
                      <div className="mt-5">
                        <div className="flex items-center justify-between font-bold mb-2" style={{ fontSize: "1rem" }}>
                          <span className="text-gray-500">위험도 점수</span>
                          <span style={{ color: cfg.color, fontWeight: 800 }}>{patient.risk_score}점</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3">
                          <div className="h-3 rounded-full transition-all" style={{ width: `${patient.risk_score}%`, backgroundColor: cfg.color }} />
                        </div>
                      </div>
                    )}

                    {todayAlert && (
                      <div className="mt-4 rounded-xl p-3 flex items-start gap-2" style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}>
                        <Bell className="w-5 h-5 shrink-0 mt-0.5" style={{ color: cfg.color }} />
                        <div>
                          <span className="font-bold block" style={{ color: cfg.color, fontSize: "0.85rem" }}>오늘의 알림</span>
                          <span className="text-gray-700 font-bold" style={{ fontSize: "0.95rem" }}>{todayAlert.message}</span>
                        </div>
                      </div>
                    )}

                    {/* 상세 보기 버튼만 클릭 가능 */}
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => onSelectMember(patient.user_id)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-black transition-all hover:opacity-80 active:scale-95"
                        style={{
                          backgroundColor: cfg.color,
                          color: "#ffffff",
                          fontSize: "1rem",
                        }}
                      >
                        상세 보기
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-center text-gray-400 font-bold" style={{ fontSize: "1rem" }}>최대 3명까지 연결할 수 있습니다.</p>
    </div>
  );
}