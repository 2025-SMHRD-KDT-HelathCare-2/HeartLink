// SocialRoleSelectPage.tsx
// frontend/src/pages/SocialRoleSelectPage.tsx
// =============================================================================
// 소셜 가입 완료 페이지 (역할 선택 → 휴대폰 인증 → 가입 확정)
//
// [이 파일이 하는 일]
//   - step "role" : 사용자/보호자 역할을 고릅니다.
//   - step "phone": 휴대폰 인증(발송→확인) 후 소셜 가입을 확정하고 홈으로 이동.
//
// [디자인 리뉴얼 포인트 — 기능은 그대로, '겉모양'만 통일]
//   1) 배경 그라데이션: primary 3색 → GRADIENTS.brand (청록→블루)로 통일
//   2) 주요 버튼(다음 / 가입 완료) → gradient 변형으로 통일
//   3) 에러 박스 하드코딩 색(bg-amber-50 등) → 토큰 색(warning 계열)
//   4) 만료 타이머/만료 안내의 text-red-500 → 토큰 색(COLORS.danger)
//   ※ 번호+인증요청, 인증번호+확인 가로 줄은 정렬 보존 위해 원본 input 구조 유지.
//   ※ 인증/타이머/가입 확정/라우팅 로직은 이전과 100% 동일합니다.
// =============================================================================

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  sendVerificationCode,
  verifyPhoneCode,
  completeSocialSignup,
} from "../api/authApi";
import { setAccessToken } from "../api/tokenStore";
import { Heart, User, Shield, Phone, CheckCircle2 } from "lucide-react";
import { Button } from "../components/ui";
import { COLORS, GRADIENTS } from "../styles/tokens";

type Role = "user" | "guardian";
type Step = "role" | "phone";

const VERIFY_WINDOW_SEC = 300; // 인증번호 유효시간(초) — 백엔드 5분과 일치

