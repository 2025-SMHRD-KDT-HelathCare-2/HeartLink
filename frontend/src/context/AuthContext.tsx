import { createContext, useContext, useState, useEffect } from "react";

type Role = "user" | "guardian";

interface UserData {
  email: string;
  role: Role;
}

interface AuthContextType {
  user: UserData | null;
  role: Role | null;
  login: (userData: UserData, userRole: Role, token: string) => void;
  logout: () => void;
  loading: boolean;
}

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

  const login = (userData: UserData, userRole: Role, token: string) => {
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

export const useAuth = () => useContext(AuthContext)!;
