import { startSocialLogin } from "../../api/authApi";

type Role = "user" | "guardian";
type Provider = "google" | "naver" | "kakao";

const providers: {
  id: Provider;
  label: string;
  bg: string;
  color: string;
  border: string;
  disabled?: boolean; // 준비 중(비활성화) 여부
}[] = [
  {
    id: "google",
    label: "Google로 시작하기",
    bg: "#FFFFFF",
    color: "#1F1F1F",
    border: "#DADCE0",
  },
  {
    id: "naver",
    label: "네이버로 시작하기 (준비 중)",
    bg: "#03C75A",
    color: "#FFFFFF",
    border: "#03C75A",
    disabled: true,
  },
  {
    id: "kakao",
    label: "카카오로 시작하기 (준비 중)",
    bg: "#FEE500",
    color: "#191600",
    border: "#FEE500",
    disabled: true,
  },
];

export function SocialLoginButtons({ role }: { role: Role }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 my-2">
        <div className="flex-1 h-px bg-gray-200" />
        <span
          className="text-gray-400 font-bold"
          style={{ fontSize: "0.95rem" }}
        >
          또는
        </span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {providers.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled={p.disabled}
          onClick={() => {
            if (p.disabled) return; // 비활성화된 버튼은 아무 동작 안 함
            startSocialLogin(p.id, role);
          }}
          className={`w-full flex items-center justify-center gap-2 rounded-xl border-2 font-bold transition-all ${
            p.disabled
              ? "cursor-not-allowed opacity-60"
              : "hover:opacity-90 active:scale-95"
          }`}
          style={{
            minHeight: 56,
            fontSize: "1.05rem",
            // 비활성화 시: 회색 처리 / 활성화 시: 원래 색상
            backgroundColor: p.disabled ? "#E5E7EB" : p.bg,
            color: p.disabled ? "#9CA3AF" : p.color,
            borderColor: p.disabled ? "#E5E7EB" : p.border,
          }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
