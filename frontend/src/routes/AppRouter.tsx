// ============================================================================
// src/routes/AppRouter.tsx
//
// 앱 전체의 "화면 길잡이(라우터)"입니다.
//
// [번들/로딩 최적화 포인트]
//   - 모든 페이지를 React.lazy + 동적 import() 로 "필요할 때 로드"합니다.
//     → 처음 앱을 켤 때는 지금 보여줄 화면의 코드만 내려받고,
//       나머지 화면 코드는 그 주소로 이동할 때 비로소 내려받습니다.
//       (= 초기 로딩 속도 향상)
//   - lazy 화면은 로드되는 "잠깐" 동안 보여줄 화면이 필요하므로
//     <Suspense fallback=...> 으로 감싸고, 기존 SplashScreen 을 재사용합니다.
//
// [중요] 라우팅 규칙/문지기(Private·PublicRoute)/역할 분기(RoleLayout) 로직은
//        그대로입니다. 바뀐 것은 "컴포넌트를 어떻게 불러오느냐(import 방식)" 뿐입니다.
// ============================================================================

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { GRADIENTS } from "../styles/tokens";

// -----------------------------------------------------------------------------
// [지연 로딩(lazy) 화면들]
//   - import() 는 "그 화면이 실제로 필요해지는 순간" 코드를 내려받습니다.
//   - named export 인 화면은 .then 으로 default 형태로 바꿔줍니다.
//     (React.lazy 는 'default export' 를 기대하기 때문입니다.)
//   - 이미 default export 인 두 개(리포트 상세 래퍼)는 그대로 import() 합니다.
// -----------------------------------------------------------------------------

// 인증 전 화면
const LoginPage = lazy(() =>
  import("../pages/LoginPage").then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() =>
  import("../pages/Registerpage").then(m => ({ default: m.RegisterPage })));
const FindIdPage = lazy(() =>
  import("../pages/FindIdPage").then(m => ({ default: m.FindIdPage })));
const ForgotPasswordPage = lazy(() =>
  import("../pages/ForgotPasswordPage").then(m => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() =>
  import("../pages/ResetPasswordPage").then(m => ({ default: m.ResetPasswordPage })));
const OAuthCallbackPage = lazy(() =>
  import("../pages/OAuthCallbackPage").then(m => ({ default: m.OAuthCallbackPage })));
const SocialRoleSelectPage = lazy(() =>
  import("../pages/SocialRoleSelectPage").then(m => ({ default: m.SocialRoleSelectPage })));

// 본체 "독립 화면"
const UserNotificationsPage = lazy(() =>
  import("../pages/UserNotificationsPage").then(m => ({ default: m.UserNotificationsPage })));
const MeasurementDetailPage = lazy(() =>
  import("../pages/MeasurementDetailPage").then(m => ({ default: m.MeasurementDetailPage })));
const ReportHistoryListPage = lazy(() =>
  import("../pages/ReportHistoryListPage").then(m => ({ default: m.ReportHistoryListPage })));
const GuardianReportHistoryPage = lazy(() =>
  import("../pages/GuardianReportHistoryPage").then(m => ({ default: m.GuardianReportHistoryPage })));

// 본체 레이아웃 (탭 화면을 헤더와 함께 그림)
const UserLayout = lazy(() =>
  import("../components/layout/UserLayout").then(m => ({ default: m.UserLayout })));
const GuardianLayout = lazy(() =>
  import("../components/layout/GuardianLayout").then(m => ({ default: m.GuardianLayout })));

// 리포트 상세 래퍼 (이 둘은 원래부터 default export 라 .then 변환이 필요 없음)
const UserReportDetailPage = lazy(() => import("../pages/UserReportDetailPage"));
const GuardianReportDetailPage = lazy(() => import("../pages/GuardianReportDetailPage"));


// ============================================================================
// 스플래시(로딩) 화면
// - 두 가지 용도로 씁니다:
//   (1) 앱 부팅 시 세션 확인하는 잠깐 동안
//   (2) lazy 화면 코드가 내려받히는 잠깐 동안(Suspense fallback)
// - 브랜드 그라데이션 배경 + 흰색 스피너로 다른 로딩 화면과 톤을 맞춥니다.
// ============================================================================
function SplashScreen() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-5"
      style={{ background: GRADIENTS.brand }}
    >
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
// ============================================================================
function PrivateRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}


// ============================================================================
// PublicRoute: "로그인 안 한 사람만" 통과시키는 문지기
// ============================================================================
function PublicRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}


// ============================================================================
// 레이아웃 선택용 작은 도우미 (역할에 맞는 레이아웃을 고름)
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
  const { loading } = useAuth();

  // (1) 세션 확인이 끝날 때까지는 스플래시만 보여줍니다.
  if (loading) return <SplashScreen />;

  return (
    <BrowserRouter>
      {/* lazy 화면 코드가 내려받히는 동안 SplashScreen 을 보여줍니다. */}
      <Suspense fallback={<SplashScreen />}>
        <Routes>
          {/* ================= (2) 인증 전 그룹 ================= */}
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/find-id" element={<PublicRoute><FindIdPage /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
          <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />

          {/* ----- 소셜 로그인 "진행 중" 단계 ----- */}
          <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
          <Route path="/social-role" element={<SocialRoleSelectPage />} />

          {/* ================= (3-1) 본체: 독립 화면 ================= */}
          <Route path="/notifications" element={<PrivateRoute><UserNotificationsPage /></PrivateRoute>} />
          <Route path="/report-history-list" element={<PrivateRoute><ReportHistoryListPage /></PrivateRoute>} />
          <Route path="/measurement/:id" element={<PrivateRoute><MeasurementDetailPage /></PrivateRoute>} />
          <Route path="/report-detail/:type/:id" element={<PrivateRoute><UserReportDetailPage /></PrivateRoute>} />
          <Route path="/guardian-report-history/:userId" element={<PrivateRoute><GuardianReportHistoryPage /></PrivateRoute>} />
          <Route path="/guardian-report-detail/:userId/:type/:id" element={<PrivateRoute><GuardianReportDetailPage /></PrivateRoute>} />

          {/* ================= (3-2) 본체: 탭 화면 ================= */}
          <Route path="/*" element={<PrivateRoute><RoleLayout /></PrivateRoute>} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
