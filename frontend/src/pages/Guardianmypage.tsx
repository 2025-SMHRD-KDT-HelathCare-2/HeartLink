import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ChevronLeft, UserCheck, UserX, Clock, Check, Bell } from "lucide-react";

type RequestStatus = "pending" | "accepted" | "rejected";

interface GuardianRequest {
  id: number;
  name: string;
  email: string;
  requestedAt: string;
  status: RequestStatus;
}

const MOCK_REQUESTS: GuardianRequest[] = [
  { id: 1, name: "홍길동", email: "hong@heartlink.kr", requestedAt: "2026-06-10 14:32", status: "pending" },
  { id: 2, name: "김영희", email: "kim@heartlink.kr", requestedAt: "2026-06-09 09:15", status: "accepted" },
  { id: 3, name: "이철수", email: "lee@heartlink.kr", requestedAt: "2026-06-08 17:40", status: "rejected" },
];

const STATUS_CONFIG = {
  pending:  { label: "대기 중",  color: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-200" },
  accepted: { label: "수락됨",   color: "text-green-600",  bg: "bg-green-50",  border: "border-green-200" },
  rejected: { label: "거절됨",   color: "text-red-500",    bg: "bg-red-50",    border: "border-red-200" },
};

export function GuardianMyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [requests, setRequests] = useState<GuardianRequest[]>(MOCK_REQUESTS);

  const nickname = (user as any)?.nickname || (user as any)?.email?.split("@")[0] || "보호자";
  const pendingCount = requests.filter(r => r.status === "pending").length;

  const handleAccept = (id: number) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: "accepted" } : r));
    // TODO: guardianApi 연결
  };

  const handleReject = (id: number) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: "rejected" } : r));
    // TODO: guardianApi 연결
  };

  return (
    <div className="max-w-2xl mx-auto p-5">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-7">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div>
          <h1 className="font-black text-[#0A2647]" style={{ fontSize: "2rem" }}>마이페이지</h1>
          <p className="text-gray-500 font-bold" style={{ fontSize: "1rem" }}>{nickname} · 보호자</p>
        </div>
      </div>

      {/* 등록 요청 현황 */}
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

        {requests.length === 0 ? (
          <p className="text-gray-400 text-center font-bold py-8" style={{ fontSize: "1.1rem" }}>
            등록 요청이 없습니다.
          </p>
        ) : (
          <div className="space-y-4">
            {requests.map(req => {
              const config = STATUS_CONFIG[req.status];
              return (
                <div key={req.id} className={`rounded-2xl p-5 border-2 ${config.bg} ${config.border}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <span className="text-gray-800 font-black" style={{ fontSize: "1.15rem" }}>{req.name}</span>
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${config.color} ${config.bg} border ${config.border}`}>
                          {config.label}
                        </span>
                      </div>
                      <p className="text-gray-500 font-bold" style={{ fontSize: "0.95rem" }}>{req.email}</p>
                      <div className="flex items-center gap-1 text-gray-400 mt-1 font-bold" style={{ fontSize: "0.9rem" }}>
                        <Clock className="w-4 h-4" />
                        {req.requestedAt}
                      </div>
                    </div>

                    {req.status === "pending" && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleAccept(req.id)}
                          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#0A2647] text-white rounded-xl hover:bg-[#144272] transition-colors font-bold"
                          style={{ fontSize: "0.95rem" }}
                        >
                          <UserCheck className="w-4 h-4" />
                          수락
                        </button>
                        <button
                          onClick={() => handleReject(req.id)}
                          className="flex items-center gap-1.5 px-4 py-2.5 border-2 border-red-300 text-red-500 rounded-xl hover:bg-red-50 transition-colors font-bold"
                          style={{ fontSize: "0.95rem" }}
                        >
                          <UserX className="w-4 h-4" />
                          거절
                        </button>
                      </div>
                    )}

                    {req.status === "accepted" && (
                      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-green-100 text-green-600 rounded-xl font-bold flex-shrink-0" style={{ fontSize: "0.95rem" }}>
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