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

    (async () => {
      try {
        const data = await exchangeToken(); // 쿠키 RefreshToken → AccessToken
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
