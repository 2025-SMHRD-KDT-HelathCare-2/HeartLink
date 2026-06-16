import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { exchangeToken } from "../api/authApi";
import { setAccessToken } from "../api/tokenStore";

export function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { applySession } = useAuth();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    if (params.get("error")) {
      navigate("/login?error=social", { replace: true });
      return;
    }

    // 신규 소셜 가입자 → 역할 선택 + 휴대폰 인증 화면으로
    if (params.get("needRole") === "1") {
      navigate("/social-role", { replace: true });
      return;
    }

    // 기존 회원 → 쿠키 RT로 토큰 교환 후 바로 진입
    (async () => {
      try {
        const data = await exchangeToken();
        setAccessToken(data.token);
        applySession(data.user, data.user.role);
        navigate("/dashboard", { replace: true });
      } catch {
        navigate("/login?error=social", { replace: true });
      }
    })();
  }, [params, navigate, applySession]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-600 font-bold" style={{ fontSize: "1.1rem" }}>
        로그인 처리 중입니다...
      </p>
    </div>
  );
}
