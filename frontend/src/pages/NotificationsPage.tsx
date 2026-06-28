// frontend/src/pages/NotificationsPage.tsx
// =============================================================================
// 보호자용 알림함 — 최근 7일간 연결된 사용자들의 위험도 알림 모음
//
// [이 파일이 하는 일]
//   - 사용자/위험도로 알림을 필터링해서 보여줍니다.
//   - 알림 카드를 누르면 '읽음' 처리됩니다.
//   - 위험(상) 알림에는 '리포트 보기' 버튼이 함께 나옵니다.
//
// [1단계 리팩터링에서 바뀐 점 — 기능은 그대로, '겉모양 코드'만 정리]
//   1) 위험도 색상(상/중/하)을 직접 적던 것 → 공통 토큰(COLORS) 값 사용
//   2) 색상 하드코딩(#0D9488) → 토큰 클래스(text-primary / border-primary 등)
//   3) 글자 크기 인라인 style → 토큰 클래스
//   ※ 안 읽은 알림 카드의 배경/테두리는 위험도별 '동적 색상'이라
//      인라인 style 이 꼭 필요합니다. (색 값은 토큰에서 가져옴)
//   ※ 화면 결과(디자인/동작)는 이전과 똑같습니다.
// =============================================================================

import { useState, useEffect } from "react";
import { Bell, AlertTriangle, AlertCircle, Info, FileText, Filter } from "lucide-react";
import { getGuardianNotifications, markNotificationRead, type AppNotification } from "../api/notificationApi";
import { COLORS } from "../styles/tokens";

type RiskLevel = "상" | "중" | "하";

// 위험 등급별 색/배경/테두리/표시문구/아이콘 (색은 공통 토큰 사용)
const LEVEL_META: Record<RiskLevel, { color: string; bg: string; border: string; label: string; icon: React.ElementType }> = {
  상: { color: COLORS.danger,  bg: COLORS.dangerBg,  border: COLORS.dangerBorder,  label: "위험", icon: AlertTriangle },
  중: { color: COLORS.warning, bg: COLORS.warningBg, border: COLORS.warningBorder, label: "주의", icon: AlertCircle },
  하: { color: COLORS.safe,    bg: COLORS.safeBg,    border: COLORS.safeBorder,    label: "양호", icon: Info },
};

// 경과 시간을 "방금 전 / N시간 전 / N일 전"으로 표시
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
  const [memberFilter, setMemberFilter] = useState("전체"); // 사용자 필터
  const [levelFilter, setLevelFilter] = useState("전체");   // 위험도 필터

  // 화면이 열리면 알림 목록을 불러옵니다.
  useEffect(() => {
    getGuardianNotifications()
      .then(data => setItems(data))
      .catch(err => console.error("알림 조회 실패", err))
      .finally(() => setLoading(false));
  }, []);

  // 알림 카드를 누르면 즉시 화면에서 읽음 처리 + 서버에도 반영
  const handleMarkRead = (id: string) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    markNotificationRead(id).catch(err => console.error("읽음 처리 실패", err));
  };

  // 필터 버튼에 쓸 '사용자 이름' 목록 (중복 제거)
  const members = ["전체", ...Array.from(new Set(items.map(i => i.memberName ?? "").filter(Boolean)))];

  // 현재 선택된 필터에 맞는 알림만 추립니다.
  const filtered = items.filter(n => {
    if (memberFilter !== "전체" && (n.memberName ?? "") !== memberFilter) return false;
    if (levelFilter !== "전체" && n.level !== levelFilter) return false;
    return true;
  });

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* 제목 */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Bell className="w-7 h-7 text-primary" />
          <h1 className="font-black text-primary text-[1.9rem]">주간 위험도 알림함</h1>
        </div>
        <p className="text-gray-500 mt-2 font-bold text-[1.05rem]">최근 7일간 연결된 사용자들의 위험도 알림이에요.</p>
      </div>

      {/* 필터 영역 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-5 h-5 text-gray-400" />
          <span className="text-gray-700 font-bold text-[1.05rem]">필터</span>
        </div>

        {/* 사용자별 필터 버튼들 */}
        <p className="text-gray-500 font-bold mb-2 text-tiny">사용자</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {members.map(m => (
            <button
              key={m}
              onClick={() => setMemberFilter(m)}
              className={`px-4 py-2 rounded-xl border-2 transition-all font-bold text-tiny ${memberFilter === m ? "border-primary bg-primary/10 text-primary" : "border-gray-200 text-gray-500"}`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* 위험도별 필터 버튼들 */}
        <p className="text-gray-500 font-bold mb-2 text-tiny">위험도</p>
        <div className="flex flex-wrap gap-2">
          {(["전체", "상", "중", "하"] as const).map(l => (
            <button
              key={l}
              onClick={() => setLevelFilter(l)}
              className={`px-4 py-2 rounded-xl border-2 transition-all font-bold text-tiny ${levelFilter === l ? "border-primary bg-primary/10 text-primary" : "border-gray-200 text-gray-500"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        // 로딩 스피너 (테두리 색만 토큰으로)
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        // 알림이 없거나, 필터에 걸리는 게 없을 때
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
          <Bell className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 font-bold text-[1.1rem]">
            {items.length === 0 ? "최근 7일간 알림이 없습니다." : "해당 조건의 알림이 없습니다."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(n => {
            const meta = LEVEL_META[n.level as RiskLevel] ?? LEVEL_META["하"];
            const Icon = meta.icon;
            return (
              <div
                key={n.id}
                onClick={() => handleMarkRead(n.id)}
                className={`rounded-2xl p-5 border-2 cursor-pointer transition-all ${n.isRead ? "bg-white border-gray-100" : ""}`}
                // 안 읽은 알림은 위험도별 색 배경/테두리 → 동적 색상이라 인라인 style
                style={!n.isRead ? { backgroundColor: meta.bg, borderColor: meta.border } : {}}
              >
                <div className="flex items-start gap-3">
                  <Icon className="w-7 h-7 shrink-0 mt-0.5" style={{ color: meta.color }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-gray-800 font-black text-[1.1rem]">{n.memberName}</span>
                      <span className="px-3 py-1 rounded-full text-white font-bold text-[0.8rem]" style={{ backgroundColor: meta.color }}>
                        {meta.label}
                      </span>
                      {/* 안 읽음 표시 빨간 점 */}
                      {!n.isRead && <span className="w-2.5 h-2.5 bg-red-500 rounded-full" />}
                      <span className="text-gray-400 font-bold ml-auto text-[0.9rem]">{timeAgo(n.createdAt)}</span>
                    </div>
                    <p className="text-gray-700 font-bold leading-relaxed mb-2 text-[1.05rem]">{n.message}</p>

                    {/* 위험(상) 알림에만 '리포트 보기' 버튼.
                        카드 클릭(읽음 처리)과 겹치지 않게 stopPropagation 사용 */}
                    {n.level === "상" && onViewReport && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onViewReport(); }}
                        className="flex items-center gap-1.5 text-primary font-bold hover:underline text-tiny"
                      >
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
