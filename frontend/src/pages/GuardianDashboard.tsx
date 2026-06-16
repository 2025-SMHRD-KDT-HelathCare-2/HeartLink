import { Bell, Clock, ArrowRight, Settings } from "lucide-react";


// dailyAlert: 당일 알림 (백엔드: GET /notifications/guardian 중 오늘 항목)
const MEMBERS = [
  { id: 1, name: "김할머니", age: 74, relation: "어머니", lastMeasured: "오늘 09:32", riskLevel: "상" as const, riskScore: 78, unreadAlerts: 2, dailyAlert: "오늘 심장이 불규칙하게 뛰는 증상이 감지되었습니다." },
  { id: 2, name: "박할아버지", age: 81, relation: "아버지", lastMeasured: "어제 14:20", riskLevel: "중" as const, riskScore: 45, unreadAlerts: 0, dailyAlert: null },
  { id: 3, name: "이순자", age: 68, relation: "이모", lastMeasured: "2일 전 11:05", riskLevel: "하" as const, riskScore: 18, unreadAlerts: 0, dailyAlert: null },
];

const RISK_CONFIG = {
  상: { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", label: "위험" },
  중: { color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", label: "주의" },
  하: { color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", label: "양호" },
};

interface GuardianDashboardProps {
  onSelectMember: (id: number) => void;
}

export function GuardianDashboard({ onSelectMember }: GuardianDashboardProps) {
  return (
    <div className="max-w-2xl mx-auto p-6">

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-bold text-[#0A2647]" style={{ fontSize: "1.9rem" }}>연결된 가족 현황</h1>
          <p className="text-gray-600 mt-2 font-bold" style={{ fontSize: "1.1rem" }}>연결된 가족 구성원의 건강 상태를 확인합니다.</p>
        </div>
        <button
          onClick={() => alert("대상 사용자 변경 기능은 준비 중입니다.")}
          className="p-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors shadow-sm"
          title="대상 사용자 변경"
          style={{ minWidth: 48, minHeight: 48 }}
        >
          <Settings className="w-6 h-6 text-gray-500" />
        </button>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "연결 인원", value: `${MEMBERS.length}명` },
          { label: "미확인 알림", value: `${MEMBERS.reduce((sum, m) => sum + m.unreadAlerts, 0)}건`, urgent: true, count: MEMBERS.reduce((sum, m) => sum + m.unreadAlerts, 0) },
          { label: "위험 단계", value: `${MEMBERS.filter(m => m.riskLevel === "상").length}명`, urgent: true, count: MEMBERS.filter(m => m.riskLevel === "상").length },
        ].map(s => (
          <div key={s.label} className={`bg-white rounded-xl p-5 text-center shadow-sm border ${s.urgent && (s.count ?? 0) > 0 ? "border-red-200 bg-red-50" : "border-gray-100"}`}>
            <div className={`font-bold ${s.urgent && (s.count ?? 0) > 0 ? "text-red-600" : "text-[#0A2647]"}`} style={{ fontSize: "1.8rem" }}>
              {s.value}
            </div>
            <div className="text-gray-500 mt-1 font-bold" style={{ fontSize: "1rem" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Member cards */}
      <div className="space-y-5">
        {MEMBERS.map(member => {
          const config = RISK_CONFIG[member.riskLevel];
          return (
            <button
              key={member.id}
              onClick={() => onSelectMember(member.id)}
              className="w-full text-left bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              style={{ border: `2px solid ${config.border}` }}
            >
              <div className="flex">
                <div className="w-2 flex-shrink-0" style={{ backgroundColor: config.color }} />
                <div className="flex-1 p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-gray-800 font-bold" style={{ fontSize: "1.4rem" }}>{member.name}</span>
                        <span className="text-gray-500 font-bold" style={{ fontSize: "1rem" }}>{member.age}세 · {member.relation}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-500 font-bold" style={{ fontSize: "1rem" }}>
                        <Clock className="w-5 h-5" />
                        최근 측정: {member.lastMeasured}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="px-4 py-1.5 rounded-full text-white font-bold" style={{ backgroundColor: config.color, fontSize: "1rem" }}>
                        위험도 {member.riskLevel} — {config.label}
                      </span>
                      {member.unreadAlerts > 0 && (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-full px-3 py-1.5">
                          <Bell className="w-4 h-4 text-red-500" />
                          <span className="text-red-600 font-bold" style={{ fontSize: "1rem" }}>미확인 {member.unreadAlerts}건</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between font-bold mb-2" style={{ fontSize: "1rem" }}>
                      <span className="text-gray-500">위험도 점수</span>
                      <span style={{ color: config.color, fontWeight: 800 }}>{member.riskScore}점</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div className="h-3 rounded-full transition-all" style={{ width: `${member.riskScore}%`, backgroundColor: config.color }} />
                    </div>
                  </div>

                  {member.dailyAlert && (
                    <div className="mt-4 rounded-xl p-3 flex items-start gap-2" style={{ backgroundColor: config.bg, border: `1px solid ${config.border}` }}>
                      <Bell className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: config.color }} />
                      <div>
                        <span className="font-bold block" style={{ color: config.color, fontSize: "0.85rem" }}>오늘의 알림</span>
                        <span className="text-gray-700 font-bold" style={{ fontSize: "0.95rem" }}>{member.dailyAlert}</span>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-end gap-2 font-bold" style={{ color: config.color, fontSize: "1rem" }}>
                    <span>상세 보기</span>
                    <ArrowRight className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-6 text-center text-gray-400 font-bold" style={{ fontSize: "1rem" }}>최대 3명까지 연결할 수 있습니다.</p>
    </div>
  );
}