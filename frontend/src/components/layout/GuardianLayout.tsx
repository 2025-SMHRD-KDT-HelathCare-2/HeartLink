// frontend/src/components/layout/GuardianLayout.tsx
// =============================================================================
// 보호자 레이아웃 — 상단 헤더 + 본문 + 하단 탭바(4개)
//
// [이 파일의 역할 — 두 가지]
//   1) 화면 틀: 헤더(위 고정) + 본문(탭별 화면) + 하단 탭바(아래 고정)
//   2) 데이터 중심지: 돌보는 "환자 목록"과 "알림"을 한 곳에서 불러와,
//      각 탭 화면(대시보드/리포트/알림)에 props 로 내려줍니다.
//
// [왜 레이아웃이 데이터를 들고 있나요?]
//   - 대시보드에서 고른 환자를 리포트 화면에서도 그대로 봐야 합니다.
//     (예: 김OO 환자를 누르면 → 리포트 탭에서 김OO의 리포트가 보여야 함)
//   - 그래서 "지금 선택한 환자(selectedUserId)"를 레이아웃이 기억하고,
//     대시보드/리포트 양쪽에 함께 내려줘 화면이 바뀌어도 선택이 유지됩니다.
//
// [탭(메뉴) 구성 — 4개]
//   🏠 홈     → "/"                      : 환자 목록 + 위험도 (GuardianDashboard)
//   📊 리포트 → "/guardian-report"        : 선택한 환자의 리포트 (GuardianReportPage)
//   🔔 알림   → "/guardian-notifications"  : 알림함 (NotificationsPage)
//   👤 내 정보 → "/guardian-mypage"        : 보호자 마이페이지 (GuardianMyPage)
//
// [환자 선택이 화면 사이로 이어지는 흐름]
//   - 대시보드에서 환자 클릭 → handleSelectMember(userId)
//       → 선택 환자 저장 + 리포트 탭(/guardian-report)으로 자동 이동
//   - 리포트 화면에서 다른 환자로 바꿈 → handleSelectUser(userId)
//       → 선택 환자만 갱신 (이동은 안 함)
//   - 알림의 '리포트 보기'(위험 알림) → handleViewReport()
//       → 리포트 탭으로 이동
// =============================================================================

import { useState, useEffect } from "react";
import { Heart, LogOut, Home, FileText, Bell, User } from "lucide-react";
import { useNavigate, useLocation, Routes, Route } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
// 환자 목록 / 알림을 불러오는 API 함수들
import { getPatients, getNotifications } from "../../api/guardianApi";
// 탭을 눌렀을 때 본문에 표시할 화면들
import { GuardianDashboard } from "../../pages/GuardianDashboard";
import { GuardianReportPage } from "../../pages/GuardianReportPage";
import { NotificationsPage } from "../../pages/NotificationsPage";
import { GuardianMyPage } from "../../pages/GuardianMyPage";
// 공통 하단 탭바 + 탭 한 개의 타입
import { BottomTabBar, type TabItem } from "./BottomTabBar";
import { COLORS } from "../../styles/tokens";

