import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Mail, Heart, ShieldCheck } from "lucide-react";
import api from "../api/authApi";
import { useToast } from "../context/ToastContext";

type Step = "email" | "code";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError("올바른 이메일 주소를 입력해 주세요.");
      return;
    }
    setError("");
    setSubmitting(true);

    try {
      // 백엔드: 가입된 이메일이면 재설정 인증번호 메일 발송 후 200, 가입 안 된 이메일이면 404
      await api.post("/auth/password/reset-request", { email });
      showToast({
        level: "success",
        title: "메일을 보냈어요",
        message: "비밀번호 재설정 메일을 보냈습니다.",
      });
      setStep("code");
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) {
        showToast({
          level: "중",
          title: "가입된 이메일이 아니에요",
          message: "이메일을 다시 확인해 주세요.",
        });
      } else {
        showToast({
          level: "중",
          title: "요청 실패",
          message: "잠시 후 다시 시도해 주세요.",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

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
      // 인증 성공 → 비밀번호 변경 페이지로 (email, code를 state로 전달)
      navigate("/reset-password", { state: { email, code } });
    } catch (err: any) {
      const message = err?.response?.data?.message ?? "인증번호가 올바르지 않습니다.";
      setError(message);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A2647] via-[#144272] to-[#0E8080] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 rounded-full mb-4 backdrop-blur-sm">
            <Heart className="w-12 h-12 text-white fill-current" />
          </div>
          <h1 className="text-white font-bold" style={{ fontSize: "2.4rem" }}>HeartLink</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <button onClick={() => navigate("/login")}
            className="flex items-center gap-2 text-gray-400 hover:text-gray-600 mb-6 font-bold"
            style={{ fontSize: "1rem" }}>
            <ChevronLeft className="w-5 h-5" />로그인으로 돌아가기
          </button>

          <h2 className="text-[#0A2647] font-black mb-2" style={{ fontSize: "1.6rem" }}>비밀번호를 잊으셨나요?</h2>
          <p className="text-gray-500 mb-6 font-bold" style={{ fontSize: "1.05rem" }}>
            {step === "email"
              ? <>가입하신 이메일 주소를 입력해 주세요.<br />비밀번호 재설정 메일을 보내드릴게요.</>
              : <>이메일로 받은 인증번호를 입력해 주세요.</>}
          </p>

          {step === "email" ? (
            <form onSubmit={handleSendEmail} className="space-y-5">
              <div>
                <label className="block text-gray-700 mb-2 font-bold" style={{ fontSize: "1.1rem" }}>이메일 주소</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                  <input type="email" placeholder="example@email.com" value={email}
                    onChange={e => { setEmail(e.target.value); setError(""); }}
                    className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0E8080] bg-gray-50 font-bold"
                    style={{ minHeight: 56, fontSize: "1.1rem" }} />
                </div>
                {error && <p className="text-red-500 mt-1 font-bold" style={{ fontSize: "1rem" }}>{error}</p>}
              </div>

              <button type="submit" disabled={submitting}
                className="w-full py-5 bg-gradient-to-r from-[#0A2647] to-[#0E8080] text-white rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 font-bold"
                style={{ minHeight: 60, fontSize: "1.2rem" }}>
                {submitting ? "확인 중..." : "재설정 메일 보내기"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-5">
              <div className="bg-gray-50 rounded-xl p-4 text-gray-600 font-bold" style={{ fontSize: "0.95rem" }}>
                {email}로 인증번호를 보냈어요.
              </div>

              <div>
                <label className="block text-gray-700 mb-2 font-bold" style={{ fontSize: "1.1rem" }}>인증번호</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                  <input type="text" placeholder="인증번호 6자리" value={code}
                    onChange={e => { setCode(e.target.value.replace(/[^0-9]/g, "")); setError(""); }}
                    className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0E8080] bg-gray-50 font-bold"
                    style={{ minHeight: 56, fontSize: "1.1rem" }} />
                </div>
                {error && <p className="text-red-500 mt-1 font-bold" style={{ fontSize: "1rem" }}>{error}</p>}
              </div>

              <button type="submit" disabled={verifying}
                className="w-full py-5 bg-gradient-to-r from-[#0A2647] to-[#0E8080] text-white rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 font-bold"
                style={{ minHeight: 60, fontSize: "1.2rem" }}>
                {verifying ? "확인 중..." : "인증번호 확인"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}