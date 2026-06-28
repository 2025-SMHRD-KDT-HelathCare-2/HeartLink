import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { login as loginApi } from "../api/authApi";
import { SocialLoginButtons } from "../components/auth/SocialLoginButtons";
import { Button, Input, FieldLabel } from "../components/ui";
import { Heart, Eye, EyeOff, Lock, Mail, User, Shield } from "lucide-react";

type Role = "user" | "guardian";

function RoleToast({ role }: { role: Role }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);
  const [displayRole, setDisplayRole] = useState<Role>(role);

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
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border font-bold mb-4 transition-all duration-500 bg-primary/10 border-primary/30 text-primary ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
      }`}
      style={{ fontSize: "0.95rem", minHeight: "3.5rem" }}
    >
      <span style={{ wordBreak: "keep-all", lineHeight: "1.8", whiteSpace: "pre-line" }}>
        {isUser
          ? "측정하는 본인의 페이지입니다.\n잘 모르실 경우,\n보호자와 함께 진행해 주세요."
          : "측정 결과를 지켜볼 수 있는 보호자 계정입니다."}
      </span>
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [role, setRole] = useState<Role>("user");
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
      errs.email = "올바른 이메일 주소를 입력해 주세요.";
    if (form.password.length < 8)
      errs.password = "비밀번호는 8글자 이상이어야 합니다.";
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      setSubmitting(true);
      const data = await loginApi({ email: form.email, password: form.password });
      const resolvedRole: Role = data.user?.role ?? data.role;

      if (resolvedRole !== role) {
        const opposite = resolvedRole === "guardian" ? "보호자" : "사용자";
        setErrors({ global: `혹시 ${opposite}로 가입하셨나요? 위에서 ${opposite} 버튼을 선택해 주세요.` });
        return;
      }

      login({ email: form.email, role: resolvedRole }, resolvedRole, data.token);
      navigate("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "로그인에 실패했습니다.";
      setErrors({ global: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary-mid to-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 rounded-full mb-4 backdrop-blur-sm">
            <Heart className="w-12 h-12 text-white fill-current" />
          </div>
          <h1 className="text-white font-bold text-hero">HeartLink</h1>
          <p className="text-white/80 mt-2 text-body">심장 건강 모니터링 서비스</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex gap-3 mb-3">
            <Button
              variant={role === "user" ? "selected" : "outline"}
              size="md"
              fullWidth
              icon={<User className="w-6 h-6" />}
              onClick={() => setRole("user")}
            >
              사용자
            </Button>
            <Button
              variant={role === "guardian" ? "selected" : "outline"}
              size="md"
              fullWidth
              icon={<Shield className="w-6 h-6" />}
              onClick={() => setRole("guardian")}
            >
              가족·보호자
            </Button>
          </div>

          <RoleToast role={role} />

          <form onSubmit={handleSubmit} className="space-y-5">
            {errors.global && (
              <div className="bg-amber-50 border border-amber-300 text-amber-800 rounded-lg p-4 font-bold text-small">
                {errors.global}
              </div>
            )}

            <div>
              <FieldLabel htmlFor="login-email">이메일 주소</FieldLabel>
              <Input
                id="login-email"
                type="email"
                placeholder="example@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                leftIcon={<Mail className="w-6 h-6" />}
                error={errors.email}
              />
            </div>

            <div>
              <FieldLabel htmlFor="login-password">비밀번호</FieldLabel>
              <Input
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder="8글자 이상 입력"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                leftIcon={<Lock className="w-6 h-6" />}
                error={errors.password}
                rightSlot={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
                  </button>
                }
              />
            </div>

            <Button type="submit" variant="primary" size="lg" fullWidth loading={submitting}>
              {submitting ? "로그인 중..." : "로그인"}
            </Button>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/find-id")}
                className="text-gray-400 hover:text-primary underline font-bold text-small"
              >
                아이디 찾기
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                className="text-gray-400 hover:text-primary underline font-bold text-small"
              >
                비밀번호 찾기
              </button>
            </div>
          </form>

          <div className="mt-4">
            <SocialLoginButtons role={role} />
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <span className="text-gray-500 font-bold text-small">아직 회원이 아니신가요? </span>
            <button
              onClick={() => navigate("/signup")}
              className="text-primary font-bold underline text-small"
            >
              회원가입
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
