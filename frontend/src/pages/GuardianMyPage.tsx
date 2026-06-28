// frontend/src/pages/Guardianmypage.tsx
// =============================================================================
// 보호자 마이페이지 — 사용자 등록 요청 보내기 + 등록한 사용자 관리 + 회원 탈퇴
//
// [이 파일이 하는 일]
//   - 돌볼 사용자의 이메일을 입력해 등록 요청을 보냅니다. (최대 3명)
//   - 보낸 요청/연결된 사용자 목록을 보여주고, 연결 해제할 수 있습니다.
//   - 하단의 '회원 탈퇴'를 누르면 확인 모달이 뜹니다.
//
// [1단계 리팩터링에서 바뀐 점 — 기능은 그대로, '겉모양 코드'만 정리]
//   1) 색상 하드코딩(#0D9488/#0F766E) → 토큰 클래스(primary 등)
//   2) 글자 크기 인라인 style → 토큰 클래스
//   3) 반복 흰 카드 → 공통 <Card>/<CardTitle>, 입력칸 → <Input>
//   4) 탈퇴 모달의 '취소/탈퇴' 버튼 → 공통 <Button>
//   ※ '등록 요청 보내기' 버튼은 아이콘 포함 + min-height 64 라 일반 button 유지,
//      연결 해제 버튼도 특수 스타일이라 일반 button 으로 두고 토큰만 정리했습니다.
//   ※ 화면 결과(디자인/동작)는 이전과 똑같습니다.
// =============================================================================

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ChevronLeft, UserPlus, User, Clock, Users, AlertTriangle, LogOut, LinkIcon } from "lucide-react";
import { requestUser, getSentRequests, disconnectRelation } from "../api/guardianApi";
import { Card, CardTitle, Input, Button } from "../components/ui";

type RequestStatus = "pending" | "accepted" | "rejected";

interface SentRequest {
  _id: string;
  userId: { nickname?: string; email: string };
  relationStatus: RequestStatus;
  createdAt: string;
}

