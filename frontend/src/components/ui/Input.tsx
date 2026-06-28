// frontend/src/components/ui/Input.tsx
import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** 좌측 아이콘 (Mail, Lock 등) */
  leftIcon?: ReactNode;
  /** 우측 액션 (비밀번호 보기 토글 버튼 등) */
  rightSlot?: ReactNode;
  /** 에러 메시지 — 있으면 빨간 테두리 + 하단 메시지 */
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { leftIcon, rightSlot, error, className, style, ...rest },
    ref
  ) => {
    return (
      <div>
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            className={cn(
              "w-full py-4 border rounded-xl bg-gray-50 font-bold",
              "focus:outline-none focus:border-primary text-[1.1rem]",
              leftIcon ? "pl-12" : "pl-4",
              rightSlot ? "pr-14" : "pr-4",
              error ? "border-danger" : "border-gray-200",
              className
            )}
            style={{ minHeight: 56, ...style }}
            aria-invalid={!!error}
            {...rest}
          />
          {rightSlot && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2">
              {rightSlot}
            </span>
          )}
        </div>
        {error && (
          <p className="text-danger mt-1 font-bold text-small">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
