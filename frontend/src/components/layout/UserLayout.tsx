// frontend/src/components/layout/UserLayout.tsx
// =============================================================================
// 사용자(시니어) 레이아웃 — 상단 헤더 + 본문 + 하단 탭바(4개)
//
// [이 화면의 큰 그림]
//   ┌───────────────────────────────┐
//   │ 헤더: 로고 · 앱이름 · 알림종 · 로그아웃 │  ← 항상 위에 고정
//   ├───────────────────────────────┤
//   │                               │
//   │   본문 (현재 탭에 맞는 화면)        │  ← 탭에 따라 바뀜
//   │                               │
//   ├───────────────────────────────┤
//   │  [❤️홈] [📈측정] [📋기록] [👤내정보] │  ← 항상 아래에 고정 (BottomTabBar)
//   └───────────────────────────────┘
//
// [이전 방식과 무엇이 달라졌나요?]
//   - 이전: 카드형 메뉴 + 햄버거(모바일 드롭다운)로 화면 전환
//   - 변경: 화면 아래 "하단 탭바"로 전환 → 어르신이 한 손 엄지로 누르기 쉽고,
//           지금 어느 메뉴에 있는지 항상 한눈에 보입니다.
//   - 알림은 탭에 넣지 않고 "헤더의 종 아이콘 + 빨간 점"으로 둡니다.
//     (알림은 수시로 오가기보다 '배지 보고 들어가는' 성격이라 헤더가 더 적합)
//
// [탭(메뉴) 구성 — 4개]
//   ❤️ 홈     → "/"        : 내 건강 결과 요약 (ReportPage)
//   📈 측정   → "/ecg"     : 심전도 올리기·보기 (UploadVisualizationPage)
//   📋 기록   → "/history" : 지난 리포트 기록 (ReportHistoryPage)
//   👤 내 정보 → "/mypage"  : 마이페이지 (MyPage)
//
//   ※ '홈/기록' 탭은 리포트 상세(/report-detail/...)로,
//     '측정' 탭은 측정 상세(/measurement/...)로 들어가도 활성으로 보이게
//     match 옵션을 줍니다. (상세 화면에서도 어느 탭인지 헷갈리지 않도록)
// =============================================================================

import { useState, useEffect } from "react";
import { Heart, LogOut, Bell, Home, Activity, List, User } from "lucide-react";
import { useNavigate, useLocation, Routes, Route } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/authApi";
// 탭을 눌렀을 때 본문에 표시할 화면들
import { ReportPage } from "../../pages/ReportPage";
import { ReportHistoryPage } from "../../pages/ReportHistoryPage";
import { UploadVisualizationPage } from "../../pages/UploadVisualizationPage";
import { MyPage } from "../../pages/MyPage";
// 공통 하단 탭바 + 탭 한 개의 타입
import { BottomTabBar, type TabItem } from "./BottomTabBar";
import { COLORS } from "../../styles/tokens";

export function UserLayout({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();

  // 알림 '안 읽음'이 하나라도 있으면 헤더 종에 빨간 점을 띄우기 위한 상태
  const [hasUnread, setHasUnread] = useState(false);

  // 로그인한 사용자 정보(닉네임 표시용)
  const { user } = useAuth();
  const nickname =
    (user as any)?.nickname || (user as any)?.email?.split("@")[0] || "사용자";

  // 화면이 처음 뜰 때(그리고 알림함을 보고 돌아왔을 때) 안 읽음 여부 확인
  //   - location.pathname 을 의존성에 넣어, 알림함(/notifications)에 다녀오면
  //     다시 조회해서 빨간 점을 갱신합니다.
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/notifications");
        const unread = (res.data || []).some(
          (n: any) => !n.isRead && !n.is_read
        );
        setHasUnread(unread);
      } catch (e) {
        console.error("알림 조회 실패", e);
      }
    })();
  }, [location.pathname]);

  // -------------------------------------------------------------------------
  // [탭 목록 정의]
  //   - 여기서 "어떤 탭을 보여줄지"만 정합니다. 실제 막대 그리기는 BottomTabBar 담당.
  //   - match: 상세 화면에 들어가도 해당 탭을 활성으로 보이게 하는 추가 주소들
  // -------------------------------------------------------------------------
  const tabs: TabItem[] = [
    {
      label: "홈",
      icon: <Home className="w-7 h-7" />,
      path: "/",
      match: ["/report-detail"], // 리포트 상세에서도 '홈' 활성
    },
    {
      label: "측정",
      icon: <Activity className="w-7 h-7" />,
      path: "/ecg",
      match: ["/measurement"], // 측정 상세에서도 '측정' 활성
    },
    {
      label: "기록",
      icon: <List className="w-7 h-7" />,
      path: "/history",
      match: ["/report-history-list"], // 전체 기록 목록에서도 '기록' 활성
    },
    {
      label: "내 정보",
      icon: <User className="w-7 h-7" />,
      path: "/mypage",
    },
  ];

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: COLORS.appBg }}
    >
      {/* ───────────────── 상단 헤더 (항상 고정) ───────────────── */}
      <header
        className="text-white px-5 py-4 flex items-center justify-between sticky top-0 z-30 shadow-lg"
        style={{ backgroundColor: COLORS.primary }}
      >
        {/* 왼쪽: 로고 + 앱 이름 */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Heart className="w-7 h-7 text-white fill-current" />
          </div>
          <div>
            <div className="font-black" style={{ fontSize: "1.4rem" }}>
              HeartLink
            </div>
            <div className="text-white/60 font-bold text-tiny">
              {nickname}님 환영합니다
            </div>
          </div>
        </div>

        {/* 오른쪽: 알림 종(빨간 점 배지) + 로그아웃 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/notifications")}
            className="relative p-2.5 rounded-xl hover:bg-white/10 transition-colors"
            title="알림함"
            style={{ minHeight: 48, minWidth: 48 }}
          >
            <Bell className="w-6 h-6 text-white" />
            {hasUnread && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full" />
            )}
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors font-bold text-small"
            style={{ minHeight: 48 }}
          >
            <LogOut className="w-5 h-5" />
            <span className="hidden sm:inline">나가기</span>
          </button>
        </div>
      </header>

      {/* ───────────────── 본문 (현재 탭 화면) ─────────────────
          - 하단 탭바(높이 약 72px)에 가려지지 않도록 아래 여백을 넉넉히 줍니다. */}
      <main className="flex-1" style={{ paddingBottom: 88 }}>
        <Routes>
          <Route path="/" element={<ReportPage />} />
          <Route path="/ecg" element={<UploadVisualizationPage />} />
          <Route path="/history" element={<ReportHistoryPage />} />
          <Route path="/mypage" element={<MyPage />} />
        </Routes>
      </main>

      {/* ───────────────── 하단 탭바 (항상 고정) ─────────────────
          - tabs 목록을 그대로 넘기면 막대를 그려주고, 누르면 해당 주소로 이동합니다. */}
      <BottomTabBar items={tabs} />
    </div>
  );
}
