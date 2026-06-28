// frontend/src/utils/cn.ts
// 조건부 className 결합 유틸 (외부 의존성 없음).
// 사용: cn("base", isActive && "active", disabled ? "off" : "on")
export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  for (const item of inputs) {
    if (!item) continue;
    if (Array.isArray(item)) {
      const inner = cn(...item);
      if (inner) out.push(inner);
    } else {
      out.push(String(item));
    }
  }
  return out.join(" ");
}
