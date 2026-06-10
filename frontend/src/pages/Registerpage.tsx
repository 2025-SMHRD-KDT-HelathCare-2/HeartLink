import { useState } from "react";
import {
  Heart,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  Shield,
  UserCircle,
  ListChecks,
} from "lucide-react";
import { register, type RegisterPayload } from "../api/authApi";

type Role = "user" | "guardian";

interface RegisterPageProps {
  onRegister: (role: Role) => void;
  onGoLogin: () => void;
}

// 필수/선택 라벨 컴포넌트
function FieldLabel({
  text,
  required,
}: {
  text: string;
  required?: boolean;
}) {
  return (
    <label
      className="flex items-center gap-2 text-gray-700 mb-2 font-bold"
      style={{ fontSize: "1.1rem" }}
    >
      {text}
      {required ? (
        <span
          className="px-2 py-0.5 rounded-md bg-red-100 text-red-600 font-bold"
          style={{ fontSize: "0.8rem" }}
        >
          필수
        </span>
      ) : (
        <span
          className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 font-bold"
          style={{ fontSize: "0.8rem" }}
        >
          선택
        </span>
      )}
    </label>
  );
}

export function RegisterPage({ onRegister, onGoLogin }: RegisterPageProps) {
  const [role, setRole] = useState<Role>("user");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    email: "",
    password: "",
    passwordConfirm: "",
    nickname: "",
    age: "",
    gender: "" as "" | "M" | "F",
    // 쉼표로 구분해 입력받고 전송 시 배열로 변환
    medical_history: "",
    medications: "",
  });

  const setField = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const validate = () => {
    const errs: Record<string, string> = {};

    // 필수(NN) 항목 검증
    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
      errs.email = "올바른 이메일 주소를 입력해 주세요.";
    if (form.password.length < 8)
      errs.password = "비밀번호는 8글자 이상이어야 합니다.";
    if (form.password !== form.passwordConfirm)
      errs.passwordConfirm = "비밀번호가 일치하지 않습니다.";
    if (!form.nickname.trim()) errs.nickname = "닉네임을 입력해 주세요.";

    // 선택 항목이라도 값이 있으면 형식 검증
    if (form.age) {
      const ageNum = Number(form.age);
      if (!Number.isInteger(ageNum) || ageNum < 0 || ageNum > 150)
        errs.age = "올바른 나이를 입력해 주세요.";
    }

    return errs;
  };

  // "고혈압, 당뇨" 같은 문자열을 ["고혈압", "당뇨"] 배열로 변환
  const toArray = (text: string) =>
    text
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    // 필수 항목 + 입력된 선택 항목만 담아 전송
    const payload: RegisterPayload = {
      email: form.email,
      password: form.password,
      nickname: form.nickname,
      role,
    };

    if (form.age) payload.age = Number(form.age);
    if (form.gender) payload.gender = form.gender;
    payload.medical_history = toArray(form.medical_history);
    payload.medications = toArray(form.medications);

    try {
      setSubmitting(true);
      await register(payload);
      // 가입 완료 후 상위 컴포넌트에 role 전달 (App.tsx에서 화면 전환)
      onRegister(role);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "회원가입에 실패했습니다.";
      setErrors({ global: message });
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0E8080] bg-gray-50 font-bold";
  const inputStyle = { minHeight: 56, fontSize: "1.1rem" } as const;
  const errStyle = { fontSize: "1rem" } as const;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A2647] via-[#144272] to-[#0E8080] flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-md">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 rounded-full mb-4 backdrop-blur-sm">
            <Heart className="w-12 h-12 text-white fill-current" />
          </div>
          <h1 className="text-white font-bold" style={{ fontSize: "2.4rem" }}>
            회원가입
          </h1>
          <p className="text-white/80 mt-2" style={{ fontSize: "1.2rem" }}>
            HeartLink와 함께 심장 건강을 지켜요
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* 안내 문구 */}
          <p
            className="text-gray-500 mb-6 font-bold"
            style={{ fontSize: "1rem" }}
          >
            <span className="text-red-500">필수</span> 항목을 입력해 주세요.
            건강 정보(<span className="text-gray-500">선택</span>)를 입력하시면
            더 정확한 분석을 받을 수 있어요.
          </p>

          {/* 회원 유형 선택 (필수) */}
          <div className="mb-6">
            <FieldLabel text="회원 유형" required />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRole("user")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all font-bold ${role === "user"
                    ? "border-[#0E8080] bg-[#0E8080]/10 text-[#0E8080]"
                    : "border-gray-200 text-gray-500"
                  }`}
                style={{ minHeight: 56, fontSize: "1.05rem" }}
              >
                <User className="w-6 h-6" />
                어르신 본인
              </button>
              <button
                type="button"
                onClick={() => setRole("guardian")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all font-bold ${role === "guardian"
                    ? "border-[#0A2647] bg-[#0A2647]/10 text-[#0A2647]"
                    : "border-gray-200 text-gray-500"
                  }`}
                style={{ minHeight: 56, fontSize: "1.05rem" }}
              >
                <Shield className="w-6 h-6" />
                가족·보호자
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {errors.global && (
              <div
                className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 font-bold"
                style={errStyle}
              >
                {errors.global}
              </div>
            )}

            {/* ===== 필수 정보 ===== */}
            <div className="pt-1">
              <h2
                className="text-[#0A2647] font-bold mb-4 pb-2 border-b-2 border-gray-100"
                style={{ fontSize: "1.2rem" }}
              >
                기본 정보
              </h2>

              {/* 이메일 (필수) */}
              <div className="mb-5">
                <FieldLabel text="이메일 주소" required />
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                  <input
                    type="email"
                    placeholder="example@email.com"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                {errors.email && (
                  <p className="text-red-500 mt-1 font-bold" style={errStyle}>
                    {errors.email}
                  </p>
                )}
              </div>

              {/* 비밀번호 (필수) */}
              <div className="mb-5">
                <FieldLabel text="비밀번호" required />
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="8글자 이상 입력"
                    value={form.password}
                    onChange={(e) => setField("password", e.target.value)}
                    className="w-full pl-12 pr-14 py-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0E8080] bg-gray-50 font-bold"
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="w-6 h-6" />
                    ) : (
                      <Eye className="w-6 h-6" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 mt-1 font-bold" style={errStyle}>
                    {errors.password}
                  </p>
                )}
              </div>

              {/* 비밀번호 확인 (필수) */}
              <div className="mb-5">
                <FieldLabel text="비밀번호 확인" required />
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="비밀번호를 다시 입력"
                    value={form.passwordConfirm}
                    onChange={(e) =>
                      setField("passwordConfirm", e.target.value)
                    }
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                {errors.passwordConfirm && (
                  <p className="text-red-500 mt-1 font-bold" style={errStyle}>
                    {errors.passwordConfirm}
                  </p>
                )}
              </div>

              {/* 닉네임 (필수) */}
              <div>
                <FieldLabel text="닉네임" required />
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                  <input
                    type="text"
                    placeholder="사용하실 이름을 입력"
                    value={form.nickname}
                    onChange={(e) => setField("nickname", e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                {errors.nickname && (
                  <p className="text-red-500 mt-1 font-bold" style={errStyle}>
                    {errors.nickname}
                  </p>
                )}
              </div>
            </div>

            {/* ===== 선택 정보 (건강 정보) ===== */}
            <div className="pt-3">
              <h2
                className="text-[#0A2647] font-bold mb-1 pb-2 border-b-2 border-gray-100"
                style={{ fontSize: "1.2rem" }}
              >
                건강 정보
              </h2>
              <p
                className="text-gray-400 mb-4 font-bold"
                style={{ fontSize: "0.95rem" }}
              >
                선택 입력이며, 나중에 프로필에서 추가할 수 있어요.
              </p>

              {/* 나이 (선택) */}
              <div className="mb-5">
                <FieldLabel text="나이" />
                <div className="relative">
                  <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                  <input
                    type="number"
                    min={0}
                    max={150}
                    placeholder="예: 68"
                    value={form.age}
                    onChange={(e) => setField("age", e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                {errors.age && (
                  <p className="text-red-500 mt-1 font-bold" style={errStyle}>
                    {errors.age}
                  </p>
                )}
              </div>

              {/* 성별 (선택) */}
              <div className="mb-5">
                <FieldLabel text="성별" />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setField("gender", "M")}
                    className={`flex-1 py-3 rounded-xl border-2 transition-all font-bold ${form.gender === "M"
                        ? "border-[#0E8080] bg-[#0E8080]/10 text-[#0E8080]"
                        : "border-gray-200 text-gray-500"
                      }`}
                    style={{ minHeight: 56, fontSize: "1.05rem" }}
                  >
                    남성
                  </button>
                  <button
                    type="button"
                    onClick={() => setField("gender", "F")}
                    className={`flex-1 py-3 rounded-xl border-2 transition-all font-bold ${form.gender === "F"
                        ? "border-[#0E8080] bg-[#0E8080]/10 text-[#0E8080]"
                        : "border-gray-200 text-gray-500"
                      }`}
                    style={{ minHeight: 56, fontSize: "1.05rem" }}
                  >
                    여성
                  </button>
                </div>
              </div>

              {/* 기저질환 (선택) */}
              <div className="mb-5">
                <FieldLabel text="기저질환" />
                <div className="relative">
                  <ListChecks className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                  <input
                    type="text"
                    placeholder="예: 고혈압, 당뇨 (쉼표로 구분)"
                    value={form.medical_history}
                    onChange={(e) =>
                      setField("medical_history", e.target.value)
                    }
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                <p className="text-gray-400 mt-1 font-bold" style={errStyle}>
                  여러 개는 쉼표(,)로 구분해 주세요.
                </p>
              </div>

              {/* 복용약 (선택) */}
              <div>
                <FieldLabel text="복용 중인 약" />
                <div className="relative">
                  <ListChecks className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                  <input
                    type="text"
                    placeholder="예: 아스피린, 메트포르민 (쉼표로 구분)"
                    value={form.medications}
                    onChange={(e) => setField("medications", e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                <p className="text-gray-400 mt-1 font-bold" style={errStyle}>
                  여러 개는 쉼표(,)로 구분해 주세요.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-5 bg-gradient-to-r from-[#0A2647] to-[#0E8080] text-white rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-bold"
              style={{ minHeight: 60, fontSize: "1.2rem" }}
            >
              {submitting ? "가입 처리 중..." : "회원가입"}
            </button>
          </form>

          {/* 로그인 이동 */}
          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <span
              className="text-gray-500 font-bold"
              style={{ fontSize: "1rem" }}
            >
              이미 회원이신가요?{" "}
            </span>
            <button
              onClick={onGoLogin}
              className="text-[#0E8080] font-bold underline"
              style={{ fontSize: "1rem" }}
            >
              로그인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
