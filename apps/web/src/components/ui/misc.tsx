import { type ReactNode } from 'react';
import { cn } from '../../lib/utils';
export const Skeleton = ({ className }: { className?: string }) => <div className={cn('animate-pulse rounded-xl bg-slate-200/80', className)} />;
export const Progress = ({ value, className }: { value: number; className?: string }) => (
  <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-200', className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
    <div className="h-full rounded-full brand-gradient transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
  </div>
);
export function EmptyState({ icon, title, description, children }: { icon?: ReactNode; title: string; description?: string; children?: ReactNode }) {
  return <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
    {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">{icon}</div>}
    <h3 className="text-base font-bold text-navy-950">{title}</h3>
    {description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}
    {children && <div className="mt-4">{children}</div>}
  </div>;
}
export function Dialog({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-[90] flex items-end justify-center bg-navy-950/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal={true} aria-label={title} onClick={onClose}>
    <div className={cn('max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')} onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-bold text-navy-950">{title}</h2>
        <button onClick={onClose} aria-label="Close dialog" className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">✕</button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  </div>;
}
