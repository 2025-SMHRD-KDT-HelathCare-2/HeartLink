// frontend/src/components/layout/UserLayout.tsx
// =============================================================================
// 사용자 레이아웃: 상단 헤더 + 본문 + 하단 탭바(4개)
//
// [화면 구조]
//   ┌─────────────────────────────┐
//   │ 헤더: 로고·앱이름·알림벨·로그아웃   │ ← 항상 위에 고정
//   ├─────────────────────────────┤
//   │  본문 (현재 탭에 맞는 화면)        │ ← 탭에 따라 바뀜
//   ├─────────────────────────────┤
//   │ [홈] [측정] [기록] [내 정보]      │ ← 항상 아래 고정 (BottomTabBar)
//   └─────────────────────────────┘
//
// [디자인 리뉴얼 포인트]
//   - 헤더를 단색 청록 → 청록→블루 "브랜드 그라데이션"으로 변경 (이미지 톤)
//   - 헤더 하단에 부드러운 그림자로 본문과 분리
//   - 알림벨 빨간 점 → COLORS.danger 토큰 / 버튼 hover white/15 로 통일
//   ※ 라우팅·알림 조회·탭 전환 로직은 기존과 100% 동일
//
// [탭 메뉴 4개]
//   홈      → "/"        : 내 건강 결과 요약 (ReportPage)
//   측정    → "/ecg"     : 측정/시각화 (UploadVisualizationPage)
//   기록    → "/history" : 지난 리포트 기록 (ReportHistoryPage)
//   내 정보 → "/mypage"  : 마이페이지 (MyPage)
// =============================================================================

import { useState, useEffect } from "react";
import { Heart, LogOut, Bell, Home, Activity, List, User } from "lucide-react";
import { useNavigate, useLocation, Routes, Route } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/authApi";
// 탭을 누르면 본문에 표시되는 화면들
import { ReportPage } from "../../pages/ReportPage";
import { ReportHistoryPage } from "../../pages/ReportHistoryPage";
import { UploadVisualizationPage } from "../../pages/UploadVisualizationPage";
import { MyPage } from "../../pages/MyPage";
// 공통 하단 탭바 + 탭 한 개의 타입
import { BottomTabBar, type TabItem } from "./BottomTabBar";
import { COLORS, GRADIENTS } from "../../styles/tokens";

export function UserLayout({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();

  // 안 읽은 알림이 하나라도 있으면 헤더 종에 빨간 점을 띄우기 위한 상태
  const [hasUnread, setHasUnread] = useState(false);

  // 로그인한 사용자 정보(닉네임 표시용)
  const { user } = useAuth();
  const nickname =
    (user as any)?.nickname || (user as any)?.email?.split("@")[0] || "사용자";

  // 화면이 바뀔 때마다 알림을 다시 조회해서 빨간 점(안 읽음 여부)을 갱신
  //   - location.pathname 을 의존성에 넣어, 알림함(/notifications)을 다녀오면
  //     안 읽음 상태가 갱신되도록 한다.
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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: COLORS.appBg }}>

      {/* ───────────────── 상단 헤더 (항상 고정) ─────────────────
          단색 청록 대신 브랜드 그라데이션으로 변경 + 부드러운 그림자 */}
      <header
        className="text-white px-5 py-4 flex items-center justify-between sticky top-0 z-30"
        style={{ background: GRADIENTS.brand, boxShadow: "0 4px 16px rgba(13, 148, 136, 0.25)" }}
      >
        {/* 왼쪽: 로고 + 앱 이름 + 인사말 */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <Heart className="w-7 h-7 text-white fill-current" />
          </div>
          <div>
            <div className="font-black" style={{ fontSize: "1.4rem" }}>HeartLink</div>
            <div className="text-white/70 font-bold text-tiny">{nickname}님 환영합니다</div>
          </div>
        </div>

        {/* 오른쪽: 알림 종(빨간 점 배지) + 로그아웃 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/notifications")}
            className="relative p-2.5 rounded-xl hover:bg-white/15 transition-colors"
            title="알림"
            style={{ minHeight: 48, minWidth: 48 }}
          >
            <Bell className="w-6 h-6 text-white" />
            {hasUnread && (
              <span
                className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-white/40"
                style={{ backgroundColor: COLORS.danger }}
              />
            )}
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3 py-2 text-white/80 hover:text-white hover:bg-white/15 rounded-xl transition-colors font-bold text-small"
            style={{ minHeight: 48 }}
          >
            <LogOut className="w-5 h-5" />
            <span className="hidden sm:inline">나가기</span>
          </button>
        </div>
      </header>

      {/* ───────────────── 본문 (현재 탭 화면) ─────────────────
          하단 탭바에 가리지 않도록 아래 여백(paddingBottom)을 둔다. */}
      <main className="flex-1" style={{ paddingBottom: 88 }}>
        <Routes>
          <Route path="/" element={<ReportPage />} />
          <Route path="/ecg" element={<UploadVisualizationPage />} />
          <Route path="/history" element={<ReportHistoryPage />} />
          <Route path="/mypage" element={<MyPage />} />
        </Routes>
      </main>

      {/* ───────────────── 하단 탭바 (항상 고정) ───────────────── */}
      <BottomTabBar items={tabs} />
    </div>
  );
}
