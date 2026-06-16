import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { callLogout, exchangeToken } from "../api/authApi";
import { setAccessToken } from "../api/tokenStore";

type Role = "user" | "guardian";

interface UserData {
  email: string;
  role: Role;
}

interface AuthContextType {
  user: UserData | null;
  role: Role | null;
  login: (userData: UserData, userRole: Role, token: string) => void;
  applySession: (userData: UserData, userRole: Role) => void;
  logout: () => void;
  loading: boolean;
}

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30분

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  // 부팅 시: 쿠키의 RefreshToken으로 세션 복구 (localStorage 토큰 사용 X)
  useEffect(() => {
    (async () => {
      try {
        const data = await exchangeToken(); // 쿠키 RT 있으면 성공
        setAccessToken(data.token);
        setUser(data.user);
        setRole(data.user.role);
        localStorage.setItem("role", data.user.role);
      } catch {
        // 쿠키 없음/만료 → 비로그인 상태 유지
        setAccessToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 일반 로그인 직후: AccessToken은 메모리에, RT는 이미 쿠키에 있음
  const login = (userData: UserData, userRole: Role, token: string) => {
    setAccessToken(token);
    setUser(userData);
    setRole(userRole);
    localStorage.setItem("role", userRole); // 화면 표시용 (토큰 아님)
  };

  // 소셜 콜백 등에서 토큰을 이미 메모리에 넣은 뒤 user/role만 반영
  const applySession = (userData: UserData, userRole: Role) => {
    setUser(userData);
    setRole(userRole);
    localStorage.setItem("role", userRole);
  };

  const logout = useCallback(() => {
    callLogout(); // 서버가 쿠키 만료 + RT 무효화
    setAccessToken(null);
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    setUser(null);
    setRole(null);
  }, []);

  // auth:logout 이벤트 (인터셉터가 refresh 실패 시 발생)
  useEffect(() => {
    const handleForcedLogout = () => {
      setAccessToken(null);
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
    <AuthContext.Provider value={{ user, role, login, applySession, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext)!;
