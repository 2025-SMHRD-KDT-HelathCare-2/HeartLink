// frontend/src/pages/Registerpage.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Heart, Eye, EyeOff, Lock, Mail, User, Shield,
  Calendar, CheckCircle
  // ↑ [변경] 나이 입력 칸에 쓰던 'UserCircle' 아이콘을 삭제하고,
  //   생년월일(날짜) 입력에 어울리는 'Calendar'(달력) 아이콘으로 교체했습니다.
} from "lucide-react";
import { register, type RegisterPayload } from "../api/authApi";
import { SocialLoginButtons } from "../components/auth/SocialLoginButtons";
import { PhoneVerification } from "../components/auth/PhoneVerification";


type Role = "user" | "guardian";

function FieldLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-gray-700 mb-2 font-bold" style={{ fontSize: "1.1rem" }}>
      {text}
      {required ? (
        <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-600 font-bold" style={{ fontSize: "0.8rem" }}>필수</span>
      ) : (
        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 font-bold" style={{ fontSize: "0.8rem" }}>선택</span>
      )}
    </label>
  );
}

function RoleToast({ role }: { role: Role }) {
  const [visible, setVisible] = useState(false);
  const [displayRole, setDisplayRole] = useState<Role>(role);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => {
      setDisplayRole(role);
      requestAnimationFrame(() => setVisible(true));
    }, 150);
    return () => clearTimeout(t);
  }, [role]);

  const isUser = displayRole === "user";
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border font-bold mb-4 transition-all duration-500 ${visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
        } ${isUser
          ? "bg-[#0D9488]/10 border-[#0D9488]/30 text-[#0D9488]"
          : "bg-[#0D9488]/10 border-[#0D9488]/30 text-[#0D9488]"
        }`}
      style={{ fontSize: "0.95rem" }}
    >
      <span>
        {isUser
          ? "측정하는 본인의 페이지입니다. 잘 모르실 경우 보호자와 함께 진행해 주세요."
          : "측정 결과를 지켜볼 수 있는 보호자 계정입니다."}
      </span>
    </div>
  );
}

function SuccessModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm text-center">
        <div className="flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mx-auto mb-5">
          <CheckCircle className="w-12 h-12 text-green-500" />
        </div>
        <h2 className="text-[#0D9488] font-black mb-3" style={{ fontSize: "1.6rem" }}>가입 완료!</h2>
        <p className="text-gray-600 font-bold mb-7 leading-relaxed" style={{ fontSize: "1.1rem" }}>
          HeartLink 회원이 되셨습니다.<br />로그인 후 서비스를 이용하세요.
        </p>
        <button onClick={onClose}
          className="w-full py-4 bg-linear-to-r from-[#0D9488] to-[#0D9488] text-white rounded-xl font-bold hover:opacity-90 transition-all"
          style={{ fontSize: "1.15rem" }}>
          로그인하러 가기
        </button>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("user");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // -----------------------------------------------------------------------
  // [변경 포인트 1] 회원가입 입력값을 담아두는 상태(form)
  //   - 기존에 있던 'age'(나이) 항목을 'birthDate'(생년월일)로 바꿨습니다.
  //   - 기존에 있던 'medications'(복용 약) 항목은 완전히 삭제했습니다.
  //   - birthDate 는 화면의 날짜 선택기에서 "YYYY-MM-DD" 형태의 문자열로 저장됩니다.
  //     (예: "1955-03-12")
  // -----------------------------------------------------------------------
  const [form, setForm] = useState({
    email: "", password: "", passwordConfirm: "", nickname: "",
    birthDate: "", gender: "" as "" | "M" | "F",
    medical_history: "",
    phone: "",
  });

  // 전화번호 인증 완료 여부
  const [phoneVerified, setPhoneVerified] = useState(false);

  const setField = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!phoneVerified) errs.phone = "전화번호 인증을 완료해 주세요.";
    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
      errs.email = "올바른 이메일 주소를 입력해 주세요.";
    if (form.password.length < 8)
      errs.password = "비밀번호는 8글자 이상이어야 합니다.";
    if (form.password !== form.passwordConfirm)
      errs.passwordConfirm = "비밀번호가 일치하지 않습니다.";
    if (!form.nickname.trim()) errs.nickname = "닉네임을 입력해 주세요.";

    // ---------------------------------------------------------------------
    // [변경 포인트 2] 생년월일(birthDate) 검증
    //   - 생년월일은 '선택' 항목이라, 입력했을 때만 검사합니다.
    //   - (1) 미래 날짜(아직 오지 않은 날)는 생년월일이 될 수 없으므로 막습니다.
    //   - (2) 너무 옛날(예: 150년 초과)이면 잘못 입력한 것으로 보고 막습니다.
    // ---------------------------------------------------------------------
    if (form.birthDate) {
      const birth = new Date(form.birthDate);   // 입력한 날짜 문자열을 날짜 객체로 변환
      const today = new Date();                 // 오늘 날짜

      // 만 나이를 대략 계산 (생년월일이 올바른 범위인지 확인하는 용도)
      const ageNum = today.getFullYear() - birth.getFullYear();

      if (Number.isNaN(birth.getTime())) {
        // 날짜로 해석이 안 되는 이상한 값일 때
        errs.birthDate = "올바른 생년월일을 선택해 주세요.";
      } else if (birth > today) {
        // 미래 날짜를 골랐을 때
        errs.birthDate = "생년월일은 오늘 이후 날짜가 될 수 없습니다.";
      } else if (ageNum > 150) {
        // 150살이 넘는 비현실적인 값일 때
        errs.birthDate = "생년월일을 다시 확인해 주세요.";
      }
    }

    return errs;
  };

  const toArray = (text: string) =>
    text.split(",").map((s) => s.trim()).filter((s) => s.length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    // ---------------------------------------------------------------------
    // [변경 포인트 3] 서버로 보낼 데이터(payload) 만들기
    //   - 'age' 대신 'birthDate'를 보냅니다. (값이 있을 때만 포함)
    //   - 'medications'는 더 이상 보내지 않습니다. (관련 줄 삭제)
    // ---------------------------------------------------------------------
    const payload: RegisterPayload = {
      email: form.email, password: form.password,
      nickname: form.nickname, role, phone: form.phone.replace(/[^0-9]/g, ""),
    };
    if (form.birthDate) payload.birthDate = form.birthDate; // 예: "1955-03-12"
    if (form.gender) payload.gender = form.gender;
    payload.medical_history = toArray(form.medical_history);

    try {
      setSubmitting(true);
      await register(payload);
      setShowSuccess(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "회원가입에 실패했습니다.";
      setErrors({ global: message });
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0D9488] bg-gray-50 font-bold";
  const inputStyle = { minHeight: 56, fontSize: "1.1rem" } as const;
  const errStyle = { fontSize: "1rem" } as const;

  return (
    <>
      {showSuccess && <SuccessModal onClose={() => navigate("/login")} />}

      <div className="min-h-screen bg-linear-to-br from-[#0D9488] via-[#0F766E] to-[#0D9488] flex items-center justify-center p-4 py-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 rounded-full mb-4 backdrop-blur-sm">
              <Heart className="w-12 h-12 text-white fill-current" />
            </div>
            <h1 className="text-white font-bold" style={{ fontSize: "2.4rem" }}>회원가입</h1>
            <p className="text-white/80 mt-2" style={{ fontSize: "1.2rem" }}>HeartLink와 함께 심장 건강을 지켜요</p>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <p className="text-gray-500 mb-6 font-bold" style={{ fontSize: "1rem" }}>
              <span className="text-red-500">필수</span> 항목을 입력해 주세요.
              건강 정보(<span className="text-gray-500">선택</span>)를 입력하시면 더 정확한 분석을 받을 수 있어요.
            </p>

            <div className="mb-3">
              <FieldLabel text="회원 유형" required />
              <div className="flex gap-3">
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
            </div>

            <RoleToast role={role} />

            <form onSubmit={handleSubmit} className="space-y-5">
              {errors.global && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 font-bold" style={errStyle}>
                  {errors.global}
                </div>
              )}

              <div className="pt-1">
                <h2 className="text-[#0D9488] font-bold mb-4 pb-2 border-b-2 border-gray-100" style={{ fontSize: "1.2rem" }}>기본 정보</h2>

                {/* 전화번호 인증 (일반 가입) */}
                <PhoneVerification
                  phone={form.phone}
                  onPhoneChange={(v) => setField("phone", v)}
                  onVerifiedChange={setPhoneVerified}
                />
                {errors.phone && <p className="text-red-500 mb-3 font-bold" style={errStyle}>{errors.phone}</p>}

                <div className="mb-5">
                  <FieldLabel text="이메일 주소" required />
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                    <input type="email" placeholder="example@email.com" value={form.email}
                      onChange={(e) => setField("email", e.target.value)} className={inputClass} style={inputStyle} />
                  </div>
                  {errors.email && <p className="text-red-500 mt-1 font-bold" style={errStyle}>{errors.email}</p>}
                </div>

                <div className="mb-5">
                  <FieldLabel text="비밀번호" required />
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                    <input type={showPassword ? "text" : "password"} placeholder="8글자 이상 입력" value={form.password}
                      onChange={(e) => setField("password", e.target.value)}
                      className="w-full pl-12 pr-14 py-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0D9488] bg-gray-50 font-bold"
                      style={inputStyle} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-red-500 mt-1 font-bold" style={errStyle}>{errors.password}</p>}
                </div>

                <div className="mb-5">
                  <FieldLabel text="비밀번호 확인" required />
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                    <input type={showPassword ? "text" : "password"} placeholder="비밀번호를 다시 입력" value={form.passwordConfirm}
                      onChange={(e) => setField("passwordConfirm", e.target.value)} className={inputClass} style={inputStyle} />
                  </div>
                  {errors.passwordConfirm && <p className="text-red-500 mt-1 font-bold" style={errStyle}>{errors.passwordConfirm}</p>}
                </div>

                <div>
                  <FieldLabel text="닉네임" required />
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                    <input type="text" placeholder="사용하실 이름을 입력" value={form.nickname}
                      onChange={(e) => setField("nickname", e.target.value)} className={inputClass} style={inputStyle} />
                  </div>
                  {errors.nickname && <p className="text-red-500 mt-1 font-bold" style={errStyle}>{errors.nickname}</p>}
                </div>
              </div>

              {role === "user" && (
                <div className="pt-3">
                  <h2 className="text-[#0D9488] font-bold mb-1 pb-2 border-b-2 border-gray-100" style={{ fontSize: "1.2rem" }}>건강 정보</h2>
                  <p className="text-gray-400 mb-4 font-bold" style={{ fontSize: "0.95rem" }}>선택 입력이며, 나중에 프로필에서 추가할 수 있어요.</p>

                  {/* ----------------------------------------------------------
                      [변경 포인트 4] '나이' 입력칸을 '생년월일' 날짜 선택으로 교체
                        - 예전에는 사용자가 직접 나이(숫자)를 적었지만,
                          나이는 해마다 바뀌어 매번 고쳐야 하는 불편함이 있습니다.
                        - 그래서 절대 바뀌지 않는 '생년월일'을 받고,
                          실제 나이는 서버(DB)에서 자동으로 계산하도록 바꿨습니다.
                        - 입력기는 브라우저 기본 날짜 선택기(type="date")를 사용합니다.
                          값은 "YYYY-MM-DD" 형태(예: 1955-03-12)로 저장됩니다.
                     ---------------------------------------------------------- */}
                  <div className="mb-5">
                    <FieldLabel text="생년월일" />
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                      <input
                        type="date"
                        value={form.birthDate}
                        // max(오늘 날짜)을 지정해서 '미래 날짜'는 아예 못 고르게 막습니다.
                        max={new Date().toISOString().split("T")[0]}
                        onChange={(e) => setField("birthDate", e.target.value)}
                        className={inputClass}
                        style={inputStyle}
                      />
                    </div>
                    {errors.birthDate && <p className="text-red-500 mt-1 font-bold" style={errStyle}>{errors.birthDate}</p>}
                  </div>

                  <div className="mb-5">
                    <FieldLabel text="성별" />
                    <div className="flex gap-3">
                      <button type="button" onClick={() => setField("gender", "M")}
                        className={`flex-1 py-3 rounded-xl border-2 transition-all font-bold ${form.gender === "M" ? "border-[#0D9488] bg-[#0D9488]/10 text-[#0D9488]" : "border-gray-200 text-gray-500"}`}
                        style={{ minHeight: 56, fontSize: "1.05rem" }}>남성</button>
                      <button type="button" onClick={() => setField("gender", "F")}
                        className={`flex-1 py-3 rounded-xl border-2 transition-all font-bold ${form.gender === "F" ? "border-[#0D9488] bg-[#0D9488]/10 text-[#0D9488]" : "border-gray-200 text-gray-500"}`}
                        style={{ minHeight: 56, fontSize: "1.05rem" }}>여성</button>
                    </div>
                  </div>
                </div>
              )}

              <button type="submit" disabled={submitting}
                className="w-full py-5 bg-linear-to-r from-[#0D9488] to-[#0D9488] text-white rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                style={{ minHeight: 60, fontSize: "1.2rem" }}>
                {submitting ? "가입 처리 중..." : "회원가입"}
              </button>
            </form>

            {/* 소셜 로그인 */}
            <SocialLoginButtons role={role} />


            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <span className="text-gray-500 font-bold" style={{ fontSize: "1rem" }}>이미 회원이신가요? </span>
              <button onClick={() => navigate("/login")} className="text-[#0D9488] font-bold underline" style={{ fontSize: "1rem" }}>
                로그인
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
