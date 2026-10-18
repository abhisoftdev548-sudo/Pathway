import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type Toast = { id: number; msg: string; kind: 'success' | 'error' | 'info' };
const Ctx = createContext<{ toast: (msg: string, kind?: Toast['kind']) => void }>(null as any);
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((msg: string, kind: Toast['kind'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500);
  }, []);
  const Icon = { success: CheckCircle2, error: AlertCircle, info: Info };
  return <Ctx.Provider value={{ toast }}>
    {children}
    <div className="fixed bottom-4 right-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2" role="status" aria-live="polite">
      {toasts.map(t => { const I = Icon[t.kind]; return (
        <div key={t.id} className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg ${t.kind === 'error' ? 'border-red-200 bg-red-50 text-red-800' : t.kind === 'info' ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          <I className="mt-0.5 h-4 w-4 shrink-0" /><span className="flex-1">{t.msg}</span>
          <button aria-label="Dismiss" onClick={() => setToasts(x => x.filter(y => y.id !== t.id))}><X className="h-4 w-4" /></button>
        </div>); })}
    </div>
  </Ctx.Provider>;
}