export function SocialRoleSelectPage() {
  const navigate = useNavigate();
  const { applySession } = useAuth();

  const [step, setStep] = useState<Step>("role");
  const [role, setRole] = useState<Role>("user");

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [remaining, setRemaining] = useState(0);

  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 남은 시간 카운트다운
  useEffect(() => {
    if (remaining <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setRemaining((r) => (r <= 1 ? 0 : r - 1));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [remaining]);

  const normalizePhone = (v: string) => v.replace(/[^0-9]/g, "");
  const isValidPhone = (v: string) => /^01[016789][0-9]{7,8}$/.test(normalizePhone(v));

  const mmss = (sec: number) => {
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  // 인증번호 발송
  const handleSendCode = async () => {
    setError("");
    setInfo("");
    if (!isValidPhone(phone)) {
      setError("올바른 휴대폰 번호를 입력해 주세요. (예: 01012345678)");
      return;
    }
    try {
      setSending(true);
      await sendVerificationCode(normalizePhone(phone));
      setCodeSent(true);
      setVerified(false);
      setCode("");
      setRemaining(VERIFY_WINDOW_SEC);
      setInfo("인증번호가 발송되었습니다. 5분 이내에 입력해 주세요.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "인증번호 발송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  };

  // 인증번호 확인
  const handleVerifyCode = async () => {
    setError("");
    setInfo("");
    if (code.trim().length < 4) {
      setError("인증번호를 정확히 입력해 주세요.");
      return;
    }
    try {
      setVerifying(true);
      await verifyPhoneCode(normalizePhone(phone), code.trim());
      setVerified(true);
      setRemaining(0);
      setInfo("휴대폰 인증이 완료되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "인증번호가 올바르지 않습니다.");
    } finally {
      setVerifying(false);
    }
  };

  // 가입 완료 (역할 + 인증된 번호 확정 → 정식 토큰 발급)
  const handleComplete = async () => {
    setError("");
    if (!verified) {
      setError("휴대폰 인증을 먼저 완료해 주세요.");
      return;
    }
    try {
      setSubmitting(true);
      const data = await completeSocialSignup({ role, phone: normalizePhone(phone) });
      setAccessToken(data.token);
      applySession(data.user, data.user.role);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "가입 완료에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  // 역할 선택 토글 버튼 스타일 — 선택 시 primary(동적이므로 인라인)
  const roleBtnStyle = (active: boolean) =>
    active
      ? { borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}1A`, color: COLORS.primary }
      : undefined;

  return (
    // [리뉴얼] 배경 그라데이션을 GRADIENTS.brand(청록→블루)로 통일
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: GRADIENTS.brand }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 rounded-full mb-4 backdrop-blur-sm">
            <Heart className="w-12 h-12 text-white fill-current" />
          </div>
          <h1 className="text-white font-bold" style={{ fontSize: "2rem" }}>가입을 완료해 주세요</h1>
          <p className="text-white/80 mt-2 text-[1.1rem]">
            {step === "role" ? "어떤 용도로 사용하실지 선택해 주세요." : "본인 확인을 위해 휴대폰 인증을 진행해 주세요."}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* 단계 표시 — 활성 단계는 primary 배경(동적이므로 인라인) */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="px-3 py-1 rounded-full font-bold text-tiny"
              style={step === "role" ? { backgroundColor: COLORS.primary, color: "#fff" } : { backgroundColor: "#f3f4f6", color: "#9ca3af" }}>
              1. 역할 선택
            </span>
            <span className="text-gray-300">→</span>
            <span className="px-3 py-1 rounded-full font-bold text-tiny"
              style={step === "phone" ? { backgroundColor: COLORS.primary, color: "#fff" } : { backgroundColor: "#f3f4f6", color: "#9ca3af" }}>
              2. 휴대폰 인증
            </span>
          </div>

          {/* 에러 박스 — [리뉴얼] amber 하드코딩 → 토큰 색(warning 계열) */}
          {error && (
            <div
              className="rounded-lg p-4 font-bold mb-4 text-small border"
              style={{
                backgroundColor: COLORS.warningBg,
                borderColor: COLORS.warningBorder,
                color: COLORS.warning,
              }}
            >
              {error}
            </div>
          )}
          {info && !error && (
            <div className="rounded-lg p-4 font-bold mb-4 text-small"
              style={{ backgroundColor: `${COLORS.primary}1A`, borderColor: `${COLORS.primary}4D`, borderWidth: 1, color: COLORS.primary }}>
              {info}
            </div>
          )}

          {/* STEP 1: 역할 선택 */}
          {step === "role" && (
            <>
              <div className="flex gap-3 mb-3">
                <button type="button" onClick={() => setRole("user")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all font-bold text-small ${role === "user" ? "" : "border-gray-200 text-gray-500"}`}
                  style={{ minHeight: 56, ...roleBtnStyle(role === "user") }}>
                  <User className="w-6 h-6" />사용자
                </button>
                <button type="button" onClick={() => setRole("guardian")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all font-bold text-small ${role === "guardian" ? "" : "border-gray-200 text-gray-500"}`}
                  style={{ minHeight: 56, ...roleBtnStyle(role === "guardian") }}>
                  <Shield className="w-6 h-6" />가족·보호자
                </button>
              </div>

              {/* 역할 설명 — 두 역할 모두 primary 톤 안내(동적이므로 인라인) */}
              <div className="px-4 py-3 rounded-xl border font-bold mb-4"
                style={{ backgroundColor: `${COLORS.primary}1A`, borderColor: `${COLORS.primary}4D`, color: COLORS.primary, fontSize: "0.95rem" }}>
                <span style={{ wordBreak: "keep-all", lineHeight: "1.8", whiteSpace: "pre-line" }}>
                  {role === "user"
                    ? "측정하는 본인의 페이지입니다.\n잘 모르실 경우, 보호자와 함께 진행해 주세요."
                    : "측정 결과를 지켜볼 수 있는 보호자 계정입니다."}
                </span>
              </div>

              {/* 다음 버튼 — [리뉴얼] gradient 변형으로 통일 */}
              <Button variant="gradient" size="lg" fullWidth
                onClick={() => { setError(""); setInfo(""); setStep("phone"); }}>
                다음 (휴대폰 인증)
              </Button>
            </>
          )}

          {/* STEP 2: 휴대폰 인증 */}
          {step === "phone" && (
            <>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2 font-bold text-[1.1rem]">휴대폰 번호</label>
                <div className="flex gap-2">
                  {/* 번호 입력 + 인증요청 버튼이 한 줄에 붙는 레이아웃이라 input 은 기존 유지 */}
                  <div className="relative flex-1">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="01012345678"
                      value={phone}
                      disabled={verified}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl focus:outline-none bg-gray-50 font-bold disabled:opacity-60 text-[1.1rem]"
                      style={{ minHeight: 56 }}
                      onFocus={e => (e.currentTarget.style.borderColor = COLORS.primary)}
                      onBlur={e => (e.currentTarget.style.borderColor = "")}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={sending || verified}
                    className="px-4 rounded-xl border-2 font-bold whitespace-nowrap disabled:opacity-50 text-small"
                    style={{ minHeight: 56, borderColor: COLORS.primary, color: COLORS.primary }}
                  >
                    {sending ? "발송 중..." : codeSent ? "재발송" : "인증번호 발송"}
                  </button>
                </div>
              </div>

              {codeSent && !verified && (
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2 font-bold text-[1.1rem]">인증번호</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="6자리 숫자"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        className="w-full pl-4 pr-16 py-4 border border-gray-200 rounded-xl focus:outline-none bg-gray-50 font-bold text-[1.1rem]"
                        style={{ minHeight: 56 }}
                        onFocus={e => (e.currentTarget.style.borderColor = COLORS.primary)}
                        onBlur={e => (e.currentTarget.style.borderColor = "")}
                      />
                      {remaining > 0 && (
                        // [리뉴얼] 만료 타이머 색 → 토큰(COLORS.danger)
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-small" style={{ color: COLORS.danger }}>
                          {mmss(remaining)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleVerifyCode}
                      disabled={verifying || remaining <= 0}
                      className="px-4 rounded-xl text-white font-bold whitespace-nowrap disabled:opacity-50 text-small"
                      style={{ minHeight: 56, backgroundColor: COLORS.primary }}
                    >
                      {verifying ? "확인 중..." : "확인"}
                    </button>
                  </div>
                  {remaining <= 0 && (
                    // [리뉴얼] 만료 안내 색 → 토큰(COLORS.danger)
                    <p className="mt-1 font-bold" style={{ fontSize: "0.95rem", color: COLORS.danger }}>
                      인증 시간이 만료되었습니다. 재발송해 주세요.
                    </p>
                  )}
                </div>
              )}

              {verified && (
                <div className="flex items-center gap-2 font-bold mb-4 text-small" style={{ color: COLORS.primary }}>
                  <CheckCircle2 className="w-6 h-6" /> 휴대폰 인증 완료
                </div>
              )}

              <div className="flex gap-2">
                <button type="button" onClick={() => { setError(""); setInfo(""); setStep("role"); }}
                  className="px-5 rounded-xl border-2 border-gray-200 text-gray-500 font-bold text-small"
                  style={{ minHeight: 60 }}>
                  이전
                </button>
                {/* 가입 완료 — [리뉴얼] gradient 변형으로 통일 */}
                <Button variant="gradient" size="lg" fullWidth
                  onClick={handleComplete} disabled={!verified || submitting} loading={submitting}
                  className="flex-1">
                  {submitting ? "가입 완료 중..." : "가입 완료"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
