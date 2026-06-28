// frontend/src/components/ui/FieldLabel.tsx
import type { LabelHTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface FieldLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** 필수 표시(*) 노출 여부 */
  required?: boolean;
  children: ReactNode;
}

export function FieldLabel({
  required = false,
  className,
  children,
  ...rest
}: FieldLabelProps) {
  return (
    <label
      className={cn(
        "block text-gray-700 mb-2 font-bold text-[1.1rem]",
        className
      )}
      {...rest}
    >
      {children}
      {required && <span className="text-danger ml-1">*</span>}
    </label>
  );
}
