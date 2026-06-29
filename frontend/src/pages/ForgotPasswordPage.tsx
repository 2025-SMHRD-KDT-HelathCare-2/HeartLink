// frontend/src/pages/ForgotPasswordPage.tsx
// =============================================================================
// 비밀번호 찾기 (1) — 이메일 입력 → 인증번호 확인
//
// [이 파일이 하는 일]
//   - step "email": 가입 이메일을 입력하면 재설정 인증번호 메일을 보냅니다.
//   - step "code" : 메일로 받은 인증번호를 확인하고, 맞으면 새 비밀번호 설정
//                   페이지(/reset-password)로 이동합니다.
//
// [디자인 리뉴얼 포인트 — 기능은 그대로, '겉모양'만 통일]
//   1) 배경 그라데이션: from-primary..via.. → GRADIENTS.brand (청록→블루)로 통일
//   2) 주요 버튼 → gradient 변형으로 통일 (로그인/회원가입과 톤 일치)
//   ※ 메일 발송/인증번호 확인/라우팅 로직은 이전과 100% 동일합니다.
// =============================================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Mail, Heart, ShieldCheck } from "lucide-react";
import api from "../api/authApi";
import { useToast } from "../context/ToastContext";
import { Input, Button } from "../components/ui";
import { GRADIENTS } from "../styles/tokens";

// 현재 단계: 이메일 입력 화면 / 인증번호 입력 화면
type Step = "email" | "code";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false); // 메일 보내는 중
  const [verifying, setVerifying] = useState(false);   // 인증번호 확인 중

  // ---------------------------------------------------------------------------
  // [1단계] 이메일로 재설정 인증번호 보내기
  // ---------------------------------------------------------------------------
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    // 이메일 형식이 올바른지 먼저 확인
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError("올바른 이메일 주소를 입력해 주세요.");
      return;
    }
    setError("");
    setSubmitting(true);

    try {
      // 백엔드: 가입된 이메일이면 메일 발송 후 200, 아니면 404
      await api.post("/auth/password/reset-request", { email });
      showToast({
        level: "success",
        title: "메일을 보냈어요",
        message: "비밀번호 재설정 메일을 보냈습니다.",
      });
      setStep("code"); // 인증번호 입력 화면으로 전환
    } catch (err: any) {
      const msg: string = err?.message ?? "잠시 후 다시 시도해 주세요.";
      showToast({
        level: "중",
        title: msg.includes("가입된 이메일") ? "가입된 이메일이 아니에요" : "요청 실패",
        message: msg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // [2단계] 인증번호 확인 → 성공 시 새 비밀번호 페이지로 이동
  // ---------------------------------------------------------------------------
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 4) {
      setError("인증번호를 입력해 주세요.");
      return;
    }
    setError("");
    setVerifying(true);

    try {
      await api.post("/auth/password/verify-code", { email, code });
      // 인증 성공 → email, code 를 다음 페이지로 함께 넘김
      navigate("/reset-password", { state: { email, code } });
    } catch (err: any) {
      const message = err?.response?.data?.message ?? "인증번호가 올바르지 않습니다.";
      setError(message);
    } finally {
      setVerifying(false);
    }
  };

  return (
    // [리뉴얼] 전체 배경: GRADIENTS.brand(청록→블루)로 통일 — 인라인 적용
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
          {/* 로그인으로 돌아가기 (단순 텍스트 버튼이라 일반 button 유지) */}
          <button
            onClick={() => navigate("/login")}
            className="flex items-center gap-2 text-gray-400 hover:text-gray-600 mb-6 font-bold text-small"
          >
            <ChevronLeft className="w-5 h-5" />
            로그인으로 돌아가기
          </button>

          <h2 className="text-primary font-black mb-2 text-title">비밀번호를 잊으셨나요?</h2>
          <p className="text-gray-500 mb-6 font-bold text-[1.05rem]">
            {step === "email" ? (
              <>
                가입하신 이메일 주소를 입력해 주세요.
                <br />
                비밀번호 재설정 메일을 보내드릴게요.
              </>
            ) : (
              <>이메일로 받은 인증번호를 입력해 주세요.</>
            )}
          </p>

          {step === "email" ? (
            // ===== 이메일 입력 폼 =====
            <form onSubmit={handleSendEmail} className="space-y-5">
              <div>
                <label className="block text-gray-700 mb-2 font-bold text-[1.1rem]">이메일 주소</label>
                <Input
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(""); }}
                  leftIcon={<Mail className="w-6 h-6" />}
                  error={error}
                />
              </div>

              {/* [리뉴얼] gradient 변형 + loading 으로 통일 */}
              <Button type="submit" variant="gradient" size="lg" fullWidth disabled={submitting} loading={submitting}>
                {submitting ? "확인 중..." : "재설정 메일 보내기"}
              </Button>
            </form>
          ) : (
            // ===== 인증번호 입력 폼 =====
            <form onSubmit={handleVerifyCode} className="space-y-5">
              <div className="bg-gray-50 rounded-xl p-4 text-gray-600 font-bold text-tiny">
                {email}로 인증번호를 보냈어요.
              </div>

              <div>
                <label className="block text-gray-700 mb-2 font-bold text-[1.1rem]">인증번호</label>
                <Input
                  type="text"
                  placeholder="인증번호 6자리"
                  value={code}
                  // 숫자만 입력되게 필터링
                  onChange={e => { setCode(e.target.value.replace(/[^0-9]/g, "")); setError(""); }}
                  leftIcon={<ShieldCheck className="w-6 h-6" />}
                  error={error}
                />
              </div>

              {/* [리뉴얼] gradient 변형 + loading 으로 통일 */}
              <Button type="submit" variant="gradient" size="lg" fullWidth disabled={verifying} loading={verifying}>
                {verifying ? "확인 중..." : "인증번호 확인"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