// 요청 상태별 배지 색 (Tailwind 표준 색이라 토큰 대상이 아님)
const STATUS_CONFIG = {
  pending:  { label: "수락 대기", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  accepted: { label: "연결됨",   color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
  rejected: { label: "거절됨",   color: "text-red-500",   bg: "bg-red-50",   border: "border-red-200" },
};

// -----------------------------------------------------------------------------
// [탈퇴 확인 모달] (Mypage 와 동일 구조)
// -----------------------------------------------------------------------------
function WithdrawModal({ onConfirm, onCancel, processing }:
  { onConfirm: () => void; onCancel: () => void; processing: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-7 w-full max-w-sm">
        <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-5">
          <AlertTriangle className="w-9 h-9 text-red-500" />
        </div>
        <h2 className="text-primary font-black text-center mb-3 text-[1.5rem]">정말 탈퇴하시겠어요?</h2>
        <p className="text-gray-600 font-bold text-center mb-7 leading-relaxed text-[1.05rem]">
          탈퇴하시면 등록한 사용자 정보와<br />모든 데이터가 삭제되며<br />복구할 수 없습니다.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" size="md" fullWidth onClick={onCancel} disabled={processing}>
            취소
          </Button>
          <Button variant="danger" size="md" fullWidth onClick={onConfirm} disabled={processing}>
            {processing ? "처리 중..." : "탈퇴하기"}
          </Button>
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

  // 보낸 요청 목록 불러오기
  useEffect(() => {
    getSentRequests()
      .then(data => setRequests(data))
      .catch(() => {})
      .finally(() => setLoadingRequests(false));
  }, []);

  // 회원 탈퇴 실행
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

  // 사용자 등록 요청 보내기
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

  // 연결 해제
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
      {/* 상단: 뒤로가기 + 제목 + 닉네임 */}
      <div className="flex items-center gap-3 mb-7">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div>
          <h1 className="font-black text-primary text-[2rem]">마이페이지</h1>
          <p className="text-gray-500 font-bold text-small">{nickname} · 보호자</p>
        </div>
      </div>

      {/* 안내 박스 (파란 톤은 표준색이라 그대로) */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5 mb-6">
        <p className="text-blue-800 font-bold leading-relaxed text-[1.05rem]">
          💡 돌보실 사용자의 <strong>HeartLink 아이디(이메일)</strong>를 입력하면<br />
          등록 요청이 전송됩니다.<br />사용자가 요청을 수락하면 건강 상태를 확인할 수 있어요.
        </p>
      </div>

      {/* 사용자 등록 요청 폼 */}
      <form onSubmit={handleSendRequest} className="mb-6">
        <Card padding="lg">
          <CardTitle className="font-black mb-5">사용자 등록 요청</CardTitle>
          <label className="block text-gray-700 mb-2 font-bold text-[1.1rem]">사용자 아이디 (이메일)</label>
          {/* 공통 Input: 왼쪽 사용자 아이콘 + 에러 메시지(있을 때) 표시.
              원본은 에러를 입력칸 아래 별도 위치에 뒀는데, Input 의 error 로 옮겨도
              위치/모양이 사실상 동일합니다. */}
          <div className="mb-4">
            <Input
              type="email"
              placeholder="사용자의 이메일 주소"
              value={userEmail}
              onChange={e => { setUserEmail(e.target.value); setError(""); }}
              leftIcon={<User className="w-5 h-5" />}
              error={error}
            />
          </div>

          {/* 요청 보내기 버튼 (아이콘 포함 + min-height 64 라 일반 button 유지) */}
          <button
            type="submit"
            disabled={sending}
            className="w-full py-5 bg-primary text-white rounded-xl hover:bg-primary-mid transition-colors flex items-center justify-center gap-2 font-black disabled:opacity-50 text-[1.2rem]"
            style={{ minHeight: 64 }}
          >
            <UserPlus className="w-6 h-6" />{sending ? "요청 중..." : "사용자 등록 요청 보내기"}
          </button>
        </Card>
      </form>

      {/* 등록한 사용자 목록 */}
      <Card padding="lg">
        <div className="flex items-center justify-between mb-5">
          <CardTitle className="font-black">등록한 사용자</CardTitle>
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-3 py-1.5">
            <Users className="w-4 h-4 text-green-600" />
            <span className="text-green-600 font-bold text-tiny">{acceptedCount}명 연결</span>
          </div>
        </div>

        {loadingRequests ? (
          <p className="text-gray-400 text-center font-bold py-8 text-[1.1rem]">불러오는 중...</p>
        ) : requests.length === 0 ? (
          <p className="text-gray-400 text-center font-bold py-8 text-[1.1rem]">등록한 사용자가 없습니다.</p>
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
                        <span className="text-gray-800 font-black text-[1.1rem]">{displayEmail}</span>
                        <span className={`px-3 py-1 rounded-full font-bold ${config.color} ${config.bg} border ${config.border} text-[0.85rem]`}>
                          {config.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-400 mt-1 font-bold text-[0.9rem]">
                        <Clock className="w-4 h-4" />{sentAt}
                      </div>
                    </div>
                    {req.relationStatus === "accepted" && (
                      <button
                        onClick={() => handleDisconnect(req._id)}
                        className="flex items-center gap-1.5 px-4 py-2.5 border-2 border-red-300 text-red-500 rounded-xl hover:bg-red-50 transition-colors font-bold shrink-0 text-tiny"
                      >
                        <LinkIcon className="w-4 h-4" />연결 해제
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-gray-400 font-bold mt-5 text-tiny">
          최대 3명까지 등록할 수 있습니다.
        </p>
      </Card>

      {/* 회원 탈퇴 */}
      <div className="mt-10 pt-6 border-t border-gray-200">
        <button
          onClick={() => setShowWithdraw(true)}
          className="w-full flex items-center justify-center gap-2 py-4 text-gray-400 hover:text-red-500 transition-colors font-bold text-small"
        >
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
