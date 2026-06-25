import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Save, Check, UserCheck, UserX, ChevronLeft, Heart, Clock, Bell, AlertTriangle, LogOut, Loader2, LinkIcon } from "lucide-react";
import { getPendingRequests, acceptRequest, rejectRequest, disconnectRelation } from "../api/guardianApi";
import api from "../api/authApi";

type Tab = "profile" | "guardian";
type RequestStatus = "pending" | "accepted" | "rejected";

const DISEASES = ["고혈압", "당뇨", "부정맥", "심부전", "협심증", "뇌졸중", "고지혈증", "심방세동"];

interface GuardianRequest {
  _id: string;
  guardianId: { nickname?: string; email: string };
  relationStatus: RequestStatus;
  createdAt: string;
}

const STATUS_CONFIG = {
  pending:  { label: "대기 중", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  accepted: { label: "수락됨", color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
  rejected: { label: "거절됨", color: "text-red-500",   bg: "bg-red-50",   border: "border-red-200" },
};

function WithdrawModal({ onConfirm, onCancel, processing }:
  { onConfirm: () => void; onCancel: () => void; processing: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-7 w-full max-w-sm">
        <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-5">
          <AlertTriangle className="w-9 h-9 text-red-500" />
        </div>
        <h2 className="text-[#0D9488] font-black text-center mb-3" style={{ fontSize: "1.5rem" }}>정말 탈퇴하시겠어요?</h2>
        <p className="text-gray-600 font-bold text-center mb-7 leading-relaxed" style={{ fontSize: "1.05rem" }}>
          탈퇴하시면 모든 건강 데이터와<br />측정 기록이 삭제되며<br />복구할 수 없습니다.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={processing}
            className="flex-1 py-4 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors font-bold disabled:opacity-50"
            style={{ fontSize: "1.05rem" }}>
            취소
          </button>
          <button onClick={onConfirm} disabled={processing}
            className="flex-1 py-4 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors font-bold disabled:opacity-50"
            style={{ fontSize: "1.05rem" }}>
            {processing ? "처리 중..." : "탈퇴하기"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MyPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("profile");

  const [diseases, setDiseases] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const [requests, setRequests] = useState<GuardianRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  useEffect(() => {
    api.get("/auth/me")
      .then(res => setDiseases(res.data.medicalHistory ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    getPendingRequests()
      .then(data => setRequests(data))
      .catch(() => {})
      .finally(() => setLoadingRequests(false));
  }, []);

  const handleWithdraw = async () => {
    setWithdrawing(true);
    try {
      await api.delete('/auth/me');
      logout();
      navigate("/login");
    } catch (err) {
      console.error("회원 탈퇴 실패", err);
      setWithdrawing(false);
      setShowWithdraw(false);
    }
  };

  const nickname = (user as any)?.nickname || (user as any)?.email?.split("@")[0] || "사용자";
  const pendingCount = requests.filter(r => r.relationStatus === "pending").length;

  const toggleDisease = (d: string) =>
    setDiseases(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const handleSaveProfile = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch("/auth/me", { medical_history: diseases });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("저장 실패", err);
    } finally {
      setSaving(false);
    }
  };

  const handleAccept = async (id: string) => {
    try {
      await acceptRequest(id);
      setRequests(prev => prev.map(r => r._id === id ? { ...r, relationStatus: "accepted" as RequestStatus } : r));
    } catch (err) {
      console.error("수락 실패", err);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectRequest(id);
      setRequests(prev => prev.map(r => r._id === id ? { ...r, relationStatus: "rejected" as RequestStatus } : r));
    } catch (err) {
      console.error("거절 실패", err);
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await disconnectRelation(id);
      setRequests(prev => prev.filter(r => r._id !== id));
    } catch (err) {
      console.error("연결 해제 실패", err);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-5">
      <div className="flex items-center gap-3 mb-7">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div>
          <h1 className="font-black text-[#0D9488]" style={{ fontSize: "2rem" }}>마이페이지</h1>
          <p className="text-gray-500 font-bold" style={{ fontSize: "1rem" }}>{nickname}</p>
        </div>
      </div>

      <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
        <button onClick={() => setTab("profile")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all font-bold ${tab === "profile" ? "bg-white shadow text-[#0D9488]" : "text-gray-500"}`}
          style={{ minHeight: 52, fontSize: "1.05rem" }}>
          <Heart className="w-5 h-5" />건강 정보 수정
        </button>
        <button onClick={() => setTab("guardian")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all font-bold relative ${tab === "guardian" ? "bg-white shadow text-[#0D9488]" : "text-gray-500"}`}
          style={{ minHeight: 52, fontSize: "1.05rem" }}>
          <Bell className="w-5 h-5" />보호자 요청
          {pendingCount > 0 && (
            <span className="absolute top-1 right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center" style={{ fontSize: "0.7rem" }}>
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {tab === "profile" && (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-[#0D9488] font-black mb-2" style={{ fontSize: "1.3rem" }}>기저질환</h3>
            <p className="text-gray-500 mb-4 font-bold" style={{ fontSize: "1rem" }}>앓고 계신 질환을 모두 선택해 주세요.</p>
            <div className="flex flex-wrap gap-3">
              {DISEASES.map(d => (
                <button key={d} type="button" onClick={() => toggleDisease(d)}
                  className={`px-4 py-3 rounded-xl border-2 transition-all font-bold ${diseases.includes(d) ? "border-[#0D9488] bg-[#0D9488]/10 text-[#0D9488]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                  style={{ minHeight: 52, fontSize: "1rem" }}>
                  {diseases.includes(d) && <span className="mr-1">✓</span>}{d}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={saving}
            className="w-full py-5 bg-gradient-to-r from-[#0D9488] to-[#0D9488] text-white rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 font-black disabled:opacity-50"
            style={{ minHeight: 64, fontSize: "1.2rem" }}>
            {saved ? <><Check className="w-6 h-6" />저장 완료!</> : saving ? <><Loader2 className="w-6 h-6 animate-spin" />저장 중...</> : <><Save className="w-6 h-6" />저장하기</>}
          </button>
        </form>
      )}

      {tab === "guardian" && (
        <div className="space-y-6">
          <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5">
            <p className="text-blue-800 font-bold leading-relaxed" style={{ fontSize: "1.05rem" }}>
              💡 보호자가 회원님을 보호자 등록하려고 요청을 보냈습니다.<br />
              수락하면 보호자가 회원님의 건강 상태를 확인할 수 있어요.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[#0D9488] font-black" style={{ fontSize: "1.3rem" }}>받은 등록 요청</h3>
              {pendingCount > 0 && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-full px-3 py-1.5">
                  <Bell className="w-4 h-4 text-red-500" />
                  <span className="text-red-600 font-bold" style={{ fontSize: "0.95rem" }}>미확인 {pendingCount}건</span>
                </div>
              )}
            </div>

            {loadingRequests ? (
              <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-bold">불러오는 중...</span>
              </div>
            ) : requests.length === 0 ? (
              <p className="text-gray-400 text-center font-bold py-8" style={{ fontSize: "1.1rem" }}>받은 요청이 없습니다.</p>
            ) : (
              <div className="space-y-4">
                {requests.map(req => {
                  const config = STATUS_CONFIG[req.relationStatus];
                  const guardianName = req.guardianId?.nickname || req.guardianId?.email || "보호자";
                  const guardianEmail = req.guardianId?.email ?? "";
                  const requestedAt = new Date(req.createdAt).toLocaleString("ko-KR").slice(0, 16);
                  return (
                    <div key={req._id} className={`rounded-2xl p-5 border-2 ${config.bg} ${config.border}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1 flex-wrap">
                            <span className="text-gray-800 font-black" style={{ fontSize: "1.15rem" }}>{guardianName}</span>
                            <span className={`px-3 py-1 rounded-full font-bold ${config.color} ${config.bg} border ${config.border}`} style={{ fontSize: "0.85rem" }}>
                              {config.label}
                            </span>
                          </div>
                          <p className="text-gray-500 font-bold" style={{ fontSize: "0.95rem" }}>{guardianEmail}</p>
                          <div className="flex items-center gap-1 text-gray-400 mt-1 font-bold" style={{ fontSize: "0.9rem" }}>
                            <Clock className="w-4 h-4" />{requestedAt}
                          </div>
                        </div>

                        {req.relationStatus === "pending" && (
                          <div className="flex gap-2 shrink-0">
                            <button onClick={() => handleAccept(req._id)}
                              className="flex items-center gap-1.5 px-4 py-2.5 bg-[#0D9488] text-white rounded-xl hover:bg-[#0F766E] transition-colors font-bold"
                              style={{ fontSize: "0.95rem" }}>
                              <UserCheck className="w-4 h-4" />수락
                            </button>
                            <button onClick={() => handleReject(req._id)}
                              className="flex items-center gap-1.5 px-4 py-2.5 border-2 border-red-300 text-red-500 rounded-xl hover:bg-red-50 transition-colors font-bold"
                              style={{ fontSize: "0.95rem" }}>
                              <UserX className="w-4 h-4" />거절
                            </button>
                          </div>
                        )}
                        {req.relationStatus === "accepted" && (
                          <button onClick={() => handleDisconnect(req._id)}
                            className="flex items-center gap-1.5 px-4 py-2.5 border-2 border-red-300 text-red-500 rounded-xl hover:bg-red-50 transition-colors font-bold shrink-0"
                            style={{ fontSize: "0.95rem" }}>
                            <LinkIcon className="w-4 h-4" />연결 해제
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-10 pt-6 border-t border-gray-200">
        <button onClick={() => setShowWithdraw(true)}
          className="w-full flex items-center justify-center gap-2 py-4 text-gray-400 hover:text-red-500 transition-colors font-bold"
          style={{ fontSize: "1rem" }}>
          <LogOut className="w-5 h-5" />회원 탈퇴
        </button>
      </div>

      {showWithdraw && (
        <WithdrawModal
          onConfirm={handleWithdraw}
          onCancel={() => setShowWithdraw(false)}
          processing={withdrawing}
        />
      )}
    </div>
  );
}