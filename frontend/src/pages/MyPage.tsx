// MyPage.tsx

// frontend/src/pages/MyPage.tsx
// =============================================================================
// 사용자 마이페이지 — (1) 건강 정보 수정 (2) 보호자 요청 관리 + 회원 탈퇴
//  ※ 디자인 리뉴얼 버전 (탭 전환/저장/요청 처리/탈퇴 로직은 100% 동일)
//
// [디자인 리뉴얼 포인트]
//   1) 상단 제목 → 청록→블루 그라데이션 헤더 배너 (닉네임 함께 표시)
//   2) 탭 토글의 활성 탭, 질병 칩, 안내/상태 색을 tokens.ts(COLORS) 로 정리
//   3) 보호자 요청 배지(빨간 점) / 수락 버튼을 토큰 색상으로 통일
//   4) 카드/모달은 기존 공용 <Card>/<Button> 유지
//
// [추가 — 닉네임 수정]
//   - "건강 정보 수정" 탭, 기저질환 카드 아래에 닉네임 수정 카드를 별도로 둠.
//   - 기저질환과 별개로 자체 저장 버튼을 가지며, 저장 즉시 AuthContext의
//     updateNickname()으로 전역 상태를 갱신해 헤더/사용자·보호자 화면에 바로 반영됨.
//   - 백엔드 PATCH /auth/me 가 nickname 필드를 받아 처리한다고 가정.
// =============================================================================

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Save, Check, UserCheck, UserX, Heart, Clock, Bell,
  AlertTriangle, LogOut, Loader2, LinkIcon, Pencil,
} from "lucide-react";
import { getPendingRequests, acceptRequest, rejectRequest, disconnectRelation } from "../api/guardianApi";
import api from "../api/authApi";
import { Card, CardTitle, Button } from "../components/ui";
import { COLORS } from "../styles/tokens";

type Tab = "profile" | "guardian";
type RequestStatus = "pending" | "accepted" | "rejected";

// 선택 가능한 기저질환 목록
const DISEASES = ["고혈압", "당뇨", "부정맥", "심부전", "협심증", "뇌졸중", "고지혈증", "심방세동"];

interface GuardianRequest {
  _id: string;
  guardianId: { nickname?: string; email: string };
  relationStatus: RequestStatus;
  createdAt: string;
}

// 요청 상태별 배지 색 — 토큰 기반으로 정리 (대기=주의, 수락=안전, 거절=위험)
const STATUS_CONFIG: Record<RequestStatus, { label: string; color: string; bg: string; border: string }> = {
  pending:  { label: "대기 중", color: COLORS.warning, bg: COLORS.warningBg, border: COLORS.warningBorder },
  accepted: { label: "수락됨", color: COLORS.safe,    bg: COLORS.safeBg,    border: COLORS.safeBorder },
  rejected: { label: "거절됨", color: COLORS.danger,  bg: COLORS.dangerBg,  border: COLORS.dangerBorder },
};

