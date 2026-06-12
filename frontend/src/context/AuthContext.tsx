import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { callLogout } from "../api/authApi";

type Role = "user" | "guardian";

interface UserData {
  email: string;
  role: Role;
}

interface AuthContextType {
  user: UserData | null;
  role: Role | null;
  login: (userData: UserData, userRole: Role, token: string, refreshToken: string) => void;
  logout: () => void;
  loading: boolean;
}

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30분

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedRole = localStorage.getItem("role");
    const savedUser = localStorage.getItem("user");
    if (token && savedRole && savedUser) {
      setRole(savedRole as Role);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = (userData: UserData, userRole: Role, token: string, refreshToken: string) => {
    localStorage.setItem("token", token);
    localStorage.setItem("refreshToken", refreshToken);
    localStorage.setItem("role", userRole);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    setRole(userRole);
  };

  const logout = useCallback(() => {
    const rt = localStorage.getItem("refreshToken");
    if (rt) callLogout(rt);
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    setUser(null);
    setRole(null);
  }, []);

  // auth:logout 이벤트 (인터셉터가 refresh 실패 시 발생)
  useEffect(() => {
    const handleForcedLogout = () => {
      setUser(null);
      setRole(null);
    };
    window.addEventListener("auth:logout", handleForcedLogout);
    return () => window.removeEventListener("auth:logout", handleForcedLogout);
  }, []);

  // 30분 비활동 감지 → 강제 로그아웃
  const logoutRef = useRef(logout);
  useEffect(() => { logoutRef.current = logout; }, [logout]);

  useEffect(() => {
    if (!user) return;

    const lastActivity = { ts: Date.now() };
    const updateActivity = () => { lastActivity.ts = Date.now(); };

    window.addEventListener("mousemove", updateActivity);
    window.addEventListener("keydown", updateActivity);
    window.addEventListener("click", updateActivity);
    window.addEventListener("touchstart", updateActivity);

    const timer = setInterval(() => {
      if (Date.now() - lastActivity.ts >= INACTIVITY_LIMIT_MS) {
        logoutRef.current();
      }
    }, 60_000);

    return () => {
      window.removeEventListener("mousemove", updateActivity);
      window.removeEventListener("keydown", updateActivity);
      window.removeEventListener("click", updateActivity);
      window.removeEventListener("touchstart", updateActivity);
      clearInterval(timer);
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, role, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext)!;
