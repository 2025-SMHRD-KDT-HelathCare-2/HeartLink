import { useState } from "react";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { UserLayout } from "./components/UserLayout";
import { GuardianLayout } from "./components/GuardianLayout";

type Role = "user" | "guardian";
type Screen = "login" | "register";

function App() {
  const [role, setRole] = useState<Role | null>(null);
  const [screen, setScreen] = useState<Screen>("login");

  if (role) {
    if (role === "guardian") return <GuardianLayout onLogout={() => setRole(null)} />;
    return <UserLayout onLogout={() => setRole(null)} />;
  }

  if (screen === "register") {
    return <RegisterPage onRegister={(r) => setRole(r)} onGoLogin={() => setScreen("login")} />;
  }

  return <LoginPage onLogin={(r) => setRole(r)} onGoRegister={() => setScreen("register")} />;
}

export default App;