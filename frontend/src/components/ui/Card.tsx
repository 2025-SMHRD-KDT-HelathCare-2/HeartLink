// frontend/src/components/ui/Card.tsx
// ----------------------------------------------------------------------------
// 📌 Card: 둥근 모서리 + 그림자가 있는 "카드" 컨테이너.
//   화면 곳곳에서 정보를 묶어 보여줄 때 이 컴포넌트로 감싼다.
//
// 📌 사용 예
//   <Card>내용</Card>                         // 기본 카드
//   <Card padding="lg">여백 큰 카드</Card>
//   <Card variant="elevated">그림자 진한 카드</Card>
//   <Card variant="gradient">청록 그라데이션 배너</Card>
// ----------------------------------------------------------------------------
import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import { cn } from "../../utils/cn"; // 여러 className 을 안전하게 합쳐주는 유틸

// ── Card 가 받을 수 있는 props 정의 ──
// HTMLAttributes<HTMLDivElement> 를 상속하므로 onClick, style 등 div 의 모든 속성도 그대로 받는다.
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * 카드 안쪽 여백(padding) 크기.
   *   none = 여백 없음 (목록처럼 내부에서 직접 여백을 줄 때)
   *   sm   = p-4
   *   md   = p-5 (기본값)
   *   lg   = p-6
   */
  padding?: "none" | "sm" | "md" | "lg";

  /**
   * 카드 스타일(외형).
   *   plain    = 기본 흰 카드 + 옅은 그림자 (기본값)
   *   elevated = 그림자가 더 진해 떠 보이는 카드 (강조용)
   *   gradient = 청록→블루 브랜드 그라데이션 배너 (텍스트는 흰색 가정)
   */
  variant?: "plain" | "elevated" | "gradient";
}

// padding 옵션 → 실제 Tailwind 클래스 매핑
const paddings = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
} as const;

// variant 옵션 → 실제 Tailwind 클래스 매핑
// (shadow-card / shadow-card-hover / shadow-float, bg-gradient-brand 는
//  src/styles/index.css 의 @theme 와 유틸 클래스에서 정의됨)
const cardVariants = {
  plain: "bg-white border border-gray-100 shadow-card",
  elevated: "bg-white border border-gray-100 shadow-card-hover",
  // 그라데이션 배너용. 안에 들어가는 글자는 흰색이라고 가정한다.
  gradient: "bg-gradient-brand text-white shadow-float",
} as const;

// forwardRef: 부모가 이 카드의 실제 DOM 요소(ref)에 접근할 수 있게 해준다.
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ padding = "md", variant = "plain", className, children, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl",          // 공통: 둥근 모서리
          cardVariants[variant],  // 선택한 스타일(배경/그림자/테두리)
          paddings[padding],      // 선택한 내부 여백
          className               // 호출하는 쪽에서 추가로 넘긴 클래스
        )}
        {...rest} // onClick, style 등 나머지 div 속성 전달
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

// ----------------------------------------------------------------------------
// 📌 CardTitle: 카드 안에서 쓰는 작은 제목(h3).
//   기본 스타일: 청록색(text-primary) + 굵게 + text-sub(1.3rem)
//   <CardTitle>최근 측정 목록</CardTitle> 처럼 사용.
// ----------------------------------------------------------------------------
export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

export function CardTitle({ className, children, ...rest }: CardTitleProps) {
  return (
    <h3 className={cn("text-primary font-bold text-sub", className)} {...rest}>
      {children}
    </h3>
  );
}
