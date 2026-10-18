import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNowStrict, isToday, isYesterday, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMinutes(minutes: number | null | undefined): string {
  const value = Math.max(0, Math.round(minutes ?? 0));
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  if (rest === 0) return hours === 1 ? '1 hr' : `${hours} hrs`;
  return `${hours} hr ${rest} min`;
}

export function formatHours(minutes: number | null | undefined): string {
  return `${(Math.max(0, minutes ?? 0) / 60).toFixed(1)}h`;
}

export function percent(value: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function formatDate(value: string | Date | null | undefined, pattern = 'd MMM yyyy'): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? parseISO(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, pattern);
}

export function friendlyDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) return '—';
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'd MMM yyyy');
}

export function relativeTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${formatDistanceToNowStrict(date)} ago`;
}

export function paceLabel(pace: 'relaxed' | 'standard' | 'intensive' | 'custom' | string): string {
  switch (pace) {
    case 'relaxed':
      return 'Relaxed · 20 min/day';
    case 'standard':
      return 'Standard · 45 min/day';
    case 'intensive':
      return 'Intensive · 90 min/day';
    case 'custom':
      return 'Custom pace';
    default:
      return pace;
  }
}

export const taskTypeMeta: Record<string, { label: string; description: string; tone: string }> = {
  learn: { label: 'Learn', description: 'Study a concept with references', tone: 'bg-sky-50 text-sky-700 ring-sky-200' },
  practice: {
    label: 'Practice',
    description: 'Apply the idea in a guided exercise',
    tone: 'bg-amber-50 text-amber-800 ring-amber-200',
  },
  code: { label: 'Code', description: 'Implement a working solution', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  quiz: { label: 'Quiz', description: 'Check recall with instant feedback', tone: 'bg-violet-50 text-violet-700 ring-violet-200' },
  project: { label: 'Project', description: 'Build a reviewable artifact', tone: 'bg-teal-50 text-teal-700 ring-teal-200' },
  revision: { label: 'Revision', description: 'Revisit and consolidate', tone: 'bg-slate-100 text-slate-700 ring-slate-200' },
  assessment: {
    label: 'Assessment',
    description: 'Prove the outcome without notes',
    tone: 'bg-rose-50 text-rose-700 ring-rose-200',
  },
};

export function difficultyTone(difficulty: string): string {
  switch (difficulty) {
    case 'beginner':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'intermediate':
      return 'bg-amber-50 text-amber-800 ring-amber-200';
    case 'advanced':
      return 'bg-rose-50 text-rose-700 ring-rose-200';
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
}

export function statusTone(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'paused':
      return 'bg-amber-50 text-amber-800 ring-amber-200';
    case 'completed':
      return 'bg-sky-50 text-sky-700 ring-sky-200';
    case 'archived':
      return 'bg-slate-100 text-slate-600 ring-slate-200';
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
}

export function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd');
}
