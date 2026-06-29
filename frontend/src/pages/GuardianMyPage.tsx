// frontend/src/pages/GuardianMyPage.tsx
// =============================================================================
// 보호자 마이페이지 — 사용자 등록 요청(2단계) + 등록한 사용자 관리 + 회원 탈퇴
//
// [이 파일이 하는 일 — 큰 그림]
//   1) 돌볼 사용자의 이메일을 입력하면, 먼저 그 사람의 "닉네임"을 조회해서 보여줍니다.
//   2) 보호자가 "이 사람이 맞다"고 확인한 뒤 [요청 보내기]를 눌러야
//      비로소 실제 등록 요청이 서버로 전송됩니다.  ← 이게 "2단계 UX"입니다.
//   3) 보낸 요청 / 연결된 사용자 목록을 보여주고, 연결을 해제할 수 있습니다.
//   4) 하단 '회원 탈퇴'를 누르면 확인 모달이 뜹니다.
//
// [2단계 UX 가 필요한 이유]
//   - 이메일만 보고 요청을 바로 보내면, 오타로 엉뚱한 사람에게 요청이 갈 수 있습니다.
//   - 그래서 "보내기 전에 닉네임을 먼저 보여주고 → 사람이 눈으로 확인 → 그다음 전송"
//     하는 흐름으로 만들어 실수를 줄입니다.
//
// [이번 변경점]
//   - 기존: 이메일 입력 후 곧바로 [요청 보내기] → 서버로 POST
//   - 변경: 이메일 입력 후 [확인] → GET /guardians/lookup 으로 닉네임 조회 →
//           닉네임 확인 카드 표시 → [요청 보내기] 눌러야 POST
//   - "최대 3명" 제약은 백엔드에서 해제되어, 프론트에서도 모두 제거했습니다.
// =============================================================================

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  UserPlus, User, Clock, Users, AlertTriangle,
  LogOut, LinkIcon, Search, CheckCircle2,
} from "lucide-react";
import {
  requestUser, getSentRequests, disconnectRelation, lookupUser,
} from "../api/guardianApi";
import { Card, CardTitle, Input, Button } from "../components/ui";

// 요청 상태값(서버가 내려주는 값)의 타입
type RequestStatus = "pending" | "accepted" | "rejected";

// 보낸 요청 1건의 모양
interface SentRequest {
  _id: string;
  userId: { nickname?: string; email: string };
  relationStatus: RequestStatus;
  createdAt: string;
}

