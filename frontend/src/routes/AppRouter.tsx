// ============================================================================
// src/routes/AppRouter.tsx
//
// 앱 전체의 "화면 길잡이(라우터)"입니다.
// 지금 주소(URL)에 따라 어떤 화면을 보여줄지 결정합니다.
//
// 큰 그림:
//   (1) 세션 확인 중  → 스플래시(로딩) 화면
//   (2) 로그인 안 됨  → 로그인/회원가입/비밀번호 찾기 등 "인증 전" 화면만 접근
//   (3) 로그인 됨     → 본체 화면들. 단, 화면 성격에 따라 두 갈래로 나뉩니다.
//        · 탭 화면(/, /history, /ecg, 보호자 탭) → 레이아웃이 헤더와 함께 그림
//          (이 탭들의 가운데 내용은 UserLayout / GuardianLayout 내부의 <Routes>가 담당)
//        · 독립 화면(상세, 마이페이지, 알림 등)   → 여기 AppRouter에서 직접 라우트로 그림
//
// [디자인 리뉴얼 포인트]
//   - SplashScreen(로딩 화면)을 브랜드 그라데이션 배경 + 흰색 스피너로 통일
//     (OAuthCallbackPage 로딩 화면과 동일 톤)
//   - 라우팅 로직(문지기/레이아웃/Route 정의)은 변경 없음
// ============================================================================

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { GRADIENTS } from "../styles/tokens";

// ---- 인증 전 화면 (모두 named export) ----
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/Registerpage";   // 파일명은 소문자 p (Registerpage)
import { FindIdPage } from "../pages/FindIdPage";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";
import { ResetPasswordPage } from "../pages/ResetPasswordPage";
import { OAuthCallbackPage } from "../pages/OAuthCallbackPage";
import { SocialRoleSelectPage } from "../pages/SocialRoleSelectPage";

// ---- 본체 "독립 화면" (헤더 없이 단독으로 뜨는 화면, 모두 named export) ----
import { UserNotificationsPage } from "../pages/UserNotificationsPage";
import { MeasurementDetailPage } from "../pages/MeasurementDetailPage";
import { ReportHistoryListPage } from "../pages/ReportHistoryListPage";
import { GuardianReportHistoryPage } from "../pages/GuardianReportHistoryPage";

// ---- 본체 레이아웃 (탭 화면을 헤더와 함께 그림, named export) ----
import { UserLayout } from "../components/layout/UserLayout";
import { GuardianLayout } from "../components/layout/GuardianLayout";

// ---- 리포트 상세 래퍼 (이 둘만 default export) ----
import UserReportDetailPage from "../pages/UserReportDetailPage";
import GuardianReportDetailPage from "../pages/GuardianReportDetailPage";


// ============================================================================
// 스플래시(로딩) 화면
// - 앱 실행 직후, 저장된 세션이 유효한지 확인하는 "잠깐" 동안 보여줍니다.
// - 이게 있어야 로그인된 사용자가 새로고침해도 로그인 화면이 깜빡이지 않습니다.
// - 디자인 리뉴얼: 브랜드 그라데이션 배경 + 흰색 스피너 (다른 로딩 화면과 통일)
// ============================================================================
function SplashScreen() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-5"
      style={{ background: GRADIENTS.brand }}
    >
      {/* 흰색 스피너 */}
      <div
        className="w-10 h-10 rounded-full border-4 border-white/30 border-t-white animate-spin"
        aria-hidden="true"
      />
      <p className="text-white font-bold text-lg">불러오는 중입니다…</p>
    </div>
  );
}


// ============================================================================
// PrivateRoute: "로그인한 사람만" 통과시키는 문지기
// - 로그인 안 돼 있으면(user 없음) 로그인 화면으로 돌려보냅니다.
// - replace: 뒤로가기 했을 때 막힌 화면으로 되돌아가지 않게 합니다.
// ============================================================================
function PrivateRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}


// ============================================================================
// PublicRoute: "로그인 안 한 사람만" 통과시키는 문지기
// - 이미 로그인한 사람이 로그인/회원가입 화면에 오면 본체("/")로 돌려보냅니다.
// ============================================================================
function PublicRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}


