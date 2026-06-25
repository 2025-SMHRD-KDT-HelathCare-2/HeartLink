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
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "가입 완료에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0D9488] via-[#0F766E] to-[#0D9488] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 rounded-full mb-4 backdrop-blur-sm">
            <Heart className="w-12 h-12 text-white fill-current" />
          </div>
          <h1 className="text-white font-bold" style={{ fontSize: "2rem" }}>가입을 완료해 주세요</h1>
          <p className="text-white/80 mt-2" style={{ fontSize: "1.1rem" }}>
            {step === "role" ? "어떤 용도로 사용하실지 선택해 주세요." : "본인 확인을 위해 휴대폰 인증을 진행해 주세요."}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* 단계 표시 */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className={`px-3 py-1 rounded-full font-bold ${step === "role" ? "bg-[#0D9488] text-white" : "bg-gray-100 text-gray-400"}`} style={{ fontSize: "0.9rem" }}>1. 역할 선택</span>
            <span className="text-gray-300">→</span>
            <span className={`px-3 py-1 rounded-full font-bold ${step === "phone" ? "bg-[#0D9488] text-white" : "bg-gray-100 text-gray-400"}`} style={{ fontSize: "0.9rem" }}>2. 휴대폰 인증</span>
          </div>

          {error && (
            <div className="bg-amber-50 border border-amber-300 text-amber-800 rounded-lg p-4 font-bold mb-4" style={{ fontSize: "1rem" }}>
              {error}
            </div>
          )}
          {info && !error && (
            <div className="bg-[#0D9488]/10 border border-[#0D9488]/30 text-[#0D9488] rounded-lg p-4 font-bold mb-4" style={{ fontSize: "1rem" }}>
              {info}
            </div>
          )}

          {/* STEP 1: 역할 선택 */}
          {step === "role" && (
            <>
              <div className="flex gap-3 mb-3">
                <button type="button" onClick={() => setRole("user")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all font-bold ${role === "user" ? "border-[#0D9488] bg-[#0D9488]/10 text-[#0D9488]" : "border-gray-200 text-gray-500"}`}
                  style={{ minHeight: 56, fontSize: "1.05rem" }}>
                  <User className="w-6 h-6" />사용자
                </button>
                <button type="button" onClick={() => setRole("guardian")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all font-bold ${role === "guardian" ? "border-[#0D9488] bg-[#0D9488]/10 text-[#0D9488]" : "border-gray-200 text-gray-500"}`}
                  style={{ minHeight: 56, fontSize: "1.05rem" }}>
                  <Shield className="w-6 h-6" />가족·보호자
                </button>
              </div>

              <div
                className={`px-4 py-3 rounded-xl border font-bold mb-4 ${
                  role === "user"
                    ? "bg-[#0D9488]/10 border-[#0D9488]/30 text-[#0D9488]"
                    : "bg-[#0D9488]/10 border-[#0D9488]/30 text-[#0D9488]"
                }`}
                style={{ fontSize: "0.95rem" }}
              >
                <span style={{ wordBreak: "keep-all", lineHeight: "1.8", whiteSpace: "pre-line" }}>
                  {role === "user"
                    ? "측정하는 본인의 페이지입니다.\n잘 모르실 경우, 보호자와 함께 진행해 주세요."
                    : "측정 결과를 지켜볼 수 있는 보호자 계정입니다."}
                </span>
              </div>

              <button type="button" onClick={() => { setError(""); setInfo(""); setStep("phone"); }}
                className="w-full py-5 bg-gradient-to-r from-[#0D9488] to-[#0D9488] text-white rounded-xl hover:opacity-90 active:scale-95 transition-all font-bold"
                style={{ minHeight: 60, fontSize: "1.2rem" }}>
                다음 (휴대폰 인증)
              </button>
            </>
          )}

          {/* STEP 2: 휴대폰 인증 */}
          {step === "phone" && (
            <>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2 font-bold" style={{ fontSize: "1.1rem" }}>휴대폰 번호</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="01012345678"
                      value={phone}
                      disabled={verified}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0D9488] bg-gray-50 font-bold disabled:opacity-60"
                      style={{ minHeight: 56, fontSize: "1.1rem" }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={sending || verified}
                    className="px-4 rounded-xl border-2 border-[#0D9488] text-[#0D9488] font-bold whitespace-nowrap disabled:opacity-50"
                    style={{ minHeight: 56, fontSize: "1rem" }}
                  >
                    {sending ? "발송 중..." : codeSent ? "재발송" : "인증번호 발송"}
                  </button>
                </div>
              </div>

              {codeSent && !verified && (
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2 font-bold" style={{ fontSize: "1.1rem" }}>인증번호</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="6자리 숫자"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        className="w-full pl-4 pr-16 py-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0D9488] bg-gray-50 font-bold"
                        style={{ minHeight: 56, fontSize: "1.1rem" }}
                      />
                      {remaining > 0 && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500 font-bold" style={{ fontSize: "1rem" }}>
                          {mmss(remaining)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleVerifyCode}
                      disabled={verifying || remaining <= 0}
                      className="px-4 rounded-xl bg-[#0D9488] text-white font-bold whitespace-nowrap disabled:opacity-50"
                      style={{ minHeight: 56, fontSize: "1rem" }}
                    >
                      {verifying ? "확인 중..." : "확인"}
                    </button>
                  </div>
                  {remaining <= 0 && (
                    <p className="text-red-500 mt-1 font-bold" style={{ fontSize: "0.95rem" }}>
                      인증 시간이 만료되었습니다. 재발송해 주세요.
                    </p>
                  )}
                </div>
              )}

              {verified && (
                <div className="flex items-center gap-2 text-[#0D9488] font-bold mb-4" style={{ fontSize: "1.05rem" }}>
                  <CheckCircle2 className="w-6 h-6" /> 휴대폰 인증 완료
                </div>
              )}

              <div className="flex gap-2">
                <button type="button" onClick={() => { setError(""); setInfo(""); setStep("role"); }}
                  className="px-5 rounded-xl border-2 border-gray-200 text-gray-500 font-bold"
                  style={{ minHeight: 60, fontSize: "1.05rem" }}>
                  이전
                </button>
                <button type="button" onClick={handleComplete} disabled={!verified || submitting}
                  className="flex-1 py-5 bg-gradient-to-r from-[#0D9488] to-[#0D9488] text-white rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 font-bold"
                  style={{ minHeight: 60, fontSize: "1.2rem" }}>
                  {submitting ? "가입 완료 중..." : "가입 완료"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
