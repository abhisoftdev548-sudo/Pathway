import { Link } from 'react-router-dom';
import { Coins, Vote } from 'lucide-react';
import { Badge, statusTone } from '@/components/ui/Data';
import { STATUS_LABELS } from '@/utils/constants';
import { timeUntil } from '@/utils/format';
import type { PollSummary } from '@/services/endpoints';

/** Shared poll summary card. */
export function PollCard({ poll, showStatus = false }: { poll: PollSummary; showStatus?: boolean }) {
  return (
    <Link to={`/polls/${poll.slug}`} className="surface group flex flex-col p-5 transition-shadow hover:shadow-pop">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-heading group-hover:text-brand-700">{poll.title}</h3>
        {showStatus && poll.status ? (
          <Badge tone={statusTone(poll.status)}>{STATUS_LABELS[poll.status] ?? poll.status}</Badge>
        ) : (
          <Vote className="h-5 w-5 shrink-0 text-muted" />
        )}
      </div>
      {poll.question && <p className="mt-2 line-clamp-2 text-sm text-body">{poll.question}</p>}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(poll.tags ?? []).slice(0, 4).map((tag) => (
          <span key={tag} className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[11px] text-body">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3 text-xs text-muted">
        {poll.creator?.name && <span>by {poll.creator.name}</span>}
        <span>{timeUntil(poll.endsAt)}</span>
        {(poll.stats?.uniqueVoters ?? 0) > 0 && <span>{poll.stats?.uniqueVoters} voters</span>}
        {(poll.entryFee ?? 0) > 0 && (
          <span className="inline-flex items-center gap-1 text-warning">
            <Coins className="h-3.5 w-3.5" /> {poll.entryFee} entry
          </span>
        )}
        {(poll.reward ?? 0) > 0 && (
          <span className="inline-flex items-center gap-1 text-success">
            <Coins className="h-3.5 w-3.5" /> {poll.reward} reward
          </span>
        )}
      </div>
    </Link>
  );
}

export default PollCard;
