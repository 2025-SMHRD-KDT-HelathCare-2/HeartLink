// frontend/src/components/ui/Button.tsx
import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

type Variant = "primary" | "outline" | "selected" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  /** 좌측 아이콘 슬롯 */
  icon?: ReactNode;
  /** 우측 아이콘 슬롯 */
  iconRight?: ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 font-bold rounded-xl " +
  "transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 " +
  "disabled:cursor-not-allowed focus:outline-none";

const variants: Record<Variant, string> = {
  // 기존 로그인 버튼: 민트 그라데이션
  primary:
    "bg-gradient-to-r from-primary to-primary text-white hover:opacity-90",
  // 기존 역할 미선택 버튼
  outline:
    "border-2 border-gray-200 text-gray-500 hover:bg-gray-50",
  // 기존 역할 선택됨 버튼
  selected:
    "border-2 border-primary bg-primary/10 text-primary",
  ghost:
    "text-gray-500 hover:text-primary hover:bg-gray-50",
  danger:
    "bg-danger text-white hover:opacity-90",
};

// min-height 는 고령 사용자 접근성(터치 타겟) 유지를 위해 기존 값 보존
const sizes: Record<Size, string> = {
  sm: "px-4 py-2 text-small",        // 1rem, min 40px 근방
  md: "px-5 py-3 text-[1.05rem]",    // 역할 버튼 기준
  lg: "px-6 py-5 text-[1.2rem]",     // 로그인 버튼 기준
};

const minHeights: Record<Size, number> = { sm: 40, md: 56, lg: 60 };

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
      type = "button",
      ...rest
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          base,
          variants[variant],
          sizes[size],
          fullWidth && "w-full",
          className
        )}
        style={{ minHeight: minHeights[size], ...style }}
        {...rest}
      >
        {loading ? (
          <span className="inline-block w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        ) : (
          icon
        )}
        {children}
        {!loading && iconRight}
      </button>
    );
  }
);

Button.displayName = "Button";
