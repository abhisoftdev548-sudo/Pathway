import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId++;
      setToasts((current) => [...current.slice(-3), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 6000 : 4000);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message: string) => push('success', message),
      error: (message: string) => push('error', message),
      info: (message: string) => push('info', message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role="status"
              className={cn(
                'pointer-events-auto flex items-start gap-2.5 rounded-md border bg-surface px-3 py-2.5 shadow-pop animate-slide-up',
                toast.tone === 'success' && 'border-emerald-200',
                toast.tone === 'error' && 'border-red-200',
                toast.tone === 'info' && 'border-line',
              )}
            >
              <span className="mt-0.5 shrink-0">
                {toast.tone === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                {toast.tone === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
                {toast.tone === 'info' && <Info className="h-4 w-4 text-ink-faint" />}
              </span>
              <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss"
                className="-m-1 rounded p-1 text-ink-faint transition-colors hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
