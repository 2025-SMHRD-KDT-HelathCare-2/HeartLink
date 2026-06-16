import { useState, useEffect } from "react";
import { Bell, AlertTriangle, Info, CheckCircle, Clock, ChevronRight, Loader2 } from "lucide-react";
import api from "../api/authApi";

interface Notification {
  _id: string;
  riskLevel: "high" | "mid" | "low";
  message: string;
  isRead: boolean;
  sentAt: string;
  userId?: { nickname?: string };
}

const TYPE_CONFIG = {
  high: { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", icon: AlertTriangle, label: "긴급" },
  mid:  { color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", icon: Info,           label: "주의" },
  low:  { color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", icon: CheckCircle,    label: "양호" },
};

interface NotificationsPageProps {
  onViewReport: (userId?: string) => void;
}

export function NotificationsPage({ onViewReport }: NotificationsPageProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    api.get("/notifications")
      .then(r => setNotifications(r.data))
      .catch(e => setError(e instanceof Error ? e.message : "불러오기 실패"))
      .finally(() => setLoading(false));
  }, []);

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch { /* silent */ }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-[#0A2647]" style={{ fontSize: "1.9rem" }}>위험도 알림</h1>
            <p className="text-gray-600 mt-2 font-bold" style={{ fontSize: "1.1rem" }}>앱 알림·문자 수신함</p>
          </div>
          {unreadCount > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-full px-4 py-2">
              <Bell className="w-5 h-5 text-red-500" />
              <span className="text-red-600 font-bold" style={{ fontSize: "1rem" }}>미확인 {unreadCount}건</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6 font-bold" style={{ fontSize: "1rem", color: "#1d4ed8" }}>
        <p className="mb-2" style={{ fontSize: "1.05rem" }}>알림 발송 방식</p>
        <ul className="space-y-1 text-blue-600">
          <li>• 위험도 상(긴급): 밤낮 없이 즉시 — 앱 알림 + 문자</li>
          <li>• 위험도 중(주의): 야간(22~07시)에는 다음 날 아침 발송 — 앱 알림</li>
          <li>• 위험도 하(양호): 하루 1회 일일 리포트에 포함</li>
        </ul>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="font-bold" style={{ fontSize: "1.1rem" }}>불러오는 중...</span>
        </div>
      ) : error ? (
        <div className="text-center py-16 text-red-400 font-bold">{error}</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 text-gray-400 font-bold" style={{ fontSize: "1.1rem" }}>알림이 없습니다.</div>
      ) : (
        <div className="space-y-4">
          {notifications.map(n => {
            const cfg = TYPE_CONFIG[n.riskLevel];
            const Icon = cfg.icon;
            const userName = n.userId?.nickname || "사용자";
            return (
              <div
                key={n._id}
                className={`rounded-2xl p-6 border transition-all ${!n.isRead ? "shadow-md" : "opacity-80"}`}
                style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: cfg.color }}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="font-bold" style={{ color: cfg.color, fontSize: "1.15rem" }}>
                        {cfg.label} 알림 — {userName}
                        {!n.isRead && <span className="ml-2 inline-block w-2.5 h-2.5 bg-red-500 rounded-full align-middle" />}
                      </span>
                      <span className="text-gray-400 font-bold shrink-0 flex items-center gap-1" style={{ fontSize: "0.95rem" }}>
                        <Clock className="w-4 h-4" />
                        {new Date(n.sentAt).toLocaleString("ko-KR")}
                      </span>
                    </div>
                    <p className="text-gray-700 leading-relaxed mb-3 font-bold" style={{ fontSize: "1.05rem" }}>{n.message}</p>
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => { markRead(n._id); onViewReport(); }}
                        className="flex items-center gap-1 font-bold transition-colors"
                        style={{ color: cfg.color, minHeight: 44, fontSize: "1rem" }}
                      >
                        탭하여 상세 리포트 보기
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-center text-gray-400 font-bold" style={{ fontSize: "1rem" }}>
        알림 미수신 시 문자로 대신 발송 · 위험 단계 미확인 알림은 1시간 후 재발송
      </p>
    </div>
  );
}
