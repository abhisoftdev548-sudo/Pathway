import { type HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
export const Badge = ({ className, ...p }: HTMLAttributes<HTMLSpanElement>) => <span className={cn('inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700', className)} {...p} />;
export function StatusBadge({ status, isLive, hasPending }: { status: string; isLive?: boolean; hasPending?: boolean }) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-700', PENDING_REVIEW: 'bg-amber-100 text-amber-800',
    APPROVED: 'bg-emerald-100 text-emerald-800', CHANGES_REQUESTED: 'bg-orange-100 text-orange-800',
    REJECTED: 'bg-red-100 text-red-700', UNPUBLISHED: 'bg-zinc-200 text-zinc-700', ARCHIVED: 'bg-zinc-200 text-zinc-600',
  };
  const label: Record<string, string> = { DRAFT: 'Draft', PENDING_REVIEW: 'Pending review', APPROVED: 'Approved', CHANGES_REQUESTED: 'Changes requested', REJECTED: 'Rejected', UNPUBLISHED: 'Unpublished', ARCHIVED: 'Archived' };
  return <span className="inline-flex flex-wrap gap-1">
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', styles[status] || 'bg-slate-100')}>{label[status] || status}</span>
    {isLive && status !== 'APPROVED' && <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">Live version public</span>}
    {hasPending && status !== 'PENDING_REVIEW' && <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Revision pending</span>}
  </span>;
}
