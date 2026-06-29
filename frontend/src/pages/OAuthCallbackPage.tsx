// OAuthCallbackPage.tsx

// ============================================================================
// 소셜 로그인 콜백 처리 페이지 (토큰 교환 / 신규는 역할 선택으로 분기)
// - 디자인 리뉴얼: 로딩 화면을 브랜드 그라데이션 배경 + 스피너로 통일
//   (로직은 일절 변경 없음 — 토큰 교환/분기/세션 적용 그대로 유지)
// ============================================================================
import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { exchangeToken } from "../api/authApi";
import { setAccessToken } from "../api/tokenStore";
import { GRADIENTS } from "../styles/tokens";

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
        navigate("/", { replace: true });
      } catch {
        navigate("/login?error=social", { replace: true });
      }
    })();
  }, [params, navigate, applySession]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-5"
      style={{ background: GRADIENTS.brand }}
    >
      {/* 흰색 스피너 */}
      <div
        className="w-10 h-10 rounded-full border-4 border-white/30 border-t-white animate-spin"
        aria-hidden="true"
      />
      <p className="text-white font-bold text-lg">
        로그인 처리 중입니다...
      </p>
    </div>
  );
}