// -----------------------------------------------------------------------------
// [탈퇴 확인 모달]
// -----------------------------------------------------------------------------
function WithdrawModal({ onConfirm, onCancel, processing }:
  { onConfirm: () => void; onCancel: () => void; processing: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-7 w-full max-w-sm">
        <div className="flex items-center justify-center w-16 h-16 rounded-full mx-auto mb-5"
          style={{ backgroundColor: COLORS.dangerBg }}>
          <AlertTriangle className="w-9 h-9" style={{ color: COLORS.danger }} />
        </div>
        <h2 className="text-primary font-black text-center mb-3 text-[1.5rem]">정말 탈퇴하시겠어요?</h2>
        <p className="text-gray-600 font-bold text-center mb-7 leading-relaxed text-[1.05rem]">
          탈퇴하시면 모든 건강 데이터와<br />측정 기록이 삭제되며<br />복구할 수 없습니다.
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

export function MyPage() {
  const navigate = useNavigate();
  const { user, logout, updateNickname } = useAuth();
  const [tab, setTab] = useState<Tab>("profile"); // 현재 탭

  const [diseases, setDiseases] = useState<string[]>([]); // 선택된 질환
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ── 닉네임 수정 상태 ──
  const [nicknameInput, setNicknameInput] = useState((user as any)?.nickname ?? "");
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [nicknameSaved, setNicknameSaved] = useState(false);
  const [nicknameError, setNicknameError] = useState("");

  // user가 나중에 채워지는 타이밍(새로고침 등)에도 입력칸 초기값을 맞춰줌
  useEffect(() => {
    setNicknameInput((user as any)?.nickname ?? "");
  }, [(user as any)?.nickname]);

  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const [requests, setRequests] = useState<GuardianRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  // 내 기저질환 정보 불러오기
  useEffect(() => {
    api.get("/auth/me")
      .then(res => setDiseases(res.data.medicalHistory ?? []))
      .catch(() => {});
  }, []);

  // 받은 보호자 요청 목록 불러오기
  useEffect(() => {
    getPendingRequests()
      .then(data => setRequests(data))
      .catch(() => {})
      .finally(() => setLoadingRequests(false));
  }, []);

  // 회원 탈퇴 실행
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

  // 질병 칩 선택/해제
  const toggleDisease = (d: string) =>
    setDiseases(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  // 건강 정보 저장
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

  // 닉네임 저장 — 기저질환과 별개로 독립적으로 저장됨
  const handleSaveNickname = async () => {
    const trimmed = nicknameInput.trim();
    if (!trimmed) {
      setNicknameError("닉네임을 입력해 주세요.");
      return;
    }
    if (trimmed.length > 50) {
      setNicknameError("닉네임은 50자 이하로 입력해 주세요.");
      return;
    }
    setNicknameError("");
    setNicknameSaving(true);
    try {
      await api.patch("/auth/me", { nickname: trimmed });
      updateNickname(trimmed); // 전역 상태 즉시 갱신 → 헤더/보호자 화면 등에 바로 반영
      setNicknameSaved(true);
      setTimeout(() => setNicknameSaved(false), 2000);
    } catch (err) {
      console.error("닉네임 저장 실패", err);
      setNicknameError("닉네임 저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setNicknameSaving(false);
    }
  };

  // 요청 수락
  const handleAccept = async (id: string) => {
    try {
      await acceptRequest(id);
      setRequests(prev => prev.map(r => r._id === id ? { ...r, relationStatus: "accepted" as RequestStatus } : r));
    } catch (err) {
      console.error("수락 실패", err);
    }
  };

  // 요청 거절
  const handleReject = async (id: string) => {
    try {
      await rejectRequest(id);
      setRequests(prev => prev.map(r => r._id === id ? { ...r, relationStatus: "rejected" as RequestStatus } : r));
    } catch (err) {
      console.error("거절 실패", err);
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

      {/* ───────── 상단 그라데이션 헤더 배너 (제목 + 닉네임) ───────── */}
      <Card variant="gradient" padding="lg" className="mb-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm shrink-0">
          <Heart className="w-8 h-8 text-white fill-current" />
        </div>
        <div>
          <h1 className="font-black text-[1.8rem] leading-tight">마이페이지</h1>
          <p className="font-bold text-body opacity-90">{nickname}님</p>
        </div>
      </Card>

      {/* 탭 전환 (건강 정보 수정 / 보호자 요청) */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
        <button
          onClick={() => setTab("profile")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all font-bold text-[1.05rem] ${tab === "profile" ? "bg-white shadow text-primary" : "text-gray-500"}`}
          style={{ minHeight: 52 }}
        >
          <Heart className="w-5 h-5" />건강 정보 수정
        </button>
        <button
          onClick={() => setTab("guardian")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all font-bold relative text-[1.05rem] ${tab === "guardian" ? "bg-white shadow text-primary" : "text-gray-500"}`}
          style={{ minHeight: 52 }}
        >
          <Bell className="w-5 h-5" />보호자 요청
          {pendingCount > 0 && (
            <span
              className="absolute top-1 right-2 w-5 h-5 text-white rounded-full flex items-center justify-center text-[0.7rem]"
              style={{ backgroundColor: COLORS.danger }}
            >
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* ===== 탭 1: 건강 정보 수정 ===== */}
      {tab === "profile" && (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          <Card padding="lg">
            <CardTitle className="font-black mb-2">기저질환</CardTitle>
            <p className="text-gray-500 mb-4 font-bold text-small">앓고 계신 질환을 모두 선택해 주세요.</p>
            <div className="flex flex-wrap gap-3">
              {DISEASES.map(d => {
                const selected = diseases.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDisease(d)}
                    className="px-4 py-3 rounded-xl border-2 transition-all font-bold text-small"
                    style={selected
                      ? { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft, color: COLORS.primary }
                      : { borderColor: COLORS.border, color: COLORS.body }}
                    onMouseEnter={(e) => { if (!selected) e.currentTarget.style.borderColor = COLORS.faint; }}
                    onMouseLeave={(e) => { if (!selected) e.currentTarget.style.borderColor = COLORS.border; }}
                  >
                    {selected && <span className="mr-1">✓</span>}{d}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* ───────── 닉네임 수정 카드 — 기저질환과 별개로 독립 저장 ───────── */}
          <Card padding="lg">
            <CardTitle className="font-black mb-2">닉네임</CardTitle>
            <p className="text-gray-500 mb-4 font-bold text-small">
              사용자/보호자 화면에 표시되는 이름이에요.
            </p>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Pencil className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={nicknameInput}
                  onChange={e => setNicknameInput(e.target.value)}
                  maxLength={50}
                  placeholder="닉네임을 입력하세요"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border-2 font-bold text-body outline-none transition-colors"
                  style={{ borderColor: nicknameError ? COLORS.danger : COLORS.border }}
                  onFocus={e => { e.currentTarget.style.borderColor = COLORS.primary; }}
                  onBlur={e => { e.currentTarget.style.borderColor = nicknameError ? COLORS.danger : COLORS.border; }}
                />
              </div>
              <Button
                type="button"
                variant="gradient"
                size="md"
                onClick={handleSaveNickname}
                disabled={nicknameSaving || nicknameInput.trim() === ((user as any)?.nickname ?? "")}
              >
                {nicknameSaved ? (
                  <><Check className="w-5 h-5" />완료</>
                ) : nicknameSaving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "저장"
                )}
              </Button>
            </div>
            {nicknameError && (
              <p className="font-bold text-small mt-2" style={{ color: COLORS.danger }}>
                {nicknameError}
              </p>
            )}
          </Card>

          {/* 저장 버튼: 상태별로 '저장하기 / 저장 중 / 저장 완료' */}
          <Button type="submit" variant="gradient" size="lg" fullWidth disabled={saving}>
            {saved ? (
              <><Check className="w-6 h-6" />저장 완료!</>
            ) : saving ? (
              <><Loader2 className="w-6 h-6 animate-spin" />저장 중...</>
            ) : (
              <><Save className="w-6 h-6" />저장하기</>
            )}
          </Button>
        </form>
      )}

      {/* ===== 탭 2: 보호자 요청 ===== */}
      {tab === "guardian" && (
        <div className="space-y-6">
          {/* 안내 박스 (정보 톤) */}
          <div className="border-2 rounded-2xl p-5"
            style={{ backgroundColor: COLORS.infoBg, borderColor: COLORS.infoBorder }}>
            <p className="font-bold leading-relaxed text-[1.05rem]" style={{ color: COLORS.info }}>
              💡 보호자가 회원님을 보호자 등록하려고 요청을 보냈습니다.<br />
              수락하면 보호자가 회원님의 건강 상태를 확인할 수 있어요.
            </p>
          </div>

          <Card padding="lg">
            <div className="flex items-center justify-between mb-5">
              <CardTitle className="font-black">받은 등록 요청</CardTitle>
              {pendingCount > 0 && (
                <div className="flex items-center gap-2 rounded-full px-3 py-1.5 border"
                  style={{ backgroundColor: COLORS.dangerBg, borderColor: COLORS.dangerBorder }}>
                  <Bell className="w-4 h-4" style={{ color: COLORS.danger }} />
                  <span className="font-bold text-tiny" style={{ color: COLORS.danger }}>미확인 {pendingCount}건</span>
                </div>
              )}
            </div>

            {loadingRequests ? (
              <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-bold">불러오는 중...</span>
              </div>
            ) : requests.length === 0 ? (
              <p className="text-gray-400 text-center font-bold py-8 text-[1.1rem]">받은 요청이 없습니다.</p>
            ) : (
              <div className="space-y-4">
                {requests.map(req => {
                  const config = STATUS_CONFIG[req.relationStatus];
                  const guardianName = req.guardianId?.nickname || req.guardianId?.email || "보호자";
                  const guardianEmail = req.guardianId?.email ?? "";
                  const requestedAt = new Date(req.createdAt).toLocaleString("ko-KR").slice(0, 16);
                  return (
                    <div key={req._id} className="rounded-2xl p-5 border-2"
                      style={{ backgroundColor: config.bg, borderColor: config.border }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1 flex-wrap">
                            <span className="text-gray-800 font-black text-[1.15rem]">{guardianName}</span>
                            <span className="px-3 py-1 rounded-full font-bold border text-[0.85rem]"
                              style={{ color: config.color, backgroundColor: config.bg, borderColor: config.border }}>
                              {config.label}
                            </span>
                          </div>
                          <p className="text-gray-500 font-bold text-tiny">{guardianEmail}</p>
                          <div className="flex items-center gap-1 text-gray-400 mt-1 font-bold text-[0.9rem]">
                            <Clock className="w-4 h-4" />{requestedAt}
                          </div>
                        </div>

                        {/* 수락/거절 버튼 */}
                        {req.relationStatus === "pending" && (
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => handleAccept(req._id)}
                              className="flex items-center gap-1.5 px-4 py-2.5 text-white rounded-xl transition-opacity hover:opacity-90 font-bold text-tiny"
                              style={{ backgroundColor: COLORS.primary }}
                            >
                              <UserCheck className="w-4 h-4" />수락
                            </button>
                            <button
                              onClick={() => handleReject(req._id)}
                              className="flex items-center gap-1.5 px-4 py-2.5 border-2 rounded-xl transition-colors font-bold text-tiny"
                              style={{ borderColor: COLORS.dangerBorder, color: COLORS.danger }}
                            >
                              <UserX className="w-4 h-4" />거절
                            </button>
                          </div>
                        )}
                        {req.relationStatus === "accepted" && (
                          <button
                            onClick={() => handleDisconnect(req._id)}
                            className="flex items-center gap-1.5 px-4 py-2.5 border-2 rounded-xl transition-colors font-bold shrink-0 text-tiny"
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
        </div>
      )}

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