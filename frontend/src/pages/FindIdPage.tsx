import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Phone, ShieldCheck, Heart, Mail, RotateCcw } from "lucide-react";
import { sendVerificationCode, verifyPhoneCode } from "../api/authApi";
import api from "../api/authApi";
import { useToast } from "../context/ToastContext";

type Step = "phone" | "code" | "result";

export function FindIdPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [foundEmail, setFoundEmail] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  const handleSendCode = async () => {
    if (!phone.match(/^01[0-9]{8,9}$/)) {
      setError("올바른 휴대전화번호를 입력해 주세요. (- 없이 숫자만)");
      return;
    }
    setError("");
    setSending(true);
    try {
      await sendVerificationCode(phone);
      setCodeSent(true);
      setStep("code");
      showToast({ level: "success", title: "인증번호 발송", message: "휴대전화로 인증번호를 보냈습니다." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "인증번호 발송에 실패했습니다.";
      setError(message);
    } finally {
      setSending(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length < 4) {
      setError("인증번호를 입력해 주세요.");
      return;
    }
    setError("");
    setVerifying(true);
    try {
      await verifyPhoneCode(phone, code);
      // 인증 성공 → 가입된 이메일 조회
      const { data } = await api.post("/auth/find-email", { phone });
      setFoundEmail(data.email);
      setStep("result");
    } catch (err) {
      const message = err instanceof Error ? err.message : "인증번호가 올바르지 않습니다.";
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

          <h2 className="text-[#0A2647] font-black mb-2" style={{ fontSize: "1.6rem" }}>아이디(이메일) 찾기</h2>
          <p className="text-gray-500 mb-6 font-bold" style={{ fontSize: "1.05rem" }}>
            가입하신 휴대전화번호로 본인인증을 해 주세요.
          </p>

          {step !== "result" && (
            <div className="space-y-5">
              <div>
                <label className="block text-gray-700 mb-2 font-bold" style={{ fontSize: "1.1rem" }}>휴대전화번호</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="tel" placeholder="01012345678" value={phone}
                      disabled={step === "code"}
                      onChange={e => { setPhone(e.target.value.replace(/[^0-9]/g, "")); setError(""); }}
                      className="w-full pl-11 pr-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0E8080] bg-gray-50 font-bold disabled:opacity-60"
                      style={{ minHeight: 56, fontSize: "1.05rem" }} />
                  </div>
                  <button onClick={handleSendCode} disabled={sending || step === "code"}
                    className="px-4 rounded-xl bg-[#0A2647] text-white font-bold disabled:opacity-50 whitespace-nowrap"
                    style={{ minHeight: 56, fontSize: "0.95rem" }}>
                    {sending ? "발송 중..." : codeSent ? "재발송" : "인증 요청"}
                  </button>
                </div>
              </div>

              {step === "code" && (
                <div>
                  <label className="block text-gray-700 mb-2 font-bold" style={{ fontSize: "1.1rem" }}>인증번호</label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="text" placeholder="인증번호 6자리" value={code}
                      onChange={e => { setCode(e.target.value.replace(/[^0-9]/g, "")); setError(""); }}
                      className="w-full pl-11 pr-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0E8080] bg-gray-50 font-bold"
                      style={{ minHeight: 56, fontSize: "1.05rem" }} />
                  </div>
                </div>
              )}

              {error && <p className="text-red-500 font-bold" style={{ fontSize: "1rem" }}>{error}</p>}

              {step === "code" && (
                <button onClick={handleVerifyCode} disabled={verifying}
                  className="w-full py-5 bg-gradient-to-r from-[#0A2647] to-[#0E8080] text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-50 font-bold"
                  style={{ minHeight: 60, fontSize: "1.2rem" }}>
                  {verifying ? "확인 중..." : "인증 확인"}
                </button>
              )}
            </div>
          )}

          {step === "result" && (
            <div className="text-center">
              <div className="bg-[#0E8080]/10 border-2 border-[#0E8080]/30 rounded-2xl p-6 mb-6">
                <Mail className="w-10 h-10 text-[#0E8080] mx-auto mb-3" />
                <p className="text-gray-500 font-bold mb-2" style={{ fontSize: "1rem" }}>가입하신 이메일 주소예요</p>
                <p className="text-[#0A2647] font-black" style={{ fontSize: "1.4rem" }}>{foundEmail}</p>
              </div>
              <button onClick={() => navigate("/login")}
                className="w-full py-5 bg-gradient-to-r from-[#0A2647] to-[#0E8080] text-white rounded-xl hover:opacity-90 transition-all font-bold"
                style={{ minHeight: 60, fontSize: "1.2rem" }}>
                로그인하러 가기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
