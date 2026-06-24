import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ChevronLeft, UserPlus, User, Check, Clock, Users, AlertTriangle, LogOut, LinkIcon } from "lucide-react";
import { requestUser, getSentRequests, disconnectRelation } from "../api/guardianApi";

type RequestStatus = "pending" | "accepted" | "rejected";

interface SentRequest {
  _id: string;
  userId: { nickname?: string; email: string };
  relationStatus: RequestStatus;
  createdAt: string;
}

const STATUS_CONFIG = {
  pending:  { label: "수락 대기", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  accepted: { label: "연결됨",   color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
  rejected: { label: "거절됨",   color: "text-red-500",   bg: "bg-red-50",   border: "border-red-200" },
};

function WithdrawModal({ onConfirm, onCancel, processing }:
  { onConfirm: () => void; onCancel: () => void; processing: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-7 w-full max-w-sm">
        <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-5">
          <AlertTriangle className="w-9 h-9 text-red-500" />
        </div>
        <h2 className="text-[#0A2647] font-black text-center mb-3" style={{ fontSize: "1.5rem" }}>정말 탈퇴하시겠어요?</h2>
        <p className="text-gray-600 font-bold text-center mb-7 leading-relaxed" style={{ fontSize: "1.05rem" }}>
          탈퇴하시면 등록한 사용자 정보와<br />모든 데이터가 삭제되며<br />복구할 수 없습니다.
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

export function GuardianMyPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [userEmail, setUserEmail] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [requests, setRequests] = useState<SentRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    getSentRequests()
      .then(data => setRequests(data))
      .catch(() => {})
      .finally(() => setLoadingRequests(false));
  }, []);

  const handleWithdraw = async () => {
    setWithdrawing(true);
    try {
      await new Promise(r => setTimeout(r, 600));
      logout();
      navigate("/login");
    } catch (err) {
      console.error("회원 탈퇴 실패", err);
      setWithdrawing(false);
      setShowWithdraw(false);
    }
  };

  const nickname = (user as any)?.nickname || (user as any)?.email?.split("@")[0] || "보호자";
  const acceptedCount = requests.filter(r => r.relationStatus === "accepted").length;

  const handleSendRequest = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!userEmail.trim()) { setError("사용자 아이디를 입력해 주세요."); return; }
    if (!userEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) { setError("올바른 이메일 형식이 아닙니다."); return; }
    if (requests.length >= 3) { setError("사용자는 최대 3명까지 등록할 수 있습니다."); return; }

    setError("");
    setSending(true);
    try {
      const newRelation = await requestUser(userEmail.trim());
      setRequests(prev => [{ ...newRelation, userId: { email: userEmail.trim() } }, ...prev]);
      setUserEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청 전송에 실패했습니다.");
    } finally {
      setSending(false);
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
          <h1 className="font-black text-[#0A2647]" style={{ fontSize: "2rem" }}>마이페이지</h1>
          <p className="text-gray-500 font-bold" style={{ fontSize: "1rem" }}>{nickname} · 보호자</p>
        </div>
      </div>

      <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5 mb-6">
        <p className="text-blue-800 font-bold leading-relaxed" style={{ fontSize: "1.05rem" }}>
          💡 돌보실 사용자의 <strong>HeartLink 아이디(이메일)</strong>를 입력하면<br />
          등록 요청이 전송됩니다.<br />사용자가 요청을 수락하면 건강 상태를 확인할 수 있어요.
        </p>
      </div>

      <form onSubmit={handleSendRequest} className="mb-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-[#0A2647] font-black mb-5" style={{ fontSize: "1.3rem" }}>사용자 등록 요청</h3>
          <label className="block text-gray-700 mb-2 font-bold" style={{ fontSize: "1.1rem" }}>사용자 아이디 (이메일)</label>
          <div className="relative mb-4">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="email" placeholder="사용자의 이메일 주소" value={userEmail}
              onChange={e => { setUserEmail(e.target.value); setError(""); }}
              className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0A2647] bg-gray-50 font-bold"
              style={{ minHeight: 56, fontSize: "1.1rem" }} />
          </div>
          {error && <p className="text-red-500 mb-3 font-bold" style={{ fontSize: "1rem" }}>{error}</p>}
          <button type="submit" disabled={sending}
            className="w-full py-5 bg-[#0A2647] text-white rounded-xl hover:bg-[#144272] transition-colors flex items-center justify-center gap-2 font-black disabled:opacity-50"
            style={{ minHeight: 64, fontSize: "1.2rem" }}>
            <UserPlus className="w-6 h-6" />{sending ? "요청 중..." : "사용자 등록 요청 보내기"}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[#0A2647] font-black" style={{ fontSize: "1.3rem" }}>등록한 사용자</h3>
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-3 py-1.5">
            <Users className="w-4 h-4 text-green-600" />
            <span className="text-green-600 font-bold" style={{ fontSize: "0.95rem" }}>{acceptedCount}명 연결</span>
          </div>
        </div>

        {loadingRequests ? (
          <p className="text-gray-400 text-center font-bold py-8" style={{ fontSize: "1.1rem" }}>불러오는 중...</p>
        ) : requests.length === 0 ? (
          <p className="text-gray-400 text-center font-bold py-8" style={{ fontSize: "1.1rem" }}>등록한 사용자가 없습니다.</p>
        ) : (
          <div className="space-y-4">
            {requests.map(req => {
              const config = STATUS_CONFIG[req.relationStatus];
              const displayEmail = req.userId?.email ?? "";
              const sentAt = new Date(req.createdAt).toLocaleString("ko-KR").slice(0, 16);
              return (
                <div key={req._id} className={`rounded-2xl p-5 border-2 ${config.bg} ${config.border}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-gray-800 font-black" style={{ fontSize: "1.1rem" }}>{displayEmail}</span>
                        <span className={`px-3 py-1 rounded-full font-bold ${config.color} ${config.bg} border ${config.border}`} style={{ fontSize: "0.85rem" }}>
                          {config.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-400 mt-1 font-bold" style={{ fontSize: "0.9rem" }}>
                        <Clock className="w-4 h-4" />{sentAt}
                      </div>
                    </div>
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

        <p className="text-center text-gray-400 font-bold mt-5" style={{ fontSize: "0.95rem" }}>
          최대 3명까지 등록할 수 있습니다.
        </p>
      </div>

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