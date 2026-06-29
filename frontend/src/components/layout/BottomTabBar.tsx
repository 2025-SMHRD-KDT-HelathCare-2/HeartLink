// frontend/src/components/layout/BottomTabBar.tsx
// =============================================================================
// 공통 하단 탭바 (Bottom Tab Bar)
//
// [이게 뭔가요?]
//   - 화면 맨 아래에 항상 고정되어 보이는 "메뉴 막대"입니다.
//   - 인스타그램/유튜브 앱 아래쪽에 있는 그 메뉴 줄과 같은 개념입니다.
//   - 시니어 사용자가 한 손 엄지로 누르기 쉬운 화면 아래쪽에 두고,
//     아이콘 + 글자 라벨을 함께 보여줘 "이게 무슨 메뉴인지" 바로 알 수 있게 합니다.
//
// [왜 이렇게 만들었나요? — 시니어/접근성 가이드 반영]
//   1) 아이콘만 쓰지 않고 "아이콘 + 텍스트 라벨"을 항상 같이 보여줍니다.
//      (아이콘만 있으면 어르신들이 의미를 모를 수 있습니다.)
//   2) 지금 보고 있는 탭은 "색(primary) + 굵은 글씨" 두 가지로 강조합니다.
//      (색 하나만으로 구분하면 색약/노안 사용자가 못 알아볼 수 있습니다.)
//   3) 각 탭의 누르는 영역(높이)을 충분히 크게(64px 이상) 만들어
//      손이 떨리거나 정확히 누르기 어려운 분도 잘 누르도록 했습니다.
//   4) 알림 등에는 "안 읽음 빨간 점(배지)"을 띄울 수 있습니다.
//
// [이 컴포넌트는 어떻게 쓰나요?]
//   - UserLayout / GuardianLayout 에서 "탭 목록"을 만들어 넘겨주면,
//     이 컴포넌트가 그 목록대로 막대를 그려주고, 누르면 해당 주소로 이동시킵니다.
//   - 즉, "어떤 탭을 보여줄지"는 각 레이아웃이 정하고,
//     "탭 막대를 어떻게 그릴지"는 이 파일이 책임집니다. (역할 분리)
// =============================================================================

import type { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { COLORS } from "../../styles/tokens";

// -----------------------------------------------------------------------------
// [탭 하나의 정보 모양(타입)]
//   - label   : 탭 아래 보일 글자 (예: "홈", "기록")
//   - icon    : 탭에 보일 아이콘 (lucide 아이콘 컴포넌트를 넣습니다)
//   - path    : 이 탭을 누르면 이동할 주소 (예: "/", "/history")
//   - match   : (선택) "이 탭이 활성 상태인지" 판단할 때 쓸 추가 주소들.
//               예를 들어 '기록' 탭은 /history 뿐 아니라 /report-detail/... 에 있을 때도
//               활성으로 보이게 하고 싶을 때 사용합니다.
//   - badge   : (선택) true 면 탭 우측 위에 빨간 점(안 읽음 표시)을 띄웁니다.
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
  const pathname = location.pathname; // 지금 보고 있는 주소 (예: "/history")

  // 이 탭이 "지금 활성(선택됨)" 상태인지 판단하는 함수
  //   - 기본: 현재 주소가 탭의 path 와 정확히 같으면 활성
  //   - "/" 홈 탭은 정확히 "/"일 때만 활성 (안 그러면 모든 화면에서 홈이 켜져 보임)
  //   - match 에 적어둔 주소로 "시작"하는 경우에도 활성으로 칩니다.
  //     (예: match=["/report-detail"] → "/report-detail/daily/3" 에서도 활성)
  const isActive = (tab: TabItem) => {
    if (tab.path === "/") return pathname === "/";
    if (pathname === tab.path || pathname.startsWith(tab.path + "/")) return true;
    if (tab.match?.some((m) => pathname === m || pathname.startsWith(m + "/"))) return true;
    return false;
  };

  return (
    // fixed bottom-0: 화면 아래에 딱 붙여 고정 / z-40: 다른 요소 위에 보이게
    // 좌우로 꽉 채우고, 위쪽에 옅은 그림자를 줘서 본문과 구분합니다.
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200"
      style={{
        // 아이폰 등 하단 홈바 영역(노치)을 침범하지 않도록 안전 여백을 줍니다.
        paddingBottom: "env(safe-area-inset-bottom)",
        boxShadow: "0 -2px 10px rgba(0,0,0,0.05)",
      }}
    >
      <div className="flex items-stretch justify-around max-w-2xl mx-auto">
        {items.map((tab) => {
          const active = isActive(tab);
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              // 탭 하나: 세로로 [아이콘 → 글자] 배치, 충분히 큰 누름 영역(min 64px)
              className="relative flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors"
              style={{ minHeight: 64 }}
              aria-current={active ? "page" : undefined} // 스크린리더가 현재 탭을 알도록
            >
              {/* 아이콘 영역: 활성이면 primary 색, 아니면 회색 */}
              <span
                className="flex items-center justify-center"
                style={{ color: active ? COLORS.primary : "#9CA3AF" }}
              >
                {tab.icon}
                {/* 안 읽음 배지(빨간 점): badge=true 일 때만 표시 */}
                {tab.badge && (
                  <span className="absolute top-1.5 right-[calc(50%-22px)] w-2.5 h-2.5 bg-red-500 rounded-full" />
                )}
              </span>

              {/* 글자 라벨: 활성이면 primary 색 + 굵게, 아니면 회색 */}
              <span
                className="font-bold"
                style={{
                  fontSize: "0.8rem",
                  color: active ? COLORS.primary : "#6B7280",
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
