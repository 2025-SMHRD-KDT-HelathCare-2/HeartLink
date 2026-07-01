// NotificationsPage.tsx
// frontend/src/pages/NotificationsPage.tsx
// =============================================================================
// 보호자용 알림함 — 최근 7일간 연결된 사용자들의 위험도 알림 모음
//
// [이 파일이 하는 일]
//   - 사용자/위험도로 알림을 필터링해서 보여줍니다.
//   - 알림 카드를 누르면 '읽음' 처리됩니다.
//   - 위험(상) 알림에는 '리포트 보기' 버튼이 함께 나옵니다.
//
// [디자인 리뉴얼 포인트 — 기능은 그대로, '겉모양'만 업그레이드]
//   1) 페이지 제목 → 청록→블루 그라데이션 헤더 카드(<Card variant="gradient">)
//   2) 필터 영역 / 빈 상태 → 공통 <Card> 로 통일
//   3) 필터 버튼의 활성 색을 토큰(primary/primarySoft)으로 통일
//   ※ 안 읽은 알림 카드의 배경/테두리는 위험도별 '동적 색상'이라
//      인라인 style 이 꼭 필요합니다. (색 값은 토큰에서 가져옴)
//   ※ 알림 조회/읽음 처리/필터링 로직은 이전과 100% 동일합니다.
// =============================================================================

import { useState, useEffect } from "react";
import { Bell, AlertTriangle, AlertCircle, Info, FileText, Filter } from "lucide-react";
import { getGuardianNotifications, markNotificationRead, type GuardianUserGroup } from "../api/notificationApi";
import { COLORS } from "../styles/tokens";
// 공통 UI: 카드(겉모양 통일용)
import { Card } from "../components/ui";

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
  const [groups, setGroups] = useState<GuardianUserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberFilter, setMemberFilter] = useState("전체");
  const [levelFilter, setLevelFilter] = useState("전체");

  useEffect(() => {
    getGuardianNotifications()
      .then(data => setGroups(data))
      .catch(err => console.error("알림 조회 실패", err))
      .finally(() => setLoading(false));
  }, []);

  // 알림 카드를 누르면 즉시 화면에서 읽음 처리 + 서버에도 반영
  const handleMarkRead = (id: string) => {
    setGroups(prev => prev.map(g => ({
      ...g,
      notifications: g.notifications.map(n => n.id === id ? { ...n, isRead: true } : n),
    })));
    markNotificationRead(id).catch(err => console.error("읽음 처리 실패", err));
  };

  // 연동된 모든 사용자 이름 목록 (알림 없는 사용자도 포함)
  const members = ["전체", ...groups.map(g => g.memberName)];

  // memberFilter로 보여줄 그룹 선택 후, levelFilter로 각 그룹 내 알림 필터링
  const visibleGroups = groups
    .filter(g => memberFilter === "전체" || g.memberName === memberFilter)
    .map(g => ({
      ...g,
      notifications: levelFilter === "전체"
        ? g.notifications
        : g.notifications.filter(n => n.level === levelFilter),
    }));

  // ───────────────────────────────────────────────────────────
  // [도우미] 필터 버튼 스타일.
  //   - 선택(active) 시: 청록 테두리 + 연한 청록 배경 + 청록 글자 (토큰 색).
  //   - 비선택 시: 회색 테두리 + 회색 글자.
  //   동적 색이라 인라인 style 로 토큰 색을 적용합니다.
  // ───────────────────────────────────────────────────────────
  const chipStyle = (active: boolean): React.CSSProperties =>
    active
      ? { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft, color: COLORS.primary }
      : { borderColor: "#E5E7EB", color: "#6B7280" };

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* ───────────── 그라데이션 헤더 카드 ─────────────
          [리뉴얼] 제목을 청록→블루 그라데이션 카드로 교체. */}
      <Card variant="gradient" padding="lg" className="mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
            <Bell className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="font-black text-white text-[1.8rem] leading-tight">주간 위험도 알림함</h1>
            <p className="text-white/80 mt-1 font-bold text-small">
              최근 7일간 연결된 사용자들의 위험도 알림이에요.
            </p>
          </div>
        </div>
      </Card>

      {/* ───────────── 필터 영역 ─────────────
          [리뉴얼] 공통 <Card> 로 통일. 버튼 활성 색은 토큰(primary)으로. */}
      <Card padding="lg" className="mb-5">
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
              className="px-4 py-2 rounded-xl border-2 transition-all font-bold text-tiny"
              style={chipStyle(memberFilter === m)}
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
              className="px-4 py-2 rounded-xl border-2 transition-all font-bold text-tiny"
              style={chipStyle(levelFilter === l)}
            >
              {l}
            </button>
          ))}
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : visibleGroups.length === 0 ? (
        <Card padding="lg" className="text-center py-12">
          <Bell className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 font-bold text-[1.1rem]">연결된 사용자가 없습니다.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {visibleGroups.map(group => (
            <div key={group.userId}>
              {/* 사용자 이름 헤더 */}
              <p className="text-gray-500 font-bold text-[0.95rem] mb-2 px-1">{group.memberName}</p>

              {group.notifications.length === 0 ? (
                <Card padding="lg" className="text-center py-6">
                  <Bell className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-400 font-bold text-small">최근 7일간 위험 알림이 없어요.</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {group.notifications.map(n => {
                    const meta = LEVEL_META[n.level as RiskLevel] ?? LEVEL_META["하"];
                    const Icon = meta.icon;
                    return (
                      <div
                        key={n.id}
                        onClick={() => handleMarkRead(n.id)}
                        className={`rounded-2xl p-5 border-2 cursor-pointer transition-all ${n.isRead ? "bg-white border-gray-100" : ""}`}
                        style={!n.isRead ? { backgroundColor: meta.bg, borderColor: meta.border } : {}}
                      >
                        <div className="flex items-start gap-3">
                          <Icon className="w-7 h-7 shrink-0 mt-0.5" style={{ color: meta.color }} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="px-3 py-1 rounded-full text-white font-bold text-[0.8rem]" style={{ backgroundColor: meta.color }}>
                                {meta.label}
                              </span>
                              {!n.isRead && (
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.danger }} />
                              )}
                              <span className="text-gray-400 font-bold ml-auto text-tiny">{timeAgo(n.createdAt)}</span>
                            </div>
                            <p className="text-gray-700 font-bold leading-relaxed mb-2 text-[1.05rem]">{n.message}</p>
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
          ))}
        </div>
      )}
    </div>
  );
}