// ============================================================================
// 레이아웃 선택용 작은 도우미
// - 탭 화면(/, /history, /ecg 등)은 역할에 맞는 레이아웃이 헤더와 함께 그립니다.
// - 두 레이아웃 모두 onLogout(로그아웃 함수)을 필수로 받으므로 logout 을 넘깁니다.
//
// ※ 사용자/보호자가 같은 주소(예: "/")를 공유할 수 있으니,
//   "탭 화면 주소"에서는 역할에 따라 레이아웃을 골라주는 RoleLayout 을 씁니다.
// ============================================================================
function RoleLayout() {
  const { role, logout } = useAuth();
  if (role === "guardian") return <GuardianLayout onLogout={logout} />;
  return <UserLayout onLogout={logout} />;
}


// ============================================================================
// AppRouter: 위 조각들을 조립하는 최상위 라우터
// ============================================================================
export default function AppRouter() {
  // 초기 세션 확인이 끝났는지(loading)를 가져옵니다.
  const { loading } = useAuth();

  // (1) 세션 확인이 끝날 때까지는 스플래시만 보여줍니다.
  if (loading) return <SplashScreen />;

  return (
    <BrowserRouter>
      <Routes>
        {/* ================= (2) 인증 전 그룹 ================= */}
        {/* 이미 로그인한 사람은 PublicRoute 가 본체("/")로 돌려보냅니다. */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/find-id" element={<PublicRoute><FindIdPage /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
        <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />

        {/* ----- 소셜 로그인 "진행 중" 단계 (PublicRoute로 감싸지 않음) ----- */}
        {/*  - OAuthCallbackPage: error / needRole 여부로 스스로 분기 */}
        {/*  - SocialRoleSelectPage: 역할 선택 + 전화 인증 후 본체로 이동 */}
        <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
        <Route path="/social-role" element={<SocialRoleSelectPage />} />

        {/* ================= (3-1) 본체: 독립 화면 ================= */}
        {/* 헤더 없이 단독으로 뜨는 화면들. 각자 고유 주소를 가집니다. */}
        {/* 모두 PrivateRoute 로 감싸 로그인한 사람만 접근하게 합니다.   */}

        <Route path="/notifications" element={<PrivateRoute><UserNotificationsPage /></PrivateRoute>} />

        {/* 리포트 기록 목록 (탭의 '지난 기록'과는 다른 별도 페이지) */}
        <Route path="/report-history-list" element={<PrivateRoute><ReportHistoryListPage /></PrivateRoute>} />

        {/* 측정 상세: /measurement/123 처럼 ID를 주소에 담음 */}
        <Route path="/measurement/:id" element={<PrivateRoute><MeasurementDetailPage /></PrivateRoute>} />

        {/* 리포트 상세: type(daily/weekly) + id 를 주소에 담음 → /report-detail/daily/42 */}
        <Route path="/report-detail/:type/:id" element={<PrivateRoute><UserReportDetailPage /></PrivateRoute>} />

        {/* 보호자 리포트 기록: 환자 userId */}
        <Route path="/guardian-report-history/:userId" element={<PrivateRoute><GuardianReportHistoryPage /></PrivateRoute>} />

        {/* 보호자 리포트 상세: 환자 userId + type + reportId → /guardian-report-detail/7/daily/42 */}
        <Route path="/guardian-report-detail/:userId/:type/:id" element={<PrivateRoute><GuardianReportDetailPage /></PrivateRoute>} />

        {/* ================= (3-2) 본체: 탭 화면 ================= */}
        {/* /, /history, /ecg (및 보호자 탭)은 레이아웃이 "헤더와 함께" 그립니다. */}
        {/* 가운데 내용은 UserLayout / GuardianLayout 내부의 <Routes>가 담당합니다. */}
        {/* path="/*" 는 위에서 매칭되지 않은 나머지 주소를 전부 레이아웃으로 보냅니다. */}
        <Route path="/*" element={<PrivateRoute><RoleLayout /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
