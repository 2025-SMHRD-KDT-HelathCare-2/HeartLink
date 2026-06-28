// frontend/src/pages/FindIdPage.tsx
// =============================================================================
// 아이디(이메일) 찾기
//
// [이 파일이 하는 일]
//   - step "phone" : 휴대전화번호 입력 → 인증번호 발송
//   - step "code"  : 받은 인증번호 확인 → 가입된 이메일 조회
//   - step "result": 찾은 이메일을 보여줌
//
// [1단계 리팩터링에서 바뀐 점 — 기능은 그대로, '겉모양 코드'만 정리]
//   1) 색상 하드코딩 → 디자인 토큰 클래스(primary 등)
//   2) 글자 크기 인라인 style → 토큰 클래스
//   3) 인증번호 입력칸/제출 버튼 → 공통 <Input> / <Button>
//   ※ 단, 휴대폰번호 입력칸은 옆에 '인증 요청' 버튼이 가로로 붙는 특수 구조라
//      정렬 보존을 위해 원본 input 구조를 유지하고 색/폰트 토큰만 정리했습니다.
//   ※ 화면 결과(디자인/동작)는 이전과 똑같습니다.
// =============================================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Phone, ShieldCheck, Heart, Mail } from "lucide-react";
import { sendFindEmailCode, verifyFindEmailCode } from "../api/authApi";
import api from "../api/authApi"; // find-email 조회용
import { useToast } from "../context/ToastContext";
import { Input, Button } from "../components/ui";

// 현재 단계: 전화번호 입력 / 인증번호 입력 / 결과 표시
type Step = "phone" | "code" | "result";

export function FindIdPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [foundEmail, setFoundEmail] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);     // 인증번호 발송 중
  const [verifying, setVerifying] = useState(false); // 인증번호 확인 중
  const [codeSent, setCodeSent] = useState(false);   // 한 번이라도 보냈는지

  // ---------------------------------------------------------------------------
  // [1단계] 휴대전화로 인증번호 발송
  // ---------------------------------------------------------------------------
  const handleSendCode = async () => {
    // 01012345678 형식(- 없이 숫자만) 검사
    if (!phone.match(/^01[0-9]{8,9}$/)) {
      setError("올바른 휴대전화번호를 입력해 주세요. (- 없이 숫자만)");
      return;
    }
    setError("");
    setSending(true);
    try {
      await sendFindEmailCode(phone);
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

  // ---------------------------------------------------------------------------
  // [2단계] 인증번호 확인 → 가입 이메일 조회 → 결과 화면으로
  // ---------------------------------------------------------------------------
  const handleVerifyCode = async () => {
    if (code.length < 4) {
      setError("인증번호를 입력해 주세요.");
      return;
    }
    setError("");
    setVerifying(true);
    try {
      await verifyFindEmailCode(phone, code);
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
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary-mid to-primary flex items-center justify-center p-4">
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

          <h2 className="text-primary font-black mb-2 text-title">아이디(이메일) 찾기</h2>
          <p className="text-gray-500 mb-6 font-bold text-[1.05rem]">
            가입하신 휴대전화번호로 본인인증을 해 주세요.
          </p>

          {/* ===== 전화번호/인증번호 입력 단계 ===== */}
          {step !== "result" && (
            <div className="space-y-5">
              {/* 휴대전화번호 입력 + '인증 요청' 버튼 (가로 한 줄)
                  이 줄은 정렬 보존을 위해 원본 input 구조를 유지합니다. */}
              <div>
                <label className="block text-gray-700 mb-2 font-bold text-[1.1rem]">휴대전화번호</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      placeholder="01012345678"
                      value={phone}
                      disabled={step === "code"} // 인증번호 단계에선 전화번호 수정 잠금
                      onChange={e => { setPhone(e.target.value.replace(/[^0-9]/g, "")); setError(""); }}
                      className="w-full pl-11 pr-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:border-primary bg-gray-50 font-bold disabled:opacity-60 text-[1.05rem]"
                      style={{ minHeight: 56 }}
                    />
                  </div>
                  {/* 인증 요청/재발송 버튼 — 폭이 좁고 작은 글씨라 일반 button 유지 */}
                  <button
                    onClick={handleSendCode}
                    disabled={sending || step === "code"}
                    className="px-4 rounded-xl bg-primary text-white font-bold disabled:opacity-50 whitespace-nowrap text-tiny"
                    style={{ minHeight: 56 }}
                  >
                    {sending ? "발송 중..." : codeSent ? "재발송" : "인증 요청"}
                  </button>
                </div>
              </div>

              {/* 인증번호 입력 (인증번호 단계에서만 표시) */}
              {step === "code" && (
                <div>
                  <label className="block text-gray-700 mb-2 font-bold text-[1.1rem]">인증번호</label>
                  <Input
                    type="text"
                    placeholder="인증번호 6자리"
                    value={code}
                    onChange={e => { setCode(e.target.value.replace(/[^0-9]/g, "")); setError(""); }}
                    leftIcon={<ShieldCheck className="w-5 h-5" />}
                  />
                </div>
              )}

              {/* 에러 메시지 (전화번호 단계/인증 단계 공용이라 폼 아래에 따로 표시) */}
              {error && <p className="text-red-500 font-bold text-small">{error}</p>}

              {/* 인증 확인 버튼 (인증번호 단계에서만 표시) */}
              {step === "code" && (
                <Button variant="primary" size="lg" fullWidth onClick={handleVerifyCode} disabled={verifying}>
                  {verifying ? "확인 중..." : "인증 확인"}
                </Button>
              )}
            </div>
          )}

          {/* ===== 결과 단계: 찾은 이메일 표시 ===== */}
          {step === "result" && (
            <div className="text-center">
              <div className="bg-primary/10 border-2 border-primary/30 rounded-2xl p-6 mb-6">
                <Mail className="w-10 h-10 text-primary mx-auto mb-3" />
                <p className="text-gray-500 font-bold mb-2 text-small">가입하신 이메일 주소예요</p>
                <p className="text-primary font-black text-[1.4rem]">{foundEmail}</p>
              </div>
              <Button variant="primary" size="lg" fullWidth onClick={() => navigate("/login")}>
                로그인하러 가기
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
