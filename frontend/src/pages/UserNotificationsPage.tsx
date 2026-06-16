import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Bell, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { getMyNotifications, markNotificationRead, type AppNotification } from "../api/notificationApi";

const LEVEL_META = {
  상: { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", icon: AlertTriangle },
  중: { color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", icon: AlertCircle },
  하: { color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", icon: Info },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "방금 전";
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export function UserNotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyNotifications()
      .then(setItems)
      .catch(err => console.error("알림 조회 실패", err))
      .finally(() => setLoading(false));
  }, []);

  const markRead = (id: string) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    markNotificationRead(id).catch(() => {});
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA]">
      <header className="bg-[#0A2647] text-white px-5 py-4 flex items-center gap-3 sticky top-0 z-20 shadow-lg">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <Bell className="w-6 h-6" />
          <div>
            <div className="font-black" style={{ fontSize: "1.3rem" }}>알림함</div>
            <div className="text-white/60 font-bold" style={{ fontSize: "0.9rem" }}>최근 7일간의 알림</div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-5">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-[#0E8080] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
            <Bell className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400 font-bold" style={{ fontSize: "1.1rem" }}>최근 7일간 받은 알림이 없어요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(n => {
              const meta = LEVEL_META[n.level];
              const Icon = meta.icon;
              return (
                <div key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`rounded-2xl p-5 border-2 cursor-pointer transition-all ${n.isRead ? "bg-white border-gray-100" : ""}`}
                  style={!n.isRead ? { backgroundColor: meta.bg, borderColor: meta.border } : {}}>
                  <div className="flex items-start gap-3">
                    <Icon className="w-7 h-7 flex-shrink-0 mt-0.5" style={{ color: meta.color }} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="px-3 py-1 rounded-full text-white font-bold" style={{ backgroundColor: meta.color, fontSize: "0.85rem" }}>
                          위험도 {n.level}
                        </span>
                        {!n.isRead && <span className="w-2.5 h-2.5 bg-red-500 rounded-full" />}
                        <span className="text-gray-400 font-bold ml-auto" style={{ fontSize: "0.9rem" }}>{timeAgo(n.createdAt)}</span>
                      </div>
                      <p className="text-gray-700 font-bold leading-relaxed" style={{ fontSize: "1.05rem" }}>{n.message}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
