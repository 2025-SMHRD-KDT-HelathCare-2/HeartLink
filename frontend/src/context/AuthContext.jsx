import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // "user" | "guardian"
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 새로고침해도 로그인 유지
    const token = localStorage.getItem("token");
    const savedRole = localStorage.getItem("role");
    const savedUser = localStorage.getItem("user");
    if (token && savedRole && savedUser) {
      setRole(savedRole);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = (userData, userRole, token) => {
    localStorage.setItem("token", token);
    localStorage.setItem("role", userRole);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    setRole(userRole);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// 다른 파일에서 쓸 때: const { user, role, login, logout } = useAuth();
export const useAuth = () => useContext(AuthContext);
