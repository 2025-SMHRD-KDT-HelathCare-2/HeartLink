import { useState } from "react";
import { Heart, Eye, EyeOff, Lock, Mail, User, Phone, Shield } from "lucide-react";

type Role = "user" | "guardian";
type Mode = "login" | "register";

interface LoginPageProps {
  onLogin: (role: Role) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [role, setRole] = useState<Role>("user");
  const [showPassword, setShowPassword] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [locked, setLocked] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    guardianCode: "",
    agree: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
      errs.email = "올바른 이메일 주소를 입력해 주세요.";
    if (form.password.length < 8)
      errs.password = "비밀번호는 8글자 이상이어야 합니다.";
    if (mode === "register") {
      if (!form.name.trim()) errs.name = "이름을 입력해 주세요.";
      if (!form.phone.match(/^01[0-9]-?\d{4}-?\d{4}$/))
        errs.phone = "올바른 전화번호를 입력해 주세요.";
      if (!form.agree) errs.agree = "개인정보 수집·이용에 동의해 주세요.";
    }
    return errs;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) return;
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    if (mode === "login") {
      if (form.email !== "test@heartlink.kr" || form.password !== "Password1") {
        const next = failCount + 1;
        setFailCount(next);
        if (next >= 5) {
          setLocked(true);
          setTimeout(() => { setLocked(false); setFailCount(0); }, 10 * 60 * 1000);
          setErrors({ global: "로그인을 5번 틀렸습니다. 10분 후에 다시 시도해 주세요." });
        } else {
          setErrors({ global: `이메일 또는 비밀번호가 틀렸습니다. (${next}/5번)` });
        }
        return;
      }
      onLogin(role);
    } else {
      onLogin(role);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A2647] via-[#144272] to-[#0E8080] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 rounded-full mb-4 backdrop-blur-sm">
            <Heart className="w-12 h-12 text-white fill-current" />
          </div>
          <h1 className="text-white font-bold" style={{ fontSize: "2.4rem" }}>HeartLink</h1>
          <p className="text-white/80 mt-2" style={{ fontSize: "1.2rem" }}>심장 건강 모니터링 서비스</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Mode tabs */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            <button
              type="button"
              onClick={() => { setMode("login"); setErrors({}); }}
              className={`flex-1 py-3 rounded-lg transition-all font-bold ${mode === "login" ? "bg-white shadow text-[#0A2647]" : "text-gray-500 hover:text-gray-700"}`}
              style={{ minHeight: 52, fontSize: "1.1rem" }}
            >
              로그인
            </button>
            <button
              type="button"
              onClick={() => { setMode("register"); setErrors({}); }}
              className={`flex-1 py-3 rounded-lg transition-all font-bold ${mode === "register" ? "bg-white shadow text-[#0A2647]" : "text-gray-500 hover:text-gray-700"}`}
              style={{ minHeight: 52, fontSize: "1.1rem" }}
            >
              회원가입
            </button>
          </div>

          {/* Role selection */}
          <div className="flex gap-3 mb-6">
            <button
              type="button"
              onClick={() => setRole("user")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all font-bold ${role === "user" ? "border-[#0E8080] bg-[#0E8080]/10 text-[#0E8080]" : "border-gray-200 text-gray-500"}`}
              style={{ minHeight: 56, fontSize: "1.05rem" }}
            >
              <User className="w-6 h-6" />
              <span>어르신 본인</span>
            </button>
            <button
              type="button"
              onClick={() => setRole("guardian")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all font-bold ${role === "guardian" ? "border-[#0A2647] bg-[#0A2647]/10 text-[#0A2647]" : "border-gray-200 text-gray-500"}`}
              style={{ minHeight: 56, fontSize: "1.05rem" }}
            >
              <Shield className="w-6 h-6" />
              <span>가족·보호자</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {errors.global && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 font-bold" style={{ fontSize: "1rem" }}>
                {errors.global}
              </div>
            )}

            {/* Name (register only) */}
            {mode === "register" && (
              <div>
                <label className="block text-gray-700 mb-2 font-bold" style={{ fontSize: "1.1rem" }}>이름</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                  <input
                    type="text"
                    placeholder="홍길동"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0E8080] bg-gray-50 font-bold"
                    style={{ minHeight: 56, fontSize: "1.1rem" }}
                  />
                </div>
                {errors.name && <p className="text-red-500 mt-1 font-bold" style={{ fontSize: "1rem" }}>{errors.name}</p>}
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-gray-700 mb-2 font-bold" style={{ fontSize: "1.1rem" }}>이메일 주소</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                <input
                  type="email"
                  placeholder="example@email.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0E8080] bg-gray-50 font-bold"
                  style={{ minHeight: 56, fontSize: "1.1rem" }}
                />
              </div>
              {errors.email && <p className="text-red-500 mt-1 font-bold" style={{ fontSize: "1rem" }}>{errors.email}</p>}
            </div>

            {/* Phone (register only) */}
            {mode === "register" && (
              <div>
                <label className="block text-gray-700 mb-2 font-bold" style={{ fontSize: "1.1rem" }}>전화번호</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                  <input
                    type="tel"
                    placeholder="010-1234-5678"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0E8080] bg-gray-50 font-bold"
                    style={{ minHeight: 56, fontSize: "1.1rem" }}
                  />
                </div>
                {errors.phone && <p className="text-red-500 mt-1 font-bold" style={{ fontSize: "1rem" }}>{errors.phone}</p>}
              </div>
            )}

            {/* Password */}
            <div>
              <label className="block text-gray-700 mb-2 font-bold" style={{ fontSize: "1.1rem" }}>비밀번호</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="8글자 이상 입력"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full pl-12 pr-14 py-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0E8080] bg-gray-50 font-bold"
                  style={{ minHeight: 56, fontSize: "1.1rem" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 mt-1 font-bold" style={{ fontSize: "1rem" }}>{errors.password}</p>}
            </div>

            {/* Guardian code */}
            {mode === "register" && role === "guardian" && (
              <div>
                <label className="block text-gray-700 mb-2 font-bold" style={{ fontSize: "1.1rem" }}>
                  연결 코드 <span className="text-gray-400 font-normal">(선택 사항)</span>
                </label>
                <input
                  type="text"
                  placeholder="어르신에게 받은 연결 코드를 입력하세요"
                  value={form.guardianCode}
                  onChange={e => setForm({ ...form, guardianCode: e.target.value })}
                  className="w-full px-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0A2647] bg-gray-50 font-bold"
                  style={{ minHeight: 56, fontSize: "1.1rem" }}
                />
              </div>
            )}

            {/* Agreement */}
            {mode === "register" && (
              <div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.agree}
                    onChange={e => setForm({ ...form, agree: e.target.checked })}
                    className="mt-1 w-6 h-6 accent-[#0E8080]"
                  />
                  <span className="text-gray-700 leading-relaxed font-bold" style={{ fontSize: "1rem" }}>
                    개인정보 수집·이용에 동의합니다.
                    <br />
                    <span className="text-gray-500 font-normal">(심장 건강 분석을 위한 건강 정보 포함)</span>
                    <br />
                    <span className="text-[#0E8080] underline cursor-pointer font-normal">자세히 보기</span>
                  </span>
                </label>
                {errors.agree && <p className="text-red-500 mt-1 font-bold" style={{ fontSize: "1rem" }}>{errors.agree}</p>}
              </div>
            )}

            <button
              type="submit"
              disabled={locked}
              className="w-full py-5 bg-gradient-to-r from-[#0A2647] to-[#0E8080] text-white rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-bold"
              style={{ minHeight: 60, fontSize: "1.2rem" }}
            >
              {locked ? "잠금 중 (10분 후 가능)" : mode === "login" ? "로그인" : "가입하기"}
            </button>

            {mode === "login" && (
              <div className="text-center">
                <button type="button" className="text-gray-400 hover:text-[#0E8080] underline font-bold" style={{ fontSize: "1rem" }}>
                  비밀번호를 잊으셨나요?
                </button>
              </div>
            )}
          </form>

          {mode === "login" && (
            <div className="mt-5 p-4 bg-blue-50 rounded-lg font-bold" style={{ fontSize: "1rem", color: "#1d4ed8" }}>
              <strong>테스트 계정:</strong> test@heartlink.kr / Password1
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
