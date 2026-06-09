import { useState } from "react";
import { Bell, AlertTriangle, Info, CheckCircle, Clock, ChevronRight } from "lucide-react";


const NOTIFICATIONS = [
  { id: 1, type: "high", title: "긴급 알림 — 김할머니", message: "심장이 불규칙하게 뛰는 증상(심방세동)이 감지되었습니다. 즉각적인 조치가 필요합니다.", sender: "HeartLink · 긴급", time: "오늘 09:35", read: false },
  { id: 2, type: "high", title: "긴급 알림 — 김할머니", message: "위험도 78점 — 심장 이상 신호가 다시 확인되었습니다.", sender: "HeartLink · 긴급", time: "오늘 06:32", read: false },
  { id: 3, type: "medium", title: "주의 알림 — 박할아버지", message: "심장 박동 변화가 감지되었습니다. 3일 안에 병원 방문을 권장합니다.", sender: "HeartLink", time: "어제 14:25", read: true },
  { id: 4, type: "low", title: "일일 리포트 — 이순자", message: "오늘 측정 결과 위험도 하(양호)입니다. 현재 상태가 좋습니다.", sender: "HeartLink", time: "2일 전 08:00", read: true },
];

const TYPE_CONFIG = {
  high: { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", icon: AlertTriangle, label: "긴급" },
  medium: { color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", icon: Info, label: "주의" },
  low: { color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", icon: CheckCircle, label: "양호" },
};

interface NotificationsPageProps {
  onViewReport: () => void;
}

export function NotificationsPage({ onViewReport }: NotificationsPageProps) {
  const [notifications, setNotifications] = useState(NOTIFICATIONS);

  const markRead = (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

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

      {/* Alert policy */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6 font-bold" style={{ fontSize: "1rem", color: "#1d4ed8" }}>
        <p className="mb-2" style={{ fontSize: "1.05rem" }}>알림 발송 방식</p>
        <ul className="space-y-1 text-blue-600">
          <li>• 위험도 상(긴급): 밤낮 없이 즉시 — 앱 알림 + 문자</li>
          <li>• 위험도 중(주의): 야간(22~07시)에는 다음 날 아침 발송 — 앱 알림</li>
          <li>• 위험도 하(양호): 하루 1회 일일 리포트에 포함</li>
        </ul>
      </div>

      {/* Notification list */}
      <div className="space-y-4">
        {notifications.map(n => {
          const config = TYPE_CONFIG[n.type as keyof typeof TYPE_CONFIG];
          const Icon = config.icon;
          return (
            <div
              key={n.id}
              className={`rounded-2xl p-6 border transition-all ${!n.read ? "shadow-md" : "opacity-80"}`}
              style={{ backgroundColor: config.bg, borderColor: config.border }}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: config.color }}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-bold" style={{ color: config.color, fontSize: "1.15rem" }}>
                      {n.title}
                      {!n.read && <span className="ml-2 inline-block w-2.5 h-2.5 bg-red-500 rounded-full align-middle" />}
                    </span>
                    <span className="text-gray-400 font-bold flex-shrink-0 flex items-center gap-1" style={{ fontSize: "0.95rem" }}>
                      <Clock className="w-4 h-4" />{n.time}
                    </span>
                  </div>
                  <p className="text-gray-700 leading-relaxed mb-3 font-bold" style={{ fontSize: "1.05rem" }}>{n.message}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 font-bold" style={{ fontSize: "0.95rem" }}>발신: {n.sender}</span>
                    <button
                      onClick={() => { markRead(n.id); onViewReport(); }}
                      className="flex items-center gap-1 font-bold transition-colors"
                      style={{ color: config.color, minHeight: 44, fontSize: "1rem" }}
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

      <p className="mt-6 text-center text-gray-400 font-bold" style={{ fontSize: "1rem" }}>
        알림 미수신 시 문자로 대신 발송 · 위험 단계 미확인 알림은 1시간 후 재발송
      </p>
    </div>
  );
}