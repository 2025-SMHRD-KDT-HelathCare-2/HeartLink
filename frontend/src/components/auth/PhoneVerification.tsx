import { useState, useEffect, useRef } from "react";
import { Phone, CheckCircle2 } from "lucide-react";
import { sendVerificationCode, verifyPhoneCode } from "../../api/authApi";

const VERIFY_WINDOW_SEC = 300; // 인증번호 유효시간(초) — 백엔드 5분과 일치

interface Props {
  // 부모(가입 폼)가 가진 전화번호 값
  phone: string;
  // 전화번호 입력이 바뀔 때 부모에게 알림
  onPhoneChange: (phone: string) => void;
  // 인증 완료/해제 여부를 부모에게 알림
  onVerifiedChange: (verified: boolean) => void;
}

export function PhoneVerification({ phone, onPhoneChange, onVerifiedChange }: Props) {
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [remaining, setRemaining] = useState(0);

  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
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

  // 숫자만 남기기
  const normalizePhone = (v: string) => v.replace(/[^0-9]/g, "");
  const isValidPhone = (v: string) => /^01[016789][0-9]{7,8}$/.test(normalizePhone(v));

  const mmss = (sec: number) => {
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  // 전화번호가 바뀌면 인증 상태 초기화 (다른 번호로 바꾸면 다시 인증해야 함)
  const handlePhoneInput = (value: string) => {
    onPhoneChange(value);
    if (verified) {
      setVerified(false);
      onVerifiedChange(false);
    }
    setCodeSent(false);
    setCode("");
    setRemaining(0);
    setError("");
    setInfo("");
  };

  // 인증번호 발송
  const handleSend = async () => {
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
      onVerifiedChange(false);
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
  const handleVerify = async () => {
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
      onVerifiedChange(true);
      setRemaining(0);
      setInfo("휴대폰 인증이 완료되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "인증번호가 올바르지 않습니다.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="mb-5">
      <label className="flex items-center gap-2 text-gray-700 mb-2 font-bold" style={{ fontSize: "1.1rem" }}>
        휴대폰 번호
        <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-600 font-bold" style={{ fontSize: "0.8rem" }}>필수</span>
      </label>

      {/* 전화번호 입력 + 발송 버튼 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
          <input
            type="tel"
            inputMode="numeric"
            placeholder="01012345678"
            value={phone}
            disabled={verified}
            onChange={(e) => handlePhoneInput(e.target.value)}
            className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0D9488] bg-gray-50 font-bold disabled:opacity-60"
            style={{ minHeight: 56, fontSize: "1.1rem" }}
          />
        </div>
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || verified}
          className="px-4 rounded-xl border-2 border-[#0D9488] text-[#0D9488] font-bold whitespace-nowrap disabled:opacity-50"
          style={{ minHeight: 56, fontSize: "1rem" }}
        >
          {sending ? "발송 중..." : codeSent ? "재발송" : "인증번호 발송"}
        </button>
      </div>

      {/* 인증번호 입력 (발송 후 + 미인증 상태에서만 노출) */}
      {codeSent && !verified && (
        <div className="mt-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                inputMode="numeric"
                placeholder="6자리 인증번호"
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
              onClick={handleVerify}
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

      {/* 인증 완료 표시 */}
      {verified && (
        <div className="flex items-center gap-2 text-[#0D9488] font-bold mt-2" style={{ fontSize: "1.05rem" }}>
          <CheckCircle2 className="w-6 h-6" /> 휴대폰 인증 완료
        </div>
      )}

      {/* 안내/오류 메시지 */}
      {error && <p className="text-red-500 mt-2 font-bold" style={{ fontSize: "1rem" }}>{error}</p>}
      {info && !error && <p className="text-[#0D9488] mt-2 font-bold" style={{ fontSize: "1rem" }}>{info}</p>}
    </div>
  );
}
