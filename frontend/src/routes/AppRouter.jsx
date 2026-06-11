import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/Registerpage";
import { UserLayout } from "../components/layout/UserLayout";
import { GuardianLayout } from "../components/layout/GuardianLayout";
import { MyPage } from "../pages/MyPage";
import { GuardianMyPage } from "../pages/GuardianMyPage";

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
        <Route path="/login"            element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/signup"           element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/mypage"           element={<PrivateRoute><MyPage /></PrivateRoute>} />
        <Route path="/guardian-mypage"  element={<PrivateRoute><GuardianMyPage /></PrivateRoute>} />
        <Route path="/*"                element={<PrivateRoute><RoleRouter /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  );
}