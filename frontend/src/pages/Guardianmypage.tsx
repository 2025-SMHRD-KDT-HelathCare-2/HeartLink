import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ChevronLeft, UserCheck, UserX, Clock, Check, Bell, Loader2 } from "lucide-react";
import api from "../api/authApi";

interface GuardianRequest {
  _id: string;
  user_id: { _id: string; nickname: string; email: string };
  relation_status: "pending" | "accepted";
  created_at: string;
}

const STATUS_CONFIG = {
  pending:  { label: "대기 중", color: "text-amber-600", bg: "bg-amber-50",  border: "border-amber-200" },
  accepted: { label: "수락됨",  color: "text-green-600", bg: "bg-green-50",  border: "border-green-200" },
};

export function GuardianMyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [requests, setRequests]   = useState<GuardianRequest[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [actionIds, setActionIds] = useState<Set<string>>(new Set());

  const nickname = (user as any)?.nickname || (user as any)?.email?.split("@")[0] || "보호자";

  useEffect(() => {
    api.get("/guardians/requests")
      .then(r => setRequests(r.data))
      .catch(e => setError(e instanceof Error ? e.message : "불러오기 실패"))
      .finally(() => setLoading(false));
  }, []);

  const pendingCount = requests.filter(r => r.relation_status === "pending").length;

  const handleAccept = async (id: string) => {
    setActionIds(prev => new Set(prev).add(id));
    try {
      await api.patch(`/guardians/${id}/accept`);
      setRequests(prev => prev.map(r => r._id === id ? { ...r, relation_status: "accepted" as const } : r));
    } catch (e) {
      alert(e instanceof Error ? e.message : "수락 실패");
    } finally {
      setActionIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const handleReject = async (id: string) => {
    setActionIds(prev => new Set(prev).add(id));
    try {
      await api.delete(`/guardians/${id}`);
      setRequests(prev => prev.filter(r => r._id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "거절 실패");
    } finally {
      setActionIds(prev => { const s = new Set(prev); s.delete(id); return s; });
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

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[#0A2647] font-black" style={{ fontSize: "1.3rem" }}>보호자 등록 요청</h3>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-full px-3 py-1.5">
              <Bell className="w-4 h-4 text-red-500" />
              <span className="text-red-600 font-bold" style={{ fontSize: "0.95rem" }}>미확인 {pendingCount}건</span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-bold">불러오는 중...</span>
          </div>
        ) : error ? (
          <p className="text-red-400 text-center font-bold py-8">{error}</p>
        ) : requests.length === 0 ? (
          <p className="text-gray-400 text-center font-bold py-8" style={{ fontSize: "1.1rem" }}>등록 요청이 없습니다.</p>
        ) : (
          <div className="space-y-4">
            {requests.map(req => {
              const config = STATUS_CONFIG[req.relation_status];
              const busy = actionIds.has(req._id);
              return (
                <div key={req._id} className={`rounded-2xl p-5 border-2 ${config.bg} ${config.border}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <span className="text-gray-800 font-black" style={{ fontSize: "1.15rem" }}>
                          {req.user_id?.nickname || "알 수 없음"}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${config.color} ${config.bg} border ${config.border}`}>
                          {config.label}
                        </span>
                      </div>
                      <p className="text-gray-500 font-bold" style={{ fontSize: "0.95rem" }}>
                        {req.user_id?.email}
                      </p>
                      <div className="flex items-center gap-1 text-gray-400 mt-1 font-bold" style={{ fontSize: "0.9rem" }}>
                        <Clock className="w-4 h-4" />
                        {new Date(req.created_at).toLocaleString("ko-KR")}
                      </div>
                    </div>

                    {req.relation_status === "pending" && (
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleAccept(req._id)}
                          disabled={busy}
                          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#0A2647] text-white rounded-xl hover:bg-[#144272] transition-colors font-bold disabled:opacity-50"
                          style={{ fontSize: "0.95rem" }}
                        >
                          <UserCheck className="w-4 h-4" />
                          {busy ? "처리 중..." : "수락"}
                        </button>
                        <button
                          onClick={() => handleReject(req._id)}
                          disabled={busy}
                          className="flex items-center gap-1.5 px-4 py-2.5 border-2 border-red-300 text-red-500 rounded-xl hover:bg-red-50 transition-colors font-bold disabled:opacity-50"
                          style={{ fontSize: "0.95rem" }}
                        >
                          <UserX className="w-4 h-4" />
                          거절
                        </button>
                      </div>
                    )}

                    {req.relation_status === "accepted" && (
                      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-green-100 text-green-600 rounded-xl font-bold shrink-0" style={{ fontSize: "0.95rem" }}>
                        <Check className="w-4 h-4" />
                        연결됨
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-center text-gray-400 font-bold" style={{ fontSize: "0.95rem" }}>
        수락한 사용자의 건강 상태를 대시보드에서 확인할 수 있어요.
      </p>
    </div>
  );
}
