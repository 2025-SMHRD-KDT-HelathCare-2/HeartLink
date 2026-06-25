import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, Lock, Eye, EyeOff, Heart } from "lucide-react";
import api from "../api/authApi";
import { useToast } from "../context/ToastContext";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  const email = (location.state as any)?.email;
  const code = (location.state as any)?.code;

  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 이메일/인증 정보 없이 직접 접근한 경우 방어
  if (!email || !code) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0D9488] via-[#0F766E] to-[#0D9488] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <p className="text-gray-600 font-bold mb-5" style={{ fontSize: "1.1rem" }}>
            잘못된 접근입니다. 비밀번호 찾기를 다시 시도해 주세요.
          </p>
          <button onClick={() => navigate("/forgot-password")}
            className="w-full py-4 bg-[#0D9488] text-white rounded-xl font-bold"
            style={{ fontSize: "1.1rem" }}>
            비밀번호 찾기로 이동
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("비밀번호는 8글자 이상이어야 합니다.");
      return;
    }
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setError("");
    setSubmitting(true);

    try {
      await api.post("/auth/password/reset", { email, code, newPassword: password });
      showToast({
        level: "success",
        title: "비밀번호 변경 완료",
        message: "비밀번호가 변경됐습니다.",
      });
      navigate("/login");
    } catch (err: any) {
      const message = err?.response?.data?.message ?? "비밀번호 변경에 실패했습니다.";
      setError(message);
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
          <h1 className="text-white font-bold" style={{ fontSize: "2.4rem" }}>HeartLink</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <button onClick={() => navigate("/login")}
            className="flex items-center gap-2 text-gray-400 hover:text-gray-600 mb-6 font-bold"
            style={{ fontSize: "1rem" }}>
            <ChevronLeft className="w-5 h-5" />로그인으로 돌아가기
          </button>

          <h2 className="text-[#0D9488] font-black mb-2" style={{ fontSize: "1.6rem" }}>새 비밀번호 설정</h2>
          <p className="text-gray-500 mb-6 font-bold" style={{ fontSize: "1.05rem" }}>
            새로 사용할 비밀번호를 입력해 주세요.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-gray-700 mb-2 font-bold" style={{ fontSize: "1.1rem" }}>새 비밀번호</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                <input type={showPassword ? "text" : "password"} placeholder="8글자 이상 입력" value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  className="w-full pl-12 pr-14 py-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0D9488] bg-gray-50 font-bold"
                  style={{ minHeight: 56, fontSize: "1.1rem" }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-gray-700 mb-2 font-bold" style={{ fontSize: "1.1rem" }}>새 비밀번호 확인</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                <input type={showPassword ? "text" : "password"} placeholder="비밀번호를 다시 입력" value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setError(""); }}
                  className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0D9488] bg-gray-50 font-bold"
                  style={{ minHeight: 56, fontSize: "1.1rem" }} />
              </div>
              {error && <p className="text-red-500 mt-1 font-bold" style={{ fontSize: "1rem" }}>{error}</p>}
            </div>

            <button type="submit" disabled={submitting}
              className="w-full py-5 bg-gradient-to-r from-[#0D9488] to-[#0D9488] text-white rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 font-bold"
              style={{ minHeight: 60, fontSize: "1.2rem" }}>
              {submitting ? "변경 중..." : "비밀번호 변경하기"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
