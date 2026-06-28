// frontend/src/components/ui/Card.tsx
import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import { cn } from "../../utils/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** 내부 여백. 기존 차트 카드는 'md'(p-5), 일부는 'lg'(p-6) 사용 */
  padding?: "none" | "sm" | "md" | "lg";
}

const paddings = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
} as const;

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ padding = "md", className, children, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-white rounded-2xl shadow-sm border border-gray-100",
          paddings[padding],
          className
        )}
        {...rest}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

/** 카드 내부의 제목 (기존 차트 h3: text-primary font-bold, 1.2~1.3rem) */
export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

export function CardTitle({ className, children, ...rest }: CardTitleProps) {
  return (
    <h3
      className={cn("text-primary font-bold text-sub", className)}
      {...rest}
    >
      {children}
    </h3>
  );
}
