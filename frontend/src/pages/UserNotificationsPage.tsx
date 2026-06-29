// UserNotificationsPage.tsx

// frontend/src/pages/UserNotificationsPage.tsx
// =============================================================================
// 사용자용 알림함 — 내가 받은 최근 7일간의 위험도 알림
//
// [이 파일이 하는 일]
//   - 상단 고정 헤더(뒤로가기 + 제목)와 함께 내 알림 목록을 보여줍니다.
//   - 알림 카드를 누르면 '읽음' 처리됩니다.
//
// [디자인 리뉴얼 — 기능은 그대로, 겉모양만 통일]
//   1) 헤더: 단색 primary → GRADIENTS.brand(teal→blue) 그라데이션 + 그림자
//   2) 위험도 색상(상/중/하) → 공통 토큰(COLORS) 값 사용
//   3) 빨간 점(bg-red-500) → COLORS.danger 토큰
//   4) 글자 크기 인라인 style → 토큰 클래스
//   ※ 안 읽은 알림 카드 배경/테두리는 위험도별 동적 색상이라 인라인 style 유지
//   ※ 페이지 배경색(#F4F7FA)은 토큰 대응값이 없어 그대로 둡니다.
//   ※ 화면 동작은 이전과 동일합니다.
// =============================================================================

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Bell, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { getMyNotifications, markNotificationRead, type AppNotification } from "../api/notificationApi";
import { COLORS, GRADIENTS } from "../styles/tokens";

// 위험 등급별 색/배경/테두리/아이콘 (색은 공통 토큰 사용)
const LEVEL_META = {
  상: { color: COLORS.danger,  bg: COLORS.dangerBg,  border: COLORS.dangerBorder,  icon: AlertTriangle },
  중: { color: COLORS.warning, bg: COLORS.warningBg, border: COLORS.warningBorder, icon: AlertCircle },
  하: { color: COLORS.safe,    bg: COLORS.safeBg,    border: COLORS.safeBorder,    icon: Info },
};

// 경과 시간을 "방금 전 / N시간 전 / N일 전"으로 표시
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

  // 화면이 열리면 내 알림을 불러옵니다.
  useEffect(() => {
    getMyNotifications()
      .then(setItems)
      .catch(err => console.error("알림 조회 실패", err))
      .finally(() => setLoading(false));
  }, []);

  // 알림 카드를 누르면 읽음 처리 (화면 + 서버)
  const markRead = (id: string) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    markNotificationRead(id).catch(() => {});
  };

  return (
    // 페이지 배경: 연한 회청색(#F4F7FA) — 토큰 대응값이 없어 유지
    <div className="min-h-screen bg-[#F4F7FA]">
      {/* 상단 고정 헤더 — 브랜드 그라데이션(teal→blue) */}
      <header
        className="text-white px-5 py-4 flex items-center gap-3 sticky top-0 z-20"
        style={{
          background: GRADIENTS.brand,
          boxShadow: "0 4px 16px rgba(13, 148, 136, 0.25)",
        }}
      >
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl hover:bg-white/15 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <Bell className="w-6 h-6" />
          <div>
            <div className="font-black text-sub">알림함</div>
            <div className="text-white/70 font-bold text-[0.9rem]">최근 7일간의 알림</div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-5">
        {loading ? (
          // 로딩 스피너
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          // 알림이 없을 때
          <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
            <Bell className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400 font-bold text-[1.1rem]">최근 7일간 받은 알림이 없어요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(n => {
              const meta = LEVEL_META[n.level];
              const Icon = meta.icon;
              return (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`rounded-2xl p-5 border-2 cursor-pointer transition-all ${n.isRead ? "bg-white border-gray-100" : ""}`}
                  // 안 읽은 알림은 위험도별 색 배경/테두리 → 동적 색상이라 인라인 style
                  style={!n.isRead ? { backgroundColor: meta.bg, borderColor: meta.border } : {}}
                >
                  <div className="flex items-start gap-3">
                    <Icon className="w-7 h-7 flex-shrink-0 mt-0.5" style={{ color: meta.color }} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="px-3 py-1 rounded-full text-white font-bold text-[0.85rem]" style={{ backgroundColor: meta.color }}>
                          위험도 {n.level}
                        </span>
                        {!n.isRead && (
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: COLORS.danger }}
                          />
                        )}
                        <span className="text-gray-400 font-bold ml-auto text-[0.9rem]">{timeAgo(n.createdAt)}</span>
                      </div>
                      <p className="text-gray-700 font-bold leading-relaxed text-[1.05rem]">{n.message}</p>
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
