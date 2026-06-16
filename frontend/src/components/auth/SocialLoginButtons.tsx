import { startSocialLogin } from "../../api/authApi";

const providers = [
  { id: "google", label: "Google로 시작하기", bg: "#FFFFFF", color: "#1F1F1F", border: "#DADCE0" },
  { id: "naver",  label: "네이버로 시작하기",  bg: "#03C75A", color: "#FFFFFF", border: "#03C75A" },
  { id: "kakao",  label: "카카오로 시작하기",  bg: "#FEE500", color: "#191600", border: "#FEE500" },
] as const;

export function SocialLoginButtons() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 my-2">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-gray-400 font-bold" style={{ fontSize: "0.95rem" }}>또는</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {providers.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => startSocialLogin(p.id)}
          className="w-full flex items-center justify-center gap-2 rounded-xl border-2 font-bold transition-all hover:opacity-90 active:scale-95"
          style={{
            minHeight: 56,
            fontSize: "1.05rem",
            backgroundColor: p.bg,
            color: p.color,
            borderColor: p.border,
          }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
