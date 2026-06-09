import { useState } from "react";
import { LoginPage } from "./LoginPage";
import { UserLayout } from "./UserLayout";
import { GuardianLayout } from "./GuardianLayout";

type Role = "user" | "guardian";

function App() {
  const [role, setRole] = useState<Role | null>(null);

  if (!role) {
    return <LoginPage onLogin={(r) => setRole(r)} />;
  }

  if (role === "guardian") {
    return <GuardianLayout onLogout={() => setRole(null)} />;
  }

  return <UserLayout onLogout={() => setRole(null)} />;
}

export default App;