export function GuardianLayout({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();

  // ── 데이터 상태 ──────────────────────────────────────────
  // patients: 돌보는 환자 목록 / notifications: 알림 목록
  // selectedUserId: 지금 보고 있는(선택한) 환자의 id. 없으면 null.
  const [patients, setPatients] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // 로그인한 보호자 정보(닉네임 표시용)
  const { user } = useAuth();
  const nickname =
    (user as any)?.nickname || (user as any)?.email?.split("@")[0] || "보호자";

  // ── 환자 목록 불러오기 (화면 처음 진입 시 1번) ──
  //   불러온 뒤, 아직 선택한 환자가 없으면 첫 번째 환자를 기본 선택해 둡니다.
  useEffect(() => {
    (async () => {
      try {
        const data = await getPatients();
        setPatients(data || []);
        // 선택된 환자가 없고 목록이 있으면 첫 환자를 기본값으로
        if (!selectedUserId && data && data.length > 0) {
          setSelectedUserId(data[0].user_id);
        }
      } catch (e) {
        console.error("환자 목록 조회 실패", e);
      }
    })();
    // 최초 1번만 실행 (selectedUserId 변화로 재실행되지 않도록 빈 배열)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 알림 불러오기 (화면 진입 + 탭 이동 시마다) ──
  //   location.pathname 을 의존성에 둬서, 알림 탭에 다녀오면 다시 조회해
  //   탭의 '안 읽음 빨간 점'을 최신 상태로 갱신합니다.
  useEffect(() => {
    (async () => {
      try {
        const data = await getNotifications();
        setNotifications(data || []);
      } catch (e) {
        console.error("알림 조회 실패", e);
      }
    })();
  }, [location.pathname]);

  // 안 읽은 알림이 하나라도 있는지 (탭 배지 표시용)
  const hasUnread = notifications.some((n: any) => !n.isRead && !n.is_read);

  // -------------------------------------------------------------------------
  // [환자 선택/이동 핸들러] — 각 페이지의 콜백 props 로 내려줍니다.
  // -------------------------------------------------------------------------
  // 대시보드에서 환자 클릭: 선택 저장 + 리포트 탭으로 이동
  const handleSelectMember = (userId: string) => {
    setSelectedUserId(userId);
    navigate("/guardian-report");
  };
  // 리포트 화면에서 환자 바꿈: 선택만 갱신 (이동 없음)
  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId);
  };
  // 알림의 '리포트 보기'(위험 알림): 리포트 탭으로 이동
  const handleViewReport = () => {
    navigate("/guardian-report");
  };

  // -------------------------------------------------------------------------
  // [탭 목록 정의]
  // -------------------------------------------------------------------------
  const tabs: TabItem[] = [
    { label: "홈", icon: <Home className="w-7 h-7" />, path: "/" },
    {
      label: "리포트",
      icon: <FileText className="w-7 h-7" />,
      path: "/guardian-report",
      match: ["/guardian-report-detail", "/guardian-report-history"],
    },
    {
      label: "알림",
      icon: <Bell className="w-7 h-7" />,
      path: "/guardian-notifications",
      badge: hasUnread, // 안 읽음 있으면 빨간 점
    },
    {
      label: "내 정보",
      icon: <User className="w-7 h-7" />,
      path: "/guardian-mypage",
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
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Heart className="w-7 h-7 text-white fill-current" />
          </div>
          <div>
            <div className="font-black" style={{ fontSize: "1.4rem" }}>
              HeartLink
            </div>
            <div className="text-white/60 font-bold text-tiny">
              {nickname}님 · 보호자
            </div>
          </div>
        </div>

        {/* 오른쪽: 로그아웃 (알림은 하단 탭에 있으므로 헤더에는 두지 않음) */}
        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-3 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors font-bold text-small"
          style={{ minHeight: 48 }}
        >
          <LogOut className="w-5 h-5" />
          <span className="hidden sm:inline">나가기</span>
        </button>
      </header>

      {/* ───────────────── 본문 (현재 탭 화면) ─────────────────
          - 각 페이지가 필요로 하는 props 를 여기서 내려줍니다.
          - 하단 탭바에 가려지지 않도록 아래 여백을 넉넉히 줍니다. */}
      <main className="flex-1" style={{ paddingBottom: 88 }}>
        <Routes>
          <Route
            path="/"
            element={
              <GuardianDashboard
                patients={patients}
                notifications={notifications}
                onSelectMember={handleSelectMember}
              />
            }
          />
          <Route
            path="/guardian-report"
            element={
              <GuardianReportPage
                patients={patients}
                selectedUserId={selectedUserId}
                onSelectUser={handleSelectUser}
              />
            }
          />
          <Route
            path="/guardian-notifications"
            element={<NotificationsPage onViewReport={handleViewReport} />}
          />
          <Route path="/guardian-mypage" element={<GuardianMyPage />} />
        </Routes>
      </main>

      {/* ───────────────── 하단 탭바 (항상 고정) ───────────────── */}
      <BottomTabBar items={tabs} />
    </div>
  );
}
