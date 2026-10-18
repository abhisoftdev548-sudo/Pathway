import { Link } from 'react-router-dom';
import { Clock, Coins, Users } from 'lucide-react';
import { Badge, RatingStars, statusTone, Badge as B } from '@/components/ui/Data';
import { STATUS_LABELS, DIFFICULTY_LABELS } from '@/utils/constants';
import { formatNumber, formatRelative } from '@/utils/format';
import type { QuizSummary } from '@/services/endpoints';

/** Shared quiz summary card (explore lists, dashboard, creator lists). */
export function QuizCard({ quiz, showStatus = false }: { quiz: QuizSummary; showStatus?: boolean }) {
  return (
    <Link to={`/quizzes/${quiz.slug}`} className="surface group flex flex-col p-5 transition-shadow hover:shadow-pop">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-zinc-900 group-hover:text-brand-700">{quiz.title}</h3>
        {showStatus && quiz.status ? (
          <B tone={statusTone(quiz.status)}>{STATUS_LABELS[quiz.status] ?? quiz.status}</B>
        ) : (
          quiz.difficulty && (
            <Badge tone={quiz.difficulty === 'HARD' ? 'danger' : quiz.difficulty === 'EASY' ? 'success' : 'info'}>
              {DIFFICULTY_LABELS[quiz.difficulty] ?? quiz.difficulty}
            </Badge>
          )
        )}
      </div>

      {quiz.description && <p className="mt-2 line-clamp-2 text-sm text-zinc-500">{quiz.description}</p>}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(quiz.tags ?? []).slice(0, 4).map((tag) => (
          <span key={tag} className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-500">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-zinc-100 pt-3 text-xs text-zinc-400">
        {quiz.creator?.name && <span>by {quiz.creator.name}</span>}
        {(quiz.stats?.attemptsCount ?? 0) > 0 && (
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {formatNumber(quiz.stats?.attemptsCount)} attempts
          </span>
        )}
        {(quiz.stats?.ratingCount ?? 0) > 0 && (
          <RatingStars value={quiz.stats?.ratingBayes ?? 0} count={quiz.stats?.ratingCount} />
        )}
        {(quiz.entryFee ?? 0) > 0 && (
          <span className="inline-flex items-center gap-1 text-amber-600">
            <Coins className="h-3.5 w-3.5" /> {quiz.entryFee} entry
          </span>
        )}
        {(quiz.reward ?? 0) > 0 && (
          <span className="inline-flex items-center gap-1 text-emerald-600">
            <Coins className="h-3.5 w-3.5" /> {quiz.reward} reward
          </span>
        )}
        {quiz.publishedAt && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {formatRelative(quiz.publishedAt)}
          </span>
        )}
      </div>
    </Link>
  );
}

export default QuizCard;
