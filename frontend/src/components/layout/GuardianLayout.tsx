import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Heart, Users, Bell, FileText, LogOut, Menu, X,
  ChevronRight, Shield
} from "lucide-react";
import api from "../../api/authApi";
import { useAuth } from "../../context/AuthContext";
import type { AppNotification } from "../../api/notificationApi";
import { GuardianDashboard } from "../../pages/GuardianDashboard";
import { NotificationsPage } from "../../pages/NotificationsPage";
import { GuardianReportPage } from "../../pages/GuardianReportPage";

export interface Patient {
  relation_id: string;
  user_id: string;
  nickname: string;
  age?: number;
  gender?: string;
  latest_measured_at: string | null;
  risk_score: number | null;
  risk_level: "high" | "mid" | "low" | null;
}

type GuardianScreen = "dashboard" | "notifications" | "report";

const GUARDIAN_NAV: { id: GuardianScreen; label: string; icon: React.ElementType; ucId: string }[] = [
  { id: "dashboard",     label: "요약 현황",         icon: Users,    ucId: "UC-09" },
  { id: "notifications", label: "주간 위험도 알림함", icon: Bell,     ucId: "UC-10" },
  { id: "report",        label: "보호자용 리포트",    icon: FileText, ucId: "UC-11" },
];

interface GuardianLayoutProps {
  onLogout: () => void;
}

export function GuardianLayout({ onLogout }: GuardianLayoutProps) {
  const [screen, setScreen] = useState<GuardianScreen>("dashboard");
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const nickname = user?.nickname ?? user?.email?.split("@")[0] ?? "보호자";
  const initial = nickname[0] ?? "보";

  useEffect(() => {
    api.get("/guardians/patients")
      .then(r => {
        setPatients(r.data);
        if (r.data.length > 0) setSelectedUserId(r.data[0].user_id);
      })
      .catch(err => console.error("환자 목록 불러오기 실패", err));

    api.get("/notifications/guardian")
      .then(r => setNotifications(r.data))
      .catch(err => console.error("알림 불러오기 실패", err));
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleSelectMember = (userId: string) => {
    setSelectedUserId(userId);
    setScreen("report");
    setSidebarOpen(false);
  };

  const renderScreen = () => {
    switch (screen) {
      case "dashboard":
        return (
          <GuardianDashboard
            patients={patients}
            notifications={notifications}
            onSelectMember={handleSelectMember}
          />
        );
      case "notifications":
        return <NotificationsPage onViewReport={() => setScreen("report")} />;
      case "report":
        return (
          <GuardianReportPage
            patients={patients}
            selectedUserId={selectedUserId}
            onSelectUser={setSelectedUserId}
          />
        );
    }
  };

  const currentNav = GUARDIAN_NAV.find(n => n.id === screen);

  const NavBtn = ({ id, label, icon: Icon, badge }: {
    id: GuardianScreen; label: string; icon: React.ElementType; badge?: number; ucId?: string;
  }) => {
    const active = screen === id;
    return (
      <button
        onClick={() => { setScreen(id); setSidebarOpen(false); }}
        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all ${
          active ? "bg-white/20 text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
        }`}
        style={{ minHeight: 52 }}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        <div className="flex-1">
          <div className="font-bold" style={{ fontSize: "1rem" }}>{label}</div>
        </div>
        {badge != null && badge > 0 && (
          <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
        {active && <ChevronRight className="w-4 h-4 text-white/70" />}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* 사이드바 */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-[#0F766E] flex flex-col transform transition-transform duration-300 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      } lg:translate-x-0 lg:static`}>

        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-white font-bold" style={{ fontSize: "1.2rem" }}>HeartLink</div>
              <div className="text-white/50 font-bold" style={{ fontSize: "0.9rem" }}>보호자 포털</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto space-y-4">
          <div>
            <p className="text-white/30 font-bold px-4 pb-2" style={{ fontSize: "0.8rem", letterSpacing: "0.06em" }}>
              보호자 기능
            </p>
            <div className="space-y-1">
              {GUARDIAN_NAV.map(item => (
                <NavBtn
                  key={item.id}
                  {...item}
                  badge={item.id === "notifications" ? unreadCount : undefined}
                />
              ))}
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => navigate("/guardian-mypage")}
            className="flex items-center gap-3 mb-3 px-2 w-full hover:bg-white/10 rounded-xl py-1.5 transition-colors group"
          >
            <div className="w-9 h-9 bg-[#0D9488] rounded-full flex items-center justify-center text-white text-sm font-bold">
              {initial}
            </div>
            <div className="text-left flex-1">
              <div className="text-white font-bold" style={{ fontSize: "1rem" }}>{nickname}</div>
              <div className="text-white/50 font-bold" style={{ fontSize: "0.85rem" }}>마이페이지 →</div>
            </div>
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-colors font-bold"
            style={{ minHeight: 44, fontSize: "1rem" }}
          >
            <LogOut className="w-5 h-5" />
            로그아웃
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors lg:hidden"
            style={{ minHeight: 44, minWidth: 44 }}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-[#0D9488] fill-current" />
            <div className="text-gray-800 font-bold" style={{ fontSize: "1.1rem" }}>{currentNav?.label}</div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{renderScreen()}</main>
      </div>
    </div>
  );
}