// 요청 상태별 배지 색 (Tailwind 표준 색이라 디자인 토큰 대상이 아님)
const STATUS_CONFIG = {
  pending:  { label: "수락 대기", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  accepted: { label: "연결됨",   color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
  rejected: { label: "거절됨",   color: "text-red-500",   bg: "bg-red-50",   border: "border-red-200" },
};

// -----------------------------------------------------------------------------
// [탈퇴 확인 모달] (Mypage 와 동일 구조)
//   - onConfirm: 실제 탈퇴 실행 / onCancel: 닫기 / processing: 처리 중 여부
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

  // ── 입력/조회 관련 상태 ───────────────────────────────────
  const [userEmail, setUserEmail] = useState("");   // 입력한 이메일
  const [error, setError] = useState("");           // 에러 메시지(입력칸 아래 표시)

  // [2단계 UX 의 핵심 상태]
  //   lookedUpNickname: 조회로 알아낸 닉네임. null 이면 "아직 조회 전"이라는 뜻.
  //                     값이 있으면 "닉네임 확인 카드 + 요청 보내기 버튼"을 보여줍니다.
  const [lookedUpNickname, setLookedUpNickname] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);    // 닉네임 조회 중(스피너용)
  const [sending, setSending] = useState(false);    // 실제 요청 전송 중

  // ── 목록/탈퇴 관련 상태 ───────────────────────────────────
  const [requests, setRequests] = useState<SentRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  // 화면 처음 뜰 때: 내가 보낸 요청 목록 불러오기
  useEffect(() => {
    getSentRequests()
      .then(data => setRequests(data))
      .catch(() => {})
      .finally(() => setLoadingRequests(false));
  }, []);

  // 헤더에 보여줄 내 닉네임, 그리고 연결된(수락된) 사용자 수
  const nickname = (user as any)?.nickname || (user as any)?.email?.split("@")[0] || "보호자";
  const acceptedCount = requests.filter(r => r.relationStatus === "accepted").length;

  // 이메일 형식이 올바른지 검사하는 작은 도우미
  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  // ───────────────────────────────────────────────────────────
  // [1단계] 닉네임 확인 — GET /guardians/lookup?email=...
  //   - 이메일이 비었거나 형식이 틀리면 에러만 표시하고 중단합니다.
  //   - 성공하면 lookedUpNickname 에 닉네임을 담아 "확인 카드"가 뜨게 합니다.
  //   - 404(존재하지 않는 사용자)면 그에 맞는 안내를 띄웁니다.
  // ───────────────────────────────────────────────────────────
  const handleLookup = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    const email = userEmail.trim();

    if (!email) { setError("사용자 아이디(이메일)를 입력해 주세요."); return; }
    if (!isValidEmail(email)) { setError("올바른 이메일 형식이 아닙니다."); return; }

    setError("");
    setLookedUpNickname(null); // 이전 조회 결과 초기화
    setLooking(true);
    try {
      const data = await lookupUser(email); // { nickname }
      setLookedUpNickname(data?.nickname ?? "(닉네임 없음)");
    } catch (err: any) {
      if (err?.status === 404 || err?.response?.status === 404) {
        setError("존재하지 않는 사용자입니다. 이메일을 다시 확인해 주세요.");
      } else {
        setError("사용자 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      }
    } finally {
      setLooking(false);
    }
  };

  // ───────────────────────────────────────────────────────────
  // [2단계] 실제 등록 요청 보내기 — POST /guardians
  //   - 닉네임 확인을 마친 뒤(=lookedUpNickname 이 있을 때)만 호출됩니다.
  //   - 성공하면 목록 맨 위에 새 요청을 추가하고, 입력/조회 상태를 모두 초기화합니다.
  // ───────────────────────────────────────────────────────────
  const handleSendRequest = async () => {
    const email = userEmail.trim();
    if (!email) return;

    setSending(true);
    try {
      const newRelation = await requestUser(email);
      // 새로 보낸 요청을 화면 목록 맨 앞에 즉시 반영(낙관적 업데이트)
      setRequests(prev => [
        { ...newRelation, userId: { email, nickname: lookedUpNickname ?? undefined } },
        ...prev,
      ]);
      // 입력칸과 조회 결과를 모두 비워 다음 등록을 준비
      setUserEmail("");
      setLookedUpNickname(null);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청 전송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  };

  // [확인 취소] 닉네임 확인 카드에서 "아니에요, 다시 입력" 을 누르면
  //   조회 결과만 지우고 이메일은 그대로 둬서 다시 고쳐 입력할 수 있게 합니다.
  const handleCancelLookup = () => {
    setLookedUpNickname(null);
    setError("");
  };

  // 연결 해제 — DELETE /guardians/:id
  const handleDisconnect = async (id: string) => {
    try {
      await disconnectRelation(id);
      setRequests(prev => prev.filter(r => r._id !== id));
    } catch (err) {
      console.error("연결 해제 실패", err);
    }
  };

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

  return (
    <div className="max-w-2xl mx-auto p-5">
      {/* 상단: 뒤로가기 + 제목 + 닉네임 */}
      <div className="flex items-center gap-3 mb-7">
        <div>
          <h1 className="font-black text-primary text-[2rem]">마이페이지</h1>
          <p className="text-gray-500 font-bold text-small">{nickname} · 보호자</p>
        </div>
      </div>

      {/* 안내 박스 (파란 톤은 표준색이라 그대로) */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5 mb-6">
        <p className="text-blue-800 font-bold leading-relaxed text-[1.05rem]">
          💡 돌보실 사용자의 <strong>HeartLink 아이디(이메일)</strong>를 입력하고<br />
          <strong>[확인]</strong>을 누르면 닉네임이 표시됩니다.<br />
          맞는 사람인지 확인한 뒤 <strong>[요청 보내기]</strong>를 눌러 주세요.
        </p>
      </div>

      {/* ─────────────────────────────────────────────────────
          사용자 등록 요청 (2단계 UX)
          - 1단계: 이메일 입력 + [확인] 버튼  → handleLookup
          - 2단계: 닉네임 확인 카드 등장      → [요청 보내기] handleSendRequest
         ───────────────────────────────────────────────────── */}
      <form onSubmit={handleLookup} className="mb-6">
        <Card padding="lg">
          <CardTitle className="font-black mb-5">사용자 등록 요청</CardTitle>
          <label className="block text-gray-700 mb-2 font-bold text-[1.1rem]">사용자 아이디 (이메일)</label>

          {/* 이메일 입력칸. 입력이 바뀌면 이전 조회 결과/에러를 모두 초기화해
              "이메일을 고쳤는데 옛 닉네임이 남아 있는" 혼란을 막습니다. */}
          <div className="mb-4">
            <Input
              type="email"
              placeholder="사용자의 이메일 주소"
              value={userEmail}
              onChange={e => {
                setUserEmail(e.target.value);
                setError("");
                setLookedUpNickname(null);
              }}
              leftIcon={<User className="w-5 h-5" />}
              error={error}
            />
          </div>

          {lookedUpNickname === null ? (
            // ── 1단계 화면: [확인] 버튼 (닉네임 조회) ──
            <button
              type="submit"
              disabled={looking}
              className="w-full py-5 bg-primary text-white rounded-xl hover:bg-primary-mid transition-colors flex items-center justify-center gap-2 font-black disabled:opacity-50 text-[1.2rem]"
              style={{ minHeight: 64 }}
            >
              <Search className="w-6 h-6" />{looking ? "확인 중..." : "사용자 확인"}
            </button>
          ) : (
            // ── 2단계 화면: 닉네임 확인 카드 + [요청 보내기] / [다시 입력] ──
            <div>
              {/* 조회된 닉네임을 크게 보여주는 확인 카드 */}
              <div className="flex items-center gap-3 bg-green-50 border-2 border-green-200 rounded-2xl p-5 mb-4">
                <CheckCircle2 className="w-9 h-9 text-green-600 shrink-0" />
                <div>
                  <p className="text-green-700 font-bold text-tiny mb-0.5">이 사용자가 맞나요?</p>
                  <p className="text-gray-800 font-black text-[1.3rem]">{lookedUpNickname}</p>
                  <p className="text-gray-500 font-bold text-tiny mt-0.5">{userEmail.trim()}</p>
                </div>
              </div>

              <div className="flex gap-3">
                {/* 다시 입력: 조회 결과만 지우고 이메일은 유지 (form submit 방지: type=button) */}
                <button
                  type="button"
                  onClick={handleCancelLookup}
                  disabled={sending}
                  className="flex-1 py-5 border-2 border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors font-black disabled:opacity-50 text-[1.1rem]"
                  style={{ minHeight: 64 }}
                >
                  다시 입력
                </button>
                {/* 요청 보내기: 실제 POST 호출 (type=button 이라 form 의 onSubmit 과 무관) */}
                <button
                  type="button"
                  onClick={handleSendRequest}
                  disabled={sending}
                  className="flex-[2] py-5 bg-primary text-white rounded-xl hover:bg-primary-mid transition-colors flex items-center justify-center gap-2 font-black disabled:opacity-50 text-[1.2rem]"
                  style={{ minHeight: 64 }}
                >
                  <UserPlus className="w-6 h-6" />{sending ? "요청 중..." : "요청 보내기"}
                </button>
              </div>
            </div>
          )}
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
              // 목록에는 닉네임이 있으면 닉네임을, 없으면 이메일을 보여줍니다.
              const displayName = req.userId?.nickname || req.userId?.email || "";
              const sub = req.userId?.nickname ? req.userId?.email : "";
              const sentAt = new Date(req.createdAt).toLocaleString("ko-KR").slice(0, 16);
              return (
                <div key={req._id} className={`rounded-2xl p-5 border-2 ${config.bg} ${config.border}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-gray-800 font-black text-[1.1rem]">{displayName}</span>
                        <span className={`px-3 py-1 rounded-full font-bold ${config.color} ${config.bg} border ${config.border} text-[0.85rem]`}>
                          {config.label}
                        </span>
                      </div>
                      {sub && <p className="text-gray-500 font-bold text-tiny">{sub}</p>}
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
        {/* "최대 3명" 안내 문구는 제약 해제로 삭제했습니다. */}
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
