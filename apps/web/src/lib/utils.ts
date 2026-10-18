import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
export const fmtDate = (s?: string | null) => s ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const fmtTime = (sec?: number | null) => { if (sec == null) return '—'; const m = Math.floor(sec / 60); const s = sec % 60; return m ? `${m}m ${s}s` : `${s}s`; };
export const QUESTION_TYPE_LABELS: Record<string, string> = {
  single_choice: 'Single choice', multiple_choice: 'Multiple choice', True_false: 'True / False',
  fill_blank: 'Fill in the blank', short_answer: 'Short answer',
};
export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft', PENDING_REVIEW: 'Pending review', APPROVED: 'Approved / Live',
  CHANGES_REQUESTED: 'Changes requested', REJECTED: 'Rejected', UNPUBLISHED: 'Unpublished', ARCHIVED: 'Archived',
};
