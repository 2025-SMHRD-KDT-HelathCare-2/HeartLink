import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

import { LoginPage } from "../pages/LoginPage";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";
import { FindIdPage } from "../pages/FindIdPage";
import { ResetPasswordPage } from "../pages/ResetPasswordPage";
import { RegisterPage } from "../pages/Registerpage";
import { OAuthCallbackPage } from "../pages/OAuthCallbackPage";
import { SocialRoleSelectPage } from "../pages/SocialRoleSelectPage";
import { UserLayout } from "../components/layout/UserLayout";
import { GuardianLayout } from "../components/layout/GuardianLayout";
import { MyPage } from "../pages/MyPage";
import { GuardianMyPage } from "../pages/GuardianMyPage";
import { GuardianReportDetailPage } from "../pages/GuardianReportDetailPage";
import { UserReportDetailPage } from "../pages/UserReportDetailPage";
import { UserNotificationsPage } from "../pages/UserNotificationsPage";
import { MeasurementDetailPage } from "../pages/MeasurementDetailPage";
import { ReportHistoryListPage } from "../pages/ReportHistoryListPage";
import { GuardianReportHistoryPage } from "../pages/GuardianReportHistoryPage";

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

function RoleRouter() {
  const { role, logout } = useAuth();
  if (role === "guardian") return <GuardianLayout onLogout={logout} />;
  return <UserLayout onLogout={logout} />;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"                             element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/signup"                            element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/find-id"                           element={<PublicRoute><FindIdPage /></PublicRoute>} />
        <Route path="/forgot-password"                   element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
        <Route path="/reset-password"                    element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
        <Route path="/oauth/callback"                    element={<OAuthCallbackPage />} />
        <Route path="/social-role"                       element={<SocialRoleSelectPage />} />
        <Route path="/mypage"                            element={<PrivateRoute><MyPage /></PrivateRoute>} />
        <Route path="/guardian-mypage"                   element={<PrivateRoute><GuardianMyPage /></PrivateRoute>} />
        <Route path="/report-detail"                     element={<PrivateRoute><UserReportDetailPage /></PrivateRoute>} />
        <Route path="/report-history-list"               element={<PrivateRoute><ReportHistoryListPage /></PrivateRoute>} />
        <Route path="/notifications"                     element={<PrivateRoute><UserNotificationsPage /></PrivateRoute>} />
        <Route path="/guardian-report-detail/:memberId"  element={<PrivateRoute><GuardianReportDetailPage /></PrivateRoute>} />
        <Route path="/guardian-report-history/:userId"   element={<PrivateRoute><GuardianReportHistoryPage /></PrivateRoute>} />
        <Route path="/measurement/:id"                   element={<PrivateRoute><MeasurementDetailPage /></PrivateRoute>} />
        <Route path="/*"                                 element={<PrivateRoute><RoleRouter /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  );
}