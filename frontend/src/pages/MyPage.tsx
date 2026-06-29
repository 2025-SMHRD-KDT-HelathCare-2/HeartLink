// frontend/src/pages/Mypage.tsx
// =============================================================================
// 사용자 마이페이지 — (1) 건강 정보 수정 (2) 보호자 요청 관리 + 회원 탈퇴
//
// [이 파일이 하는 일]
//   - 탭으로 '건강 정보 수정'과 '보호자 요청'을 전환합니다.
//   - 건강 정보 탭: 기저질환을 선택해 저장합니다.
//   - 보호자 요청 탭: 보호자가 보낸 등록 요청을 수락/거절/연결해제 합니다.
//   - 하단의 '회원 탈퇴'를 누르면 확인 모달이 뜹니다.
//
// [1단계 리팩터링에서 바뀐 점 — 기능은 그대로, '겉모양 코드'만 정리]
//   1) 색상 하드코딩(#0D9488/#0F766E) → 토큰 클래스(primary 등)
//   2) 글자 크기 인라인 style → 토큰 클래스
//   3) 반복되던 흰 카드 → 공통 <Card> / 제목은 <CardTitle>
//   4) 탈퇴 모달의 '취소/탈퇴' 버튼 → 공통 <Button>
//   ※ 질병 칩, 수락/거절/연결해제처럼 크기·아이콘이 특수한 버튼은
//      외형 보존을 위해 일반 button 으로 두고 색/폰트 토큰만 정리했습니다.
//   ※ 상태 배지의 amber/green/red 표준색은 토큰 대상이 아니라 그대로 둡니다.
//   ※ 화면 결과(디자인/동작)는 이전과 똑같습니다.
// =============================================================================

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Save, Check, UserCheck, UserX, Heart, Clock, Bell,
  AlertTriangle, LogOut, Loader2, LinkIcon,
} from "lucide-react";
import { getPendingRequests, acceptRequest, rejectRequest, disconnectRelation } from "../api/guardianApi";
import api from "../api/authApi";
import { Card, CardTitle, Button } from "../components/ui";

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

// 요청 상태별 배지 색 (Tailwind 표준 색이라 토큰 대상이 아님)
const STATUS_CONFIG = {
  pending:  { label: "대기 중", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  accepted: { label: "수락됨", color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
  rejected: { label: "거절됨", color: "text-red-500",   bg: "bg-red-50",   border: "border-red-200" },
};

// -----------------------------------------------------------------------------
// [탈퇴 확인 모달] 화면 전체를 덮는 확인 창. '취소'와 '탈퇴하기' 버튼이 있습니다.
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
          탈퇴하시면 모든 건강 데이터와<br />측정 기록이 삭제되며<br />복구할 수 없습니다.
        </p>
        <div className="flex gap-3">
          {/* 취소: 회색 테두리 버튼(outline) / 탈퇴: 빨강 버튼(danger) */}
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
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("profile"); // 현재 탭

  const [diseases, setDiseases] = useState<string[]>([]); // 선택된 질환
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
      {/* 상단: 뒤로가기 + 제목 + 닉네임 */}
      
      <div className="flex items-center gap-3 mb-7">
        <div>
          <h1 className="font-black text-primary text-[2rem]">마이페이지</h1>
          <p className="text-gray-500 font-bold text-small">{nickname}</p>
        </div>
      </div>

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
          {/* 대기 중 요청 개수 빨간 배지 */}
          {pendingCount > 0 && (
            <span className="absolute top-1 right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[0.7rem]">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* ===== 탭 1: 건강 정보 수정 ===== */}
      {tab === "profile" && (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          <Card padding="lg">
            {/* CardTitle 은 font-bold 기본이라, 원본의 font-black 느낌을 위해 클래스 보강 */}
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
                    className={`px-4 py-3 rounded-xl border-2 transition-all font-bold text-small ${selected ? "border-primary bg-primary/10 text-primary" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                    style={{ minHeight: 52 }}
                  >
                    {selected && <span className="mr-1">✓</span>}{d}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* 저장 버튼: 상태별로 '저장하기 / 저장 중 / 저장 완료'로 바뀜.
              원본은 직접 스피너(Loader2)를 넣었으므로, 공통 Button 의 loading 대신
              disabled 를 쓰고 children 으로 상태별 내용을 그대로 전달합니다. */}
          <Button type="submit" variant="primary" size="lg" fullWidth disabled={saving}>
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
          {/* 안내 박스 (파란 톤은 표준색이라 그대로) */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5">
            <p className="text-blue-800 font-bold leading-relaxed text-[1.05rem]">
              💡 보호자가 회원님을 보호자 등록하려고 요청을 보냈습니다.<br />
              수락하면 보호자가 회원님의 건강 상태를 확인할 수 있어요.
            </p>
          </div>

          <Card padding="lg">
            <div className="flex items-center justify-between mb-5">
              <CardTitle className="font-black">받은 등록 요청</CardTitle>
              {pendingCount > 0 && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-full px-3 py-1.5">
                  <Bell className="w-4 h-4 text-red-500" />
                  <span className="text-red-600 font-bold text-tiny">미확인 {pendingCount}건</span>
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
                    <div key={req._id} className={`rounded-2xl p-5 border-2 ${config.bg} ${config.border}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1 flex-wrap">
                            <span className="text-gray-800 font-black text-[1.15rem]">{guardianName}</span>
                            <span className={`px-3 py-1 rounded-full font-bold ${config.color} ${config.bg} border ${config.border} text-[0.85rem]`}>
                              {config.label}
                            </span>
                          </div>
                          <p className="text-gray-500 font-bold text-tiny">{guardianEmail}</p>
                          <div className="flex items-center gap-1 text-gray-400 mt-1 font-bold text-[0.9rem]">
                            <Clock className="w-4 h-4" />{requestedAt}
                          </div>
                        </div>

                        {/* 수락/거절 버튼 (작은 패딩+아이콘이라 일반 button 유지) */}
                        {req.relationStatus === "pending" && (
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => handleAccept(req._id)}
                              className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-mid transition-colors font-bold text-tiny"
                            >
                              <UserCheck className="w-4 h-4" />수락
                            </button>
                            <button
                              onClick={() => handleReject(req._id)}
                              className="flex items-center gap-1.5 px-4 py-2.5 border-2 border-red-300 text-red-500 rounded-xl hover:bg-red-50 transition-colors font-bold text-tiny"
                            >
                              <UserX className="w-4 h-4" />거절
                            </button>
                          </div>
                        )}
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
          </Card>
        </div>
      )}

      {/* 회원 탈퇴 (텍스트 버튼이라 일반 button 유지) */}
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
