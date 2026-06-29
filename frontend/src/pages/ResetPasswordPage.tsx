// frontend/src/pages/ResetPasswordPage.tsx
// =============================================================================
// 비밀번호 찾기 (2) — 새 비밀번호 설정
//
// [이 파일이 하는 일]
//   - 앞 페이지(ForgotPasswordPage)에서 넘겨준 email/code 가 있어야 동작합니다.
//   - 새 비밀번호를 입력받아 서버에 변경 요청을 보내고, 성공하면 로그인으로 이동합니다.
//   - email/code 없이 직접 들어오면 '잘못된 접근' 안내를 보여줍니다.
//
// [디자인 리뉴얼 포인트 — 기능은 그대로, '겉모양'만 통일]
//   1) 배경 그라데이션: from-primary..via.. → GRADIENTS.brand (청록→블루)로 통일
//      (잘못된 접근 화면 / 정상 화면 양쪽 모두)
//   2) 주요 버튼 → gradient 변형으로 통일
//   ※ 검증/비밀번호 변경/라우팅 로직은 이전과 100% 동일합니다.
// =============================================================================

import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, Lock, Eye, EyeOff, Heart } from "lucide-react";
import api from "../api/authApi";
import { useToast } from "../context/ToastContext";
import { Input, Button } from "../components/ui";
import { GRADIENTS } from "../styles/tokens";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  // 앞 페이지에서 navigate(..., { state: { email, code } }) 로 넘겨준 값
  const email = (location.state as any)?.email;
  const code = (location.state as any)?.code;

  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ---------------------------------------------------------------------------
  // [방어] email/code 없이 직접 URL 로 들어온 경우 → 안내 후 되돌려보냄
  // ---------------------------------------------------------------------------
  if (!email || !code) {
    return (
      // [리뉴얼] 배경 그라데이션 통일
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: GRADIENTS.brand }}>
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <p className="text-gray-600 font-bold mb-5 text-[1.1rem]">
            잘못된 접근입니다. 비밀번호 찾기를 다시 시도해 주세요.
          </p>
          {/* [리뉴얼] gradient 변형으로 통일 */}
          <Button variant="gradient" size="md" fullWidth onClick={() => navigate("/forgot-password")}>
            비밀번호 찾기로 이동
          </Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // [제출] 새 비밀번호 검사 후 서버에 변경 요청
  // ---------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("비밀번호는 8글자 이상이어야 합니다.");
      return;
    }
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setError("");
    setSubmitting(true);

    try {
      await api.post("/auth/password/reset", { email, code, newPassword: password });
      showToast({
        level: "success",
        title: "비밀번호 변경 완료",
        message: "비밀번호가 변경됐습니다.",
      });
      navigate("/login");
    } catch (err: any) {
      const message = err?.response?.data?.message ?? "비밀번호 변경에 실패했습니다.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // [리뉴얼] 배경 그라데이션 통일
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: GRADIENTS.brand }}>
      <div className="w-full max-w-md">
        {/* 상단 로고 영역 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 rounded-full mb-4 backdrop-blur-sm">
            <Heart className="w-12 h-12 text-white fill-current" />
          </div>
          <h1 className="text-white font-bold text-hero">HeartLink</h1>
        </div>

        {/* 흰색 카드 */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <button
            onClick={() => navigate("/login")}
            className="flex items-center gap-2 text-gray-400 hover:text-gray-600 mb-6 font-bold text-small"
          >
            <ChevronLeft className="w-5 h-5" />
            로그인으로 돌아가기
          </button>

          <h2 className="text-primary font-black mb-2 text-title">새 비밀번호 설정</h2>
          <p className="text-gray-500 mb-6 font-bold text-[1.05rem]">
            새로 사용할 비밀번호를 입력해 주세요.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 새 비밀번호 (오른쪽 눈 아이콘으로 보기/숨기기) */}
            <div>
              <label className="block text-gray-700 mb-2 font-bold text-[1.1rem]">새 비밀번호</label>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="8글자 이상 입력"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                leftIcon={<Lock className="w-6 h-6" />}
                rightSlot={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
                  </button>
                }
              />
            </div>

            {/* 새 비밀번호 확인 (위와 같은 보기/숨기기 상태 공유, 에러는 여기 표시) */}
            <div>
              <label className="block text-gray-700 mb-2 font-bold text-[1.1rem]">새 비밀번호 확인</label>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="비밀번호를 다시 입력"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setError(""); }}
                leftIcon={<Lock className="w-6 h-6" />}
                error={error}
              />
            </div>

            {/* [리뉴얼] gradient 변형 + loading 으로 통일 */}
            <Button type="submit" variant="gradient" size="lg" fullWidth disabled={submitting} loading={submitting}>
              {submitting ? "변경 중..." : "비밀번호 변경하기"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
