import { useState, useEffect } from "react";
import { Bell, AlertTriangle, AlertCircle, Info, FileText, Filter } from "lucide-react";
import { getGuardianNotifications, markNotificationRead, type AppNotification } from "../api/notificationApi";

type RiskLevel = "상" | "중" | "하";

const LEVEL_META: Record<RiskLevel, { color: string; bg: string; border: string; label: string; icon: React.ElementType }> = {
  상: { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", label: "위험", icon: AlertTriangle },
  중: { color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", label: "주의", icon: AlertCircle },
  하: { color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", label: "양호", icon: Info },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "방금 전";
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

interface NotificationsPageProps {
  onViewReport?: () => void;
}

export function NotificationsPage({ onViewReport }: NotificationsPageProps) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberFilter, setMemberFilter] = useState("전체");
  const [levelFilter, setLevelFilter] = useState("전체");

  useEffect(() => {
    getGuardianNotifications()
      .then(data => setItems(data))
      .catch(err => console.error("알림 조회 실패", err))
      .finally(() => setLoading(false));
  }, []);

  const handleMarkRead = (id: string) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    markNotificationRead(id).catch(err => console.error("읽음 처리 실패", err));
  };

  const members = ["전체", ...Array.from(new Set(items.map(i => i.memberName ?? "").filter(Boolean)))];

  const filtered = items.filter(n => {
    if (memberFilter !== "전체" && (n.memberName ?? "") !== memberFilter) return false;
    if (levelFilter !== "전체" && n.level !== levelFilter) return false;
    return true;
  });

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Bell className="w-7 h-7 text-[#0A2647]" />
          <h1 className="font-black text-[#0A2647]" style={{ fontSize: "1.9rem" }}>주간 위험도 알림함</h1>
        </div>
        <p className="text-gray-500 mt-2 font-bold" style={{ fontSize: "1.05rem" }}>최근 7일간 연결된 사용자들의 위험도 알림이에요.</p>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-5 h-5 text-gray-400" />
          <span className="text-gray-700 font-bold" style={{ fontSize: "1.05rem" }}>필터</span>
        </div>
        <p className="text-gray-500 font-bold mb-2" style={{ fontSize: "0.95rem" }}>사용자</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {members.map(m => (
            <button key={m} onClick={() => setMemberFilter(m)}
              className={`px-4 py-2 rounded-xl border-2 transition-all font-bold ${memberFilter === m ? "border-[#0A2647] bg-[#0A2647]/10 text-[#0A2647]" : "border-gray-200 text-gray-500"}`}
              style={{ fontSize: "0.95rem" }}>
              {m}
            </button>
          ))}
        </div>
        <p className="text-gray-500 font-bold mb-2" style={{ fontSize: "0.95rem" }}>위험도</p>
        <div className="flex flex-wrap gap-2">
          {(["전체", "상", "중", "하"] as const).map(l => (
            <button key={l} onClick={() => setLevelFilter(l)}
              className={`px-4 py-2 rounded-xl border-2 transition-all font-bold ${levelFilter === l ? "border-[#0E8080] bg-[#0E8080]/10 text-[#0E8080]" : "border-gray-200 text-gray-500"}`}
              style={{ fontSize: "0.95rem" }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-[#0E8080] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
          <Bell className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 font-bold" style={{ fontSize: "1.1rem" }}>
            {items.length === 0 ? "최근 7일간 알림이 없습니다." : "해당 조건의 알림이 없습니다."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(n => {
            const meta = LEVEL_META[n.level as RiskLevel] ?? LEVEL_META["하"];
            const Icon = meta.icon;
            return (
              <div key={n.id}
                onClick={() => handleMarkRead(n.id)}
                className={`rounded-2xl p-5 border-2 cursor-pointer transition-all ${n.isRead ? "bg-white border-gray-100" : ""}`}
                style={!n.isRead ? { backgroundColor: meta.bg, borderColor: meta.border } : {}}>
                <div className="flex items-start gap-3">
                  <Icon className="w-7 h-7 shrink-0 mt-0.5" style={{ color: meta.color }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-gray-800 font-black" style={{ fontSize: "1.1rem" }}>{n.memberName}</span>
                      <span className="px-3 py-1 rounded-full text-white font-bold" style={{ backgroundColor: meta.color, fontSize: "0.8rem" }}>
                        {meta.label}
                      </span>
                      {!n.isRead && <span className="w-2.5 h-2.5 bg-red-500 rounded-full" />}
                      <span className="text-gray-400 font-bold ml-auto" style={{ fontSize: "0.9rem" }}>{timeAgo(n.createdAt)}</span>
                    </div>
                    <p className="text-gray-700 font-bold leading-relaxed mb-2" style={{ fontSize: "1.05rem" }}>{n.message}</p>
                    {n.level === "상" && onViewReport && (
                      <button onClick={(e) => { e.stopPropagation(); onViewReport(); }}
                        className="flex items-center gap-1.5 text-[#0A2647] font-bold hover:underline" style={{ fontSize: "0.95rem" }}>
                        <FileText className="w-4 h-4" />리포트 보기
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
