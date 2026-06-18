import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { AlertTriangle, AlertCircle, Info, CheckCircle2, X } from "lucide-react";

type ToastLevel = "상" | "중" | "하" | "info" | "success";

interface ToastData {
  id: number;
  level: ToastLevel;
  title: string;
  message: string;
}

interface ToastContextType {
  showToast: (toast: Omit<ToastData, "id">) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const LEVEL_META: Record<ToastLevel, { color: string; bg: string; icon: React.ElementType }> = {
  상:       { color: "#DC2626", bg: "#FEF2F2", icon: AlertTriangle },
  중:       { color: "#D97706", bg: "#FFFBEB", icon: AlertCircle },
  하:       { color: "#16A34A", bg: "#F0FDF4", icon: Info },
  info:     { color: "#0A2647", bg: "#EFF6FF", icon: Info },
  success:  { color: "#16A34A", bg: "#F0FDF4", icon: CheckCircle2 },
};

function ToastItem({ toast, onClose }: { toast: ToastData; onClose: () => void }) {
  const meta = LEVEL_META[toast.level];
  const Icon = meta.icon;
  const [leaving, setLeaving] = useState(false);

  const handleClose = () => {
    setLeaving(true);
    setTimeout(onClose, 350);
  };

  return (
    <div
      className={`pointer-events-auto w-full max-w-md rounded-2xl shadow-2xl border-2 px-5 py-4 flex items-start gap-3 transition-all duration-350 ${
        leaving ? "opacity-0 -translate-y-4" : "opacity-100 translate-y-0 toast-enter"
      }`}
      style={{ backgroundColor: meta.bg, borderColor: meta.color }}
    >
      <Icon className="w-7 h-7 flex-shrink-0 mt-0.5" style={{ color: meta.color }} />
      <div className="flex-1">
        <p className="font-black" style={{ color: meta.color, fontSize: "1.1rem" }}>{toast.title}</p>
        <p className="text-gray-700 font-bold mt-0.5" style={{ fontSize: "0.95rem", whiteSpace: "pre-line", lineHeight: 1.5 }}>{toast.message}</p>
      </div>
      <button onClick={handleClose} className="p-1 rounded-lg hover:bg-black/5 flex-shrink-0">
        <X className="w-5 h-5 text-gray-400" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = useCallback((toast: Omit<ToastData, "id">) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { ...toast, id }]);
    // 5초 후 자동 제거
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = (id: number) =>
    setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* 토스트 컨테이너 - 상단 중앙 */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-3 px-4 w-full pointer-events-none">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>

      <style>{`
        @keyframes toastSlideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .toast-enter { animation: toastSlideDown 0.35s ease-out; }
        .duration-350 { transition-duration: 350ms; }
      `}</style>
    </ToastContext.Provider>
  );
}