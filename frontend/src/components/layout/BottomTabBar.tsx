// frontend/src/components/layout/BottomTabBar.tsx
// =============================================================================
// 공통 하단 탭바 (Bottom Tab Bar)
//
// [무엇을 하나요?]
//   화면 맨 아래 항상 고정되어 보이는 "메뉴 막대"입니다.
//   아이콘 + 글자 라벨을 함께 보여주고, 누르면 해당 화면으로 이동합니다.
//
// [디자인 리뉴얼 포인트]
//   1) 활성(선택된) 탭은 아이콘+글자를 브랜드 청록(primary)으로,
//      비활성 탭은 회색으로 표시 → 이미지처럼 또렷한 대비.
//   2) 활성 탭 아이콘 뒤에 "옅은 청록 알약 배경"을 깔아 더 강조.
//   3) 각 탭은 충분한 터치 영역(최소 64px)을 확보(시니어 접근성).
//   4) 알림 등에는 "안 읽음 빨간 점(badge)"을 띄울 수 있음.
//
// [어떻게 쓰나요?]
//   UserLayout / GuardianLayout 에서 "탭 목록(items)"을 만들어 넘기면,
//   이 컴포넌트가 막대를 그리고, 누르면 해당 주소로 이동합니다.
// =============================================================================

import type { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { COLORS } from "../../styles/tokens";

// -----------------------------------------------------------------------------
// 탭 한 개의 정보 모양
//   - label : 아이콘 아래 글자 (예: "홈", "기록")
//   - icon  : 탭 아이콘 (lucide 아이콘 컴포넌트)
//   - path  : 누르면 이동할 주소 (예: "/", "/history")
//   - match : (선택) 이 주소들에 있을 때도 이 탭을 활성으로 표시
//             (예: 상세 화면에 들어가도 부모 탭이 켜져 보이게)
//   - badge : (선택) true 면 아이콘 위에 빨간 점(안 읽음)을 띄움
// -----------------------------------------------------------------------------
export interface TabItem {
  label: string;
  icon: ReactNode;
  path: string;
  match?: string[];
  badge?: boolean;
}

interface BottomTabBarProps {
  items: TabItem[]; // 보여줄 탭들의 목록
}

export function BottomTabBar({ items }: BottomTabBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname; // 지금 보고 있는 주소

  // 이 탭이 "지금 활성 상태"인지 판단
  //   - "/" 탭은 정확히 "/"일 때만 (안 그러면 모든 화면에서 켜져 보임)
  //   - path 로 시작하거나, match 주소로 시작하면 활성
  const isActive = (tab: TabItem) => {
    if (tab.path === "/") return pathname === "/";
    if (pathname === tab.path || pathname.startsWith(tab.path + "/")) return true;
    if (tab.match?.some((m) => pathname === m || pathname.startsWith(m + "/"))) return true;
    return false;
  };

  return (
    // 화면 맨 아래 고정. 위쪽에 옅은 그림자를 줘 본문과 구분한다.
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)", // 아이폰 하단 영역 침범 방지
        boxShadow: "0 -2px 12px rgba(15,23,42,0.06)",
      }}
    >
      <div className="flex items-stretch justify-around max-w-2xl mx-auto px-2">
        {items.map((tab) => {
          const active = isActive(tab);
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="relative flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors"
              style={{ minHeight: 64 }}
              aria-current={active ? "page" : undefined}
            >
              {/* 아이콘 영역: 활성이면 옅은 청록 알약 배경 + 청록 아이콘 */}
              <span
                className="flex items-center justify-center rounded-full transition-colors"
                style={{
                  width: 52,
                  height: 32,
                  color: active ? COLORS.primary : COLORS.faint,
                  backgroundColor: active ? COLORS.primarySoft : "transparent",
                }}
              >
                {tab.icon}
                {/* 안 읽음 빨간 점: badge=true 일 때만 표시 */}
                {tab.badge && (
                  <span className="absolute top-1 right-[calc(50%-20px)] w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white" />
                )}
              </span>

              {/* 글자 라벨: 활성이면 청록+굵게 */}
              <span
                className="font-bold"
                style={{
                  fontSize: "0.8rem",
                  color: active ? COLORS.primary : COLORS.muted,
                  fontWeight: active ? 800 : 600,
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
