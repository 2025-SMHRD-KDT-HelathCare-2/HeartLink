// frontend/src/components/ui/Button.tsx
// ----------------------------------------------------------------------------
// 📌 Button: 앱 전체에서 쓰는 공통 버튼.
//   색상(variant), 크기(size), 아이콘, 로딩 스피너, 전체너비 등을 옵션으로 받는다.
//
// 📌 사용 예
//   <Button>확인</Button>                                  // 기본(primary)
//   <Button variant="gradient" size="lg" fullWidth>시작</Button>
//   <Button variant="outline" icon={<Icon/>}>기록 보기</Button>
//   <Button loading>저장 중...</Button>                    // 스피너 표시
// ----------------------------------------------------------------------------
import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

// 버튼 색상 종류
type Variant =
  | "primary"   // 단색 청록 (기본 주요 버튼)
  | "gradient"  // 청록→블루 그라데이션 (가장 강조하고 싶은 버튼)
  | "outline"   // 테두리만 있는 버튼 (보조 동작)
  | "selected"  // 선택된 상태 표시용 (청록 테두리 + 옅은 청록 배경)
  | "ghost"     // 배경 없는 텍스트 버튼 (가벼운 동작)
  | "danger";   // 빨강 (삭제/탈퇴 등 위험 동작)

// 버튼 크기 종류
type Size = "sm" | "md" | "lg";

// ── Button 이 받을 수 있는 props 정의 ──
// ButtonHTMLAttributes 를 상속하므로 onClick, disabled, type 등도 그대로 받는다.
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;     // 색상 종류 (기본 primary)
  size?: Size;           // 크기 (기본 md)
  fullWidth?: boolean;   // true 면 가로 100% 차지
  loading?: boolean;     // true 면 스피너 표시 + 클릭 비활성화
  icon?: ReactNode;      // 글자 왼쪽에 넣을 아이콘
  iconRight?: ReactNode; // 글자 오른쪽에 넣을 아이콘
}

// 모든 버튼이 공통으로 갖는 기본 스타일
// (가로 정렬, 굵은 글씨, 둥근 모서리, 누를 때 살짝 작아지는 효과,
//  비활성화 시 흐려짐 등)
const base =
  "inline-flex items-center justify-center gap-2 font-bold rounded-xl " +
  "transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 " +
  "disabled:cursor-not-allowed focus:outline-none";

// variant(색상) → 실제 Tailwind 클래스
// (bg-gradient-brand / shadow-float 는 index.css 의 @theme·유틸에서 정의됨)
const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-white hover:opacity-90",
  gradient:
    "bg-gradient-brand text-white hover:opacity-95 shadow-float",
  outline:
    "border-2 border-gray-200 text-gray-500 hover:bg-gray-50",
  selected:
    "border-2 border-primary bg-primary/10 text-primary",
  ghost:
    "text-gray-500 hover:text-primary hover:bg-gray-50",
  danger:
    "bg-danger text-white hover:opacity-90",
};

// size(크기) → 좌우/상하 여백과 글자 크기
const sizes: Record<Size, string> = {
  sm: "px-4 py-2 text-small",        // 작은 버튼
  md: "px-5 py-3 text-[1.05rem]",    // 일반 버튼
  lg: "px-6 py-5 text-[1.2rem]",     // 큰 버튼(로그인 등)
};

// 시니어 접근성을 위해 버튼 최소 높이(터치 영역)를 충분히 확보
const minHeights: Record<Size, number> = { sm: 40, md: 56, lg: 60 };

// forwardRef: 부모가 버튼 DOM 요소(ref)에 접근할 수 있게 해준다.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      fullWidth = false,
      loading = false,
      icon,
      iconRight,
      className,
      children,
      disabled,
      style,
      type = "button", // 폼 안에서 의도치 않은 submit 방지 위해 기본 button
      ...rest
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        // 로딩 중에는 중복 클릭을 막기 위해 비활성화
        disabled={disabled || loading}
        className={cn(
          base,
          variants[variant],
          sizes[size],
          fullWidth && "w-full",
          className
        )}
        // 최소 높이는 style 로 보장(호출 측 style 이 있으면 뒤에서 덮어쓸 수 있게 병합)
        style={{ minHeight: minHeights[size], ...style }}
        {...rest}
      >
        {/* 로딩 중이면 왼쪽 자리에 스피너, 아니면 전달받은 아이콘 표시 */}
        {loading ? (
          <span className="inline-block w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        ) : (
          icon
        )}

        {/* 버튼 글자(자식 요소) */}
        {children}

        {/* 로딩이 아닐 때만 오른쪽 아이콘 표시 */}
        {!loading && iconRight}
      </button>
    );
  }
);

Button.displayName = "Button";
