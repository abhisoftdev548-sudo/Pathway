import { Link } from 'react-router-dom';
import { Bookmark, Clock, FileQuestion, Layers, Play, Star, Timer, Users } from 'lucide-react';
import type { QuizCard as QC } from '../lib/types';
import { QUESTION_TYPE_LABELS } from '../lib/utils';
import { Badge } from './ui/badge';

export function Stars({ value, onRate, size = 16 }: { value: number; onRate?: (n: number) => void; size?: number }) {
  return <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map(n => onRate
      ? <button key={n} onClick={() => onRate(n)} aria-label={`Rate ${n} stars`} className="cursor-pointer"><Star style={{ width: size, height: size }} className={n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} /></button>
      : <Star key={n} style={{ width: size, height: size }} className={n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />)}
  </span>;
}

export default function QuizCard({ quiz, onToggleBookmark }: { quiz: QC; onToggleBookmark?: (q: QC) => void }) {
  const diffColor = quiz.difficulty === 'Advanced' ? 'bg-red-50 text-red-700' : quiz.difficulty === 'Intermediate' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700';
  return <article className="card-hover flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5">
    <div className="flex items-start justify-between gap-2">
      <div className="flex flex-wrap gap-1.5">
        {quiz.category && <Badge>{quiz.category.name}</Badge>}
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${diffColor}`}>{quiz.difficulty}</span>
      </div>
      {onToggleBookmark && <button onClick={() => onToggleBookmark(quiz)} aria-label={quiz.isBookmarked ? 'Remove bookmark' : 'Bookmark quiz'} className="rounded-lg p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600">
        <Bookmark className={`h-5 w-5 ${quiz.isBookmarked ? 'fill-brand-500 text-brand-500' : ''}`} />
      </button>}
    </div>
    <Link to={`/quizzes/${quiz.slug}`} className="mt-3 text-lg font-bold leading-snug text-navy-950 hover:text-brand-700">{quiz.title}</Link>
    <p className="mt-1 line-clamp-2 flex-1 text-sm text-slate-500">{quiz.description}</p>
    <div className="mt-3 flex flex-wrap gap-1">
      {Object.entries(quiz.questionTypes).map(([t, c]) => <span key={t} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">{c}× {QUESTION_TYPE_LABELS[t] || t}</span>)}
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
      <span className="inline-flex items-center gap-1"><FileQuestion className="h-3.5 w-3.5" />{quiz.questionCount} questions</span>
      <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />~{quiz.estimatedDuration} min</span>
      {quiz.timeLimit && <span className="inline-flex items-center gap-1"><Timer className="h-3.5 w-3.5" />Timed {quiz.timeLimit}m</span>}
      <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{quiz.attemptsCount} attempts</span>
      {quiz.ratingCount > 0 && <span className="inline-flex items-center gap-1"><Stars value={quiz.ratingAvg} size={12} />{quiz.ratingAvg} ({quiz.ratingCount})</span>}
    </div>
    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
      {quiz.creator
        ? <Link to={`/creators/${quiz.creator.id}`} className="flex items-center gap-2 text-xs font-semibold text-navy-900 hover:text-brand-700">
            <span className="flex h-7 w-7 items-center justify-center rounded-full brand-gradient text-[11px] font-bold text-white">{quiz.creator.displayName.slice(0, 1)}</span>{quiz.creator.displayName}</Link>
        : <span />}
      <Link to={`/quizzes/${quiz.slug}`} className="inline-flex items-center gap-1 text-sm font-bold text-brand-600 hover:text-brand-700"><Play className="h-4 w-4" />View quiz</Link>
    </div>
    {quiz.tags.length > 0 && <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-400"><Layers className="h-3 w-3" />{quiz.tags.join(' · ')}</div>}
  </article>;
}
