import { Link } from 'react-router-dom';
import { Clock3, Coins, HelpCircle, Star, Users } from 'lucide-react';
import { Badge, StatusBadge } from '@/components/ui/Primitives';
import { Skeleton } from '@/components/ui/States';
import { formatCoins, formatNumber, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

export interface QuizCardData {
  id: string;
  title: string;
  summary: string;
  status: string;
  category_name: string | null;
  difficulty_name: string | null;
  entry_fee: number;
  reward_coins: number;
  question_count: number;
  total_attempts: number;
  rating_average: number | null;
  rating_count: number;
  creator_name: string;
  creator_username: string;
  published_at: string | null;
  tags: { id: string; name: string; slug: string }[];
}

export function QuizCard({ quiz, href }: { quiz: QuizCardData; href?: string }) {
  return (
    <article className="surface group flex flex-col p-4 transition-shadow hover:shadow-pop">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={href ?? `/app/quizzes/${quiz.id}`} className="block">
            <h3 className="truncate text-[14px] font-semibold text-ink group-hover:text-brand-700">{quiz.title}</h3>
          </Link>
          <p className="mt-0.5 text-xs text-ink-muted">
            {quiz.creator_name ? `@${quiz.creator_username}` : 'Unknown creator'}
            {quiz.category_name && ` · ${quiz.category_name}`}
          </p>
        </div>
        {quiz.status !== 'approved' && <StatusBadge status={quiz.status} />}
      </div>

      {quiz.summary && <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-ink-soft">{quiz.summary}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1">
          <HelpCircle className="h-3.5 w-3.5" />
          {quiz.question_count} questions
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {formatNumber(quiz.total_attempts)} attempts
        </span>
        {quiz.rating_count > 0 && (
          <span className="inline-flex items-center gap-1">
            <Star className="h-3.5 w-3.5" />
            {quiz.rating_average} ({quiz.rating_count})
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {quiz.entry_fee > 0 ? (
          <Badge tone="neutral">
            <Coins className="h-3 w-3" />
            {formatCoins(quiz.entry_fee)} entry
          </Badge>
        ) : (
          <Badge tone="success">Free</Badge>
        )}
        {quiz.reward_coins > 0 && (
          <Badge tone="brand">
            <Coins className="h-3 w-3" />
            Up to {formatCoins(quiz.reward_coins)}
          </Badge>
        )}
        {quiz.difficulty_name && <Badge tone="neutral">{quiz.difficulty_name}</Badge>}
      </div>

      {quiz.published_at && (
        <p className="mt-3 border-t border-line pt-2 text-2xs text-ink-faint">
          Published {formatRelative(quiz.published_at)}
        </p>
      )}
    </article>
  );
}

export interface PollCardData {
  id: string;
  title: string;
  summary?: string;
  status: string;
  category_name: string | null;
  vote_count: number;
  closes_at: string | null;
  isClosed?: boolean;
  creator_name: string;
  creator_username: string;
  rating_average?: number | null;
  rating_count?: number;
  published_at?: string | null;
}

export function PollCard({ poll, href }: { poll: PollCardData; href?: string }) {
  return (
    <article className="surface group flex flex-col p-4 transition-shadow hover:shadow-pop">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={href ?? `/app/polls/${poll.id}`} className="block">
            <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug text-ink group-hover:text-brand-700">
              {poll.title}
            </h3>
          </Link>
          <p className="mt-0.5 text-xs text-ink-muted">
            @{poll.creator_username}
            {poll.category_name && ` · ${poll.category_name}`}
          </p>
        </div>
        {poll.status !== 'published' ? (
          <StatusBadge status={poll.status} />
        ) : poll.isClosed ? (
          <Badge tone="neutral">Closed</Badge>
        ) : (
          <Badge tone="success">Open</Badge>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {formatNumber(poll.vote_count)} votes
        </span>
        {poll.closes_at && (
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" />
            {poll.isClosed ? 'Closed' : 'Closes'} {formatRelative(poll.closes_at)}
          </span>
        )}
      </div>

      {poll.published_at && (
        <p className="mt-3 border-t border-line pt-2 text-2xs text-ink-faint">
          Published {formatRelative(poll.published_at)}
        </p>
      )}
    </article>
  );
}

export function CardGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-3', className)}>{children}</div>;
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <CardGrid>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface space-y-3 p-4">
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-full" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      ))}
    </CardGrid>
  );
}
