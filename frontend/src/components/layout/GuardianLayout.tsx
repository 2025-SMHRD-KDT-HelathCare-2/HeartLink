import { useState } from "react";
import {
  Heart, Users, Bell, FileText, LogOut, Menu, X,
  ChevronRight, Shield, Upload, Activity
} from "lucide-react";
import { GuardianDashboard } from "../../pages/GuardianDashboard";
import { NotificationsPage } from "../../pages/NotificationsPage";
import { GuardianReportPage } from "../../pages/GuardianReportPage";
import { UploadPage } from "../../pages/UploadPage";
import type { ECGData } from "../../pages/UploadPage";
import { VisualizationPage } from "../../pages/VisualizationPage";

type GuardianScreen = "dashboard" | "notifications" | "report" | "upload" | "visualization";

const GUARDIAN_NAV: { id: GuardianScreen; label: string; icon: React.ElementType; ucId: string; badge?: number }[] = [
  { id: "dashboard",     label: "연계 사용자 대시보드", icon: Users,    ucId: "UC-09" },
  { id: "notifications", label: "위험도 알림 수신",     icon: Bell,     ucId: "UC-10", badge: 2 },
  { id: "report",        label: "보호자용 리포트",      icon: FileText, ucId: "UC-11" },
];

const CARE_NAV: { id: GuardianScreen; label: string; icon: React.ElementType; ucId: string }[] = [
  { id: "upload",        label: "기기 데이터 올리기", icon: Upload,   ucId: "UC-04" },
  { id: "visualization", label: "심전도 분석",        icon: Activity, ucId: "UC-06" },
];

const ALL_NAV = [...GUARDIAN_NAV, ...CARE_NAV];

interface GuardianLayoutProps {
  onLogout: () => void;
}

export function GuardianLayout({ onLogout }: GuardianLayoutProps) {
  const [screen, setScreen] = useState<GuardianScreen>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<number>(1);
  const [ecgData, setEcgData] = useState<ECGData | null>(null);

  const handleSelectMember = (id: number) => {
    setSelectedMemberId(id);
    setScreen("report");
    setSidebarOpen(false);
  };

  // 업로드 완료 → 데이터 저장 후 VisualizationPage로 이동
  const handleECGReady = (data: ECGData) => {
    setEcgData(data);
    setTimeout(() => {
      setScreen("visualization");
    }, 800);
  };

  const renderScreen = () => {
    switch (screen) {
      case "dashboard":
        return <GuardianDashboard onSelectMember={handleSelectMember} />;
      case "notifications":
        return <NotificationsPage onViewReport={() => setScreen("report")} />;
      case "report":
        return <GuardianReportPage memberId={selectedMemberId} />;
      case "upload":
        return <UploadPage onDataReady={handleECGReady} />;
      case "visualization":
        return <VisualizationPage ecgData={ecgData} />;
    }
  };

  const currentNav = ALL_NAV.find(n => n.id === screen);

  const NavBtn = ({ id, label, icon: Icon, ucId, badge }: {
    id: GuardianScreen; label: string; icon: React.ElementType; ucId: string; badge?: number;
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
          <div className={`font-bold ${active ? "text-white/70" : "text-white/30"}`} style={{ fontSize: "0.85rem" }}>{ucId}</div>
        </div>
        {badge && badge > 0 && (
          <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{badge}</span>
        )}
        {active && <ChevronRight className="w-4 h-4 text-white/70" />}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* 사이드바 */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-[#144272] flex flex-col transform transition-transform duration-300 ${
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
              {GUARDIAN_NAV.map(item => <NavBtn key={item.id} {...item} />)}
            </div>
          </div>

          <div className="border-t border-white/10" />

          <div>
            <p className="text-white/30 font-bold px-4 pb-2" style={{ fontSize: "0.8rem", letterSpacing: "0.06em" }}>
              사용자 대신 처리
            </p>
            <div className="space-y-1">
              {CARE_NAV.map(item => <NavBtn key={item.id} {...item} />)}
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-9 h-9 bg-[#0E8080] rounded-full flex items-center justify-center text-white text-sm font-bold">김</div>
            <div>
              <div className="text-white font-bold" style={{ fontSize: "1rem" }}>김보호자</div>
              <div className="text-white/50 font-bold" style={{ fontSize: "0.85rem" }}>보호자</div>
            </div>
          </div>
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
            <Heart className="w-5 h-5 text-[#0E8080] fill-current" />
            <div className="text-gray-800 font-bold" style={{ fontSize: "1.1rem" }}>{currentNav?.label}</div>
            <div className="text-gray-400 font-bold ml-1" style={{ fontSize: "0.9rem" }}>{currentNav?.ucId}</div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{renderScreen()}</main>
      </div>
    </div>
  );
}