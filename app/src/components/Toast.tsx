import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle, WarningCircle, X } from "@phosphor-icons/react";

// Polymarket-style trade feedback: optimistic button ladders live on the buttons;
// completions and failures land here as toasts.
interface ToastItem {
  id: number;
  kind: "success" | "error";
  title: string;
  detail?: string;
}

const Ctx = createContext<{ push: (t: Omit<ToastItem, "id">) => void } | null>(null);
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((t: Omit<ToastItem, "id">) => {
    const id = nextId++;
    setToasts((cur) => [...cur, { ...t, id }]);
    setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== id)), 6000);
  }, []);

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2" data-testid="toasts">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`bread-card flex items-start gap-2 p-3 ${
              t.kind === "success" ? "border-system-green" : "border-system-red"
            }`}
          >
            {t.kind === "success" ? (
              <CheckCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-system-green" />
            ) : (
              <WarningCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-system-red" />
            )}
            <div className="min-w-0 flex-1">
              <div className="font-bold leading-tight">{t.title}</div>
              {t.detail && <div className="mt-0.5 text-caption text-surface-grey-2">{t.detail}</div>}
            </div>
            <button
              onClick={() => setToasts((cur) => cur.filter((x) => x.id !== t.id))}
              className="shrink-0 text-surface-grey-2 hover:text-surface-ink"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast outside ToastProvider");
  return ctx;
}
