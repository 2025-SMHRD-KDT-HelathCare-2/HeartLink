// GuardianMyPage.tsx
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
// [디자인 리뉴얼 포인트 — 기능은 그대로, '겉모양'만 업그레이드]
//   1) 페이지 제목 → 청록→블루 그라데이션 헤더 카드(<Card variant="gradient">)
//   2) 안내 박스 / 닉네임 확인 카드 / 상태 배지 색을 공통 토큰(COLORS)으로 통일
//   3) 1단계 [확인], 2단계 [요청 보내기]/[다시 입력] 버튼을 공통 <Button> 으로 교체
//      (gradient / outline 변형 사용 → 다른 화면과 톤 일치)
//   ※ 데이터 조회/요청 전송/연결 해제/탈퇴 로직은 이전과 100% 동일합니다.
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
import { COLORS } from "../styles/tokens";

// 요청 상태값(서버가 내려주는 값)의 타입
type RequestStatus = "pending" | "accepted" | "rejected";

// 보낸 요청 1건의 모양
interface SentRequest {
  _id: string;
  userId: { nickname?: string; email: string };
  relationStatus: RequestStatus;
  createdAt: string;
}

// -----------------------------------------------------------------------------
// [요청 상태별 배지 설정] 색 값을 공통 토큰(COLORS)에서 가져와 앱 전체와 통일.
//   - color(글자/아이콘) / bg(연한 배경) / border(연한 테두리) 를 한 묶음으로.
//   - Tailwind 표준색(text-amber-600 등) → 토큰 색 인라인 적용으로 교체.
// -----------------------------------------------------------------------------
const STATUS_CONFIG = {
  pending:  { label: "수락 대기", color: COLORS.warning, bg: COLORS.warningBg, border: COLORS.warningBorder },
  accepted: { label: "연결됨",   color: COLORS.safe,    bg: COLORS.safeBg,    border: COLORS.safeBorder },
  rejected: { label: "거절됨",   color: COLORS.danger,  bg: COLORS.dangerBg,  border: COLORS.dangerBorder },
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
        {/* 경고 아이콘 원 — 연한 빨강(토큰 색) */}
        <div
          className="flex items-center justify-center w-16 h-16 rounded-full mx-auto mb-5"
          style={{ backgroundColor: COLORS.dangerBg }}
        >
          <AlertTriangle className="w-9 h-9" style={{ color: COLORS.danger }} />
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

  // [확인 취소] 닉네임 확인 카드에서 "다시 입력" 을 누르면
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
      {/* ───────────── 그라데이션 헤더 카드 ─────────────
          [리뉴얼] 제목을 청록→블루 그라데이션 카드로 교체. */}
      <Card variant="gradient" padding="lg" className="mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
            <User className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="font-black text-white text-[1.8rem] leading-tight">마이페이지</h1>
            <p className="text-white/80 mt-1 font-bold text-small">{nickname}님 · 보호자</p>
          </div>
        </div>
      </Card>

      {/* ───────────── 안내 박스 ─────────────
          [리뉴얼] 파란 톤을 토큰 색(infoBg/info)으로 통일. */}
      <div
        className="rounded-2xl p-5 mb-6 border-2"
        style={{ backgroundColor: COLORS.infoBg, borderColor: COLORS.infoBorder }}
      >
        <p className="font-bold leading-relaxed text-[1.05rem]" style={{ color: COLORS.info }}>
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
            // ── 1단계 화면: [확인] 버튼 (닉네임 조회) — 공통 Button(gradient) ──
            <Button
              type="submit"
              variant="gradient"
              size="lg"
              fullWidth
              disabled={looking}
              loading={looking}
              icon={<Search className="w-6 h-6" />}
            >
              {looking ? "확인 중..." : "사용자 확인"}
            </Button>
          ) : (
            // ── 2단계 화면: 닉네임 확인 카드 + [요청 보내기] / [다시 입력] ──
            <div>
              {/* 조회된 닉네임을 크게 보여주는 확인 카드 — 연한 초록(토큰 색) */}
              <div
                className="flex items-center gap-3 rounded-2xl p-5 mb-4 border-2"
                style={{ backgroundColor: COLORS.safeBg, borderColor: COLORS.safeBorder }}
              >
                <CheckCircle2 className="w-9 h-9 shrink-0" style={{ color: COLORS.safe }} />
                <div>
                  <p className="font-bold text-tiny mb-0.5" style={{ color: COLORS.safe }}>이 사용자가 맞나요?</p>
                  <p className="text-gray-800 font-black text-[1.3rem]">{lookedUpNickname}</p>
                  <p className="text-gray-500 font-bold text-tiny mt-0.5">{userEmail.trim()}</p>
                </div>
              </div>

              <div className="flex gap-3">
                {/* 다시 입력: 조회 결과만 지우고 이메일은 유지 (공통 Button outline) */}
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={handleCancelLookup}
                  disabled={sending}
                  className="flex-1"
                >
                  다시 입력
                </Button>
                {/* 요청 보내기: 실제 POST 호출 (공통 Button gradient) */}
                <Button
                  type="button"
                  variant="gradient"
                  size="lg"
                  onClick={handleSendRequest}
                  disabled={sending}
                  loading={sending}
                  icon={<UserPlus className="w-6 h-6" />}
                  className="flex-[2]"
                >
                  {sending ? "요청 중..." : "요청 보내기"}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </form>

      {/* ───────────── 등록한 사용자 목록 ───────────── */}
      <Card padding="lg">
        <div className="flex items-center justify-between mb-5">
          <CardTitle className="font-black">등록한 사용자</CardTitle>
          {/* 연결 인원 배지 — 연한 초록(토큰 색) */}
          <div
            className="flex items-center gap-2 rounded-full px-3 py-1.5 border"
            style={{ backgroundColor: COLORS.safeBg, borderColor: COLORS.safeBorder }}
          >
            <Users className="w-4 h-4" style={{ color: COLORS.safe }} />
            <span className="font-bold text-tiny" style={{ color: COLORS.safe }}>{acceptedCount}명 연결</span>
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
                // 카드 배경/테두리 색이 상태별 동적 → 인라인 style (색은 토큰)
                <div
                  key={req._id}
                  className="rounded-2xl p-5 border-2"
                  style={{ backgroundColor: config.bg, borderColor: config.border }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-gray-800 font-black text-[1.1rem]">{displayName}</span>
                        {/* 상태 배지 — 글자/배경/테두리 모두 토큰 색 */}
                        <span
                          className="px-3 py-1 rounded-full font-bold border text-[0.85rem]"
                          style={{ color: config.color, backgroundColor: config.bg, borderColor: config.border }}
                        >
                          {config.label}
                        </span>
                      </div>
                      {sub && <p className="text-gray-500 font-bold text-tiny">{sub}</p>}
                      <div className="flex items-center gap-1 text-gray-400 mt-1 font-bold text-[0.9rem]">
                        <Clock className="w-4 h-4" />{sentAt}
                      </div>
                    </div>
                    {req.relationStatus === "accepted" && (
                      // 연결 해제 버튼 — 빨강 테두리(토큰 색) 인라인
                      <button
                        onClick={() => handleDisconnect(req._id)}
                        className="flex items-center gap-1.5 px-4 py-2.5 border-2 rounded-xl transition-colors font-bold shrink-0 text-tiny hover:opacity-80"
                        style={{ borderColor: COLORS.dangerBorder, color: COLORS.danger }}
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
      </Card>

      {/* ───────────── 회원 탈퇴 ───────────── */}
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
