import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (kind: ToastKind, title: string, description?: string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const reduceMotion = useReducedMotion();

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (kind: ToastKind, title: string, description?: string) => {
      const id = nextId++;
      setToasts((prev) => [...prev.slice(-3), { id, kind, title, description }]);
      window.setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4500);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, description) => toast('success', title, description),
      error: (title, description) => toast('error', title, description),
      info: (title, description) => toast('info', title, description),
    }),
    [toast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
        aria-live="polite"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="surface flex items-start gap-3 p-3.5 shadow-pop"
              role="status"
            >
              <span className="mt-0.5">
                {t.kind === 'success' && <CheckCircle2 className="h-5 w-5 text-success" />}
                {t.kind === 'error' && <AlertCircle className="h-5 w-5 text-danger" />}
                {t.kind === 'info' && <Info className="h-5 w-5 text-brand-600" />}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-heading">{t.title}</p>
                {t.description && <p className="mt-0.5 text-xs text-body">{t.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="rounded p-1 text-muted hover:bg-surface-muted hover:text-body"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export default ToastContext;
