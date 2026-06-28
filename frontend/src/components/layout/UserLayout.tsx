// ============================================================================
// 사용자(어르신) 레이아웃 — 상단 헤더 + 큰 메뉴 카드 + 화면 전환
// - 리팩터링 포인트:
//   1) 색상 하드코딩(#0D9488 / #F4F7FA) → COLORS 토큰 / primary 토큰 클래스
//   2) 인라인 fontSize → 토큰 클래스 우선(없으면 임의값 유지)
//   화면 전환/알림 조회/메뉴 토글 로직은 100% 동일
// ============================================================================
import { useState, useEffect } from "react";
import { Heart, LogOut, Menu, X, ChevronRight, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/authApi";
import { ReportPage } from "../../pages/ReportPage";
import { ReportHistoryPage } from "../../pages/ReportHistoryPage";
import { UploadVisualizationPage } from "../../pages/UploadVisualizationPage";
import { COLORS } from "../../styles/tokens";

type UserScreen = "report" | "history" | "ecg";

const NAV_ITEMS: { id: UserScreen; label: string; emoji: string }[] = [
  { id: "report",  label: "내 건강 결과", emoji: "❤️" },
  { id: "history", label: "지난 기록",    emoji: "📋" },
  { id: "ecg",     label: "심전도 올리기·보기", emoji: "📈" },
];

export function UserLayout({ onLogout }: { onLogout: () => void }) {
  const [screen, setScreen] = useState<UserScreen>("report");
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/notifications");
        const unread = (res.data || []).some((n: any) => !n.isRead && !n.is_read);
        setHasUnread(unread);
      } catch (err) {
        console.error("알림 조회 실패", err);
      }
    })();
  }, []);
  const { user } = useAuth();

  const nickname = (user as any)?.nickname || (user as any)?.email?.split("@")[0] || "사용자";

  const renderScreen = () => {
    switch (screen) {
      case "report":  return <ReportPage />;
      case "history": return <ReportHistoryPage />;
      case "ecg":     return <UploadVisualizationPage />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: COLORS.appBg }}>

      {/* 상단 헤더 (primary 배경) */}
      <header className="text-white px-5 py-4 flex items-center justify-between sticky top-0 z-30 shadow-lg"
        style={{ backgroundColor: COLORS.primary }}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Heart className="w-7 h-7 text-white fill-current" />
          </div>
          <div>
            <div className="font-black" style={{ fontSize: "1.4rem" }}>HeartLink</div>
            <div className="text-white/60 font-bold text-tiny">사용자 건강 모니터링</div>
          </div>
        </div>

        <button onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 rounded-xl hover:bg-white/10 transition-colors lg:hidden"
          style={{ minHeight: 48, minWidth: 48 }}>
          {menuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
        </button>

        <div className="hidden lg:flex items-center gap-3">
          <button onClick={() => navigate("/notifications")}
            className="relative p-2.5 rounded-xl hover:bg-white/10 transition-colors"
            title="알림함">
            <Bell className="w-6 h-6 text-white" />
            {hasUnread && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full" />}
          </button>
          <button onClick={() => navigate("/mypage")}
            className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/10 transition-colors group">
            {/* 헤더 배경색과 구분되도록 white/30 */}
            <div className="w-10 h-10 bg-white/30 border-2 border-white/50 rounded-full flex items-center justify-center text-white font-black text-[1.1rem]">
              {nickname[0]}
            </div>
            <span className="text-white font-black text-[1.1rem]">{nickname}</span>
            <ChevronRight className="w-4 h-4 text-white/50 group-hover:text-white transition-colors" />
          </button>
          <button onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-colors font-bold text-small">
            <LogOut className="w-5 h-5" />나가기
          </button>
        </div>
      </header>

      {/* 모바일 드롭다운 (primary 배경) */}
      {menuOpen && (
        <div className="border-t border-white/10 px-4 pb-4 lg:hidden z-20" style={{ backgroundColor: COLORS.primary }}>
          <button onClick={() => { setMenuOpen(false); navigate("/notifications"); }}
            className="w-full flex items-center gap-3 py-4 border-b border-white/10 mb-3">
            <div className="relative">
              <Bell className="w-7 h-7 text-white" />
              {hasUnread && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full" />}
            </div>
            <span className="text-white font-black text-[1.1rem]">알림함</span>
            <ChevronRight className="w-4 h-4 text-white/50 ml-auto" />
          </button>
          <button onClick={() => { setMenuOpen(false); navigate("/mypage"); }}
            className="w-full flex items-center gap-3 py-4 border-b border-white/10 mb-3">
            <div className="w-10 h-10 bg-white/30 border-2 border-white/50 rounded-full flex items-center justify-center text-white font-black text-[1.1rem]">
              {nickname[0]}
            </div>
            <span className="text-white font-black text-[1.1rem]">{nickname}</span>
            <ChevronRight className="w-4 h-4 text-white/50 ml-auto" />
          </button>
          {NAV_ITEMS.map(item => (
            <button key={item.id}
              onClick={() => { setScreen(item.id); setMenuOpen(false); }}
              className={`w-full flex items-center gap-4 px-4 py-5 rounded-xl mb-1 transition-all font-black ${screen === item.id ? "bg-white/20 text-white" : "text-white/60 hover:bg-white/10 hover:text-white"}`}
              style={{ minHeight: 72 }}>
              <span style={{ fontSize: "2rem" }}>{item.emoji}</span>
              <span className="text-sub">{item.label}</span>
            </button>
          ))}
          <button onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-4 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-colors font-bold mt-2"
            style={{ minHeight: 56 }}>
            <LogOut className="w-6 h-6" /><span className="text-[1.1rem]">로그아웃</span>
          </button>
        </div>
      )}

      {/* 보호자 안내 배너 */}
      <div className="mx-4 mt-4 flex items-center gap-3 bg-amber-50 border-2 border-amber-300 rounded-2xl p-5">
        <span style={{ fontSize: "2rem" }} className="flex-shrink-0">👨‍👩‍👧</span>
        <p className="text-amber-900 font-black leading-relaxed text-sub">
          건강 정보 입력·기기 연결은<br /><strong>가족·보호자</strong>가 도와드립니다.
        </p>
      </div>

      {/* 메뉴 카드 — 활성 카드는 primary 배경(동적이므로 인라인) */}
      <div className="grid grid-cols-2 gap-4 p-4">
        {NAV_ITEMS.map(item => {
          const active = screen === item.id;
          return (
            <button key={item.id} onClick={() => setScreen(item.id)}
              className={`flex flex-col items-center justify-center gap-3 py-6 rounded-2xl border-4 transition-all font-black shadow-sm ${
                active ? "text-white shadow-lg" : "bg-white border-gray-200 text-gray-800"
              } ${item.id === "ecg" ? "col-span-2" : ""}`}
              style={{
                minHeight: item.id === "ecg" ? 100 : 130,
                ...(active ? { backgroundColor: COLORS.primary, borderColor: COLORS.primary } : {}),
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = `${COLORS.primary}66`; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = ""; }}>
              <span style={{ fontSize: item.id === "ecg" ? "2rem" : "2.5rem" }}>{item.emoji}</span>
              <span style={{ fontSize: "1.25rem" }}>{item.label}</span>
            </button>
          );
        })}
      </div>

      <main className="flex-1">
        {renderScreen()}
      </main>
    </div>
  );
}
