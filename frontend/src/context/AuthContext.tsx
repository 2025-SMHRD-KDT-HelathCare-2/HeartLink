import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { callLogout, exchangeToken } from "../api/authApi";
import { setAccessToken } from "../api/tokenStore";
import api from "../api/authApi";
import { onMessage } from 'firebase/messaging';
import { messaging, getToken, VAPID_KEY } from '../firebase';
import { resolveNotificationPath } from '../utils/notificationLink'; // ← 추가


type Role = "user" | "guardian";

interface UserData {
  email: string;
  role: Role;
  nickname?: string;
}

interface AuthContextType {
  user: UserData | null;
  role: Role | null;
  login: (userData: UserData, userRole: Role, token: string) => void;
  applySession: (userData: UserData, userRole: Role) => void;
  logout: () => void;
  loading: boolean;
  // [추가] 닉네임 수정 후 전역 상태(헤더/대시보드 등 user.nickname 참조하는 모든 곳)를
  // 다시 로그인하지 않고도 즉시 갱신하기 위한 함수.
  updateNickname: (nickname: string) => void;
}

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30분

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  // FCM 토큰 등록
  async function registerFcmToken() {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
      const token = await getToken(messaging, { vapidKey: VAPID_KEY });
      if (token) await api.patch('/auth/device-token', { deviceToken: token });
      
      // 앱이 열려 있을 때(포그라운드)도 알림 표시 + 클릭시 딥링크 이동
      onMessage(messaging, (payload) => {
        if (!payload.notification?.title) return;

        // 1) 화면에 알림 띄우기
        const notif = new Notification(payload.notification.title, {
          body: payload.notification.body ?? '',
          icon: '/favicon.ico',
        });

        // 2) 알림 클릭 시 이동할 경로 계산
        //    - localStorage 의 role 을 쓰는 이유:
        //      이 핸들러는 한 번 등록되면 클로저로 옛 role 값을 붙잡을 수 있어,
        //      "지금" 로그인된 역할을 안전하게 읽으려고 localStorage 를 본다.
        const currentRole =
          (localStorage.getItem('role') as 'user' | 'guardian' | null) ?? null;
        const data = payload.data as Record<string, string> | undefined;
        const path = resolveNotificationPath(currentRole, data);

        // 3) 클릭하면 해당 화면으로 이동 + 알림 닫기
        notif.onclick = () => {
          window.focus();        // 백그라운드 탭이면 앱 탭으로 포커스
          notif.close();
          // SPA 라우터 대신 location 이동: 어떤 화면에서든 안전하게 동작
          window.location.assign(path);
        };
      });

    } catch (e) {
      console.error('FCM 토큰 등록 실패', e);
    }
  }

  // 부팅 시: 쿠키의 RefreshToken으로 세션 복구
  useEffect(() => {
    (async () => {
      try {
        const data = await exchangeToken();
        setAccessToken(data.token);
        setUser(data.user);
        setRole(data.user.role);
        localStorage.setItem("role", data.user.role);
        registerFcmToken(); // 세션 복구 후 FCM 토큰 등록
      } catch {
        setAccessToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 일반 로그인
  const login = (userData: UserData, userRole: Role, token: string) => {
    setAccessToken(token);
    setUser(userData);
    setRole(userRole);
    localStorage.setItem("role", userRole);
    registerFcmToken(); // 로그인 후 FCM 토큰 등록
  };

  // 소셜 콜백 등에서 토큰을 이미 메모리에 넣은 뒤 user/role만 반영
  const applySession = (userData: UserData, userRole: Role) => {
    setUser(userData);
    setRole(userRole);
    localStorage.setItem("role", userRole);
  };

  // [추가] 닉네임만 바뀐 경우, 전체 세션을 다시 만들지 않고 user 객체 일부만 갱신.
  // 사용자/보호자 양쪽 화면이 모두 이 Context의 user.nickname을 구독하므로
  // 이 함수 하나로 양쪽 화면에 동시 반영됩니다.
  const updateNickname = (nickname: string) => {
    setUser(prev => (prev ? { ...prev, nickname } : prev));
  };

  const logout = useCallback(() => {
    callLogout();
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
    return () => window.removeEventListener("auth:logout",handleForcedLogout);
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
    <AuthContext.Provider value={{ user, role, login, applySession, logout, loading, updateNickname }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext)!;