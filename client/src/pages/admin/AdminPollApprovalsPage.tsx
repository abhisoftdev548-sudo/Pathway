import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Vote } from 'lucide-react';
import endpoints, { type PollAdminDto } from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { Badge, Pagination, STATUS_LABELS, statusTone } from '@/components/ui/Data';
import { Card, CardBody, CardHeader, EmptyState, ErrorState, PageHeader, SkeletonList } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { ModerationActions } from '@/features/admin/AdminShared';
import { formatDate, formatNumber } from '@/utils/format';
import { apiErrorMessage } from '@/services/api';

/** Poll approval queue with moderation actions. */
export function AdminPollApprovalsPage() {
  useDocumentTitle('Poll approvals');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'poll-approvals', page],
    queryFn: () => endpoints.polls.moderation({ status: 'PENDING_REVIEW', page, limit: 10 }),
    placeholderData: (prev) => prev,
    refetchInterval: 30000,
  });

  const items = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div>
      <PageHeader
        title="Poll approvals"
        description="Review poll submissions: question, options, timing, anonymity, and reward configuration."
      />

      {isLoading ? (
        <SkeletonList count={3} />
      ) : isError ? (
        <ErrorState
          title="Could not load the review queue"
          description={apiErrorMessage(error)}
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Vote className="h-6 w-6" />}
          title="Review queue is clear"
          description="New poll submissions will appear here for moderation."
        />
      ) : (
        <>
          <div className="space-y-4">
            {items.map((poll: PollAdminDto) => (
              <Card key={poll._id}>
                <CardHeader
                  title={poll.title}
                  subtitle={`by ${poll.creator?.name ?? 'Unknown'} · ${formatDate(poll.updatedAt)}`}
                  actions={<Badge tone={statusTone(poll.status)}>{poll.status ? STATUS_LABELS[poll.status] : ''}</Badge>}
                />
                <CardBody>
                  <p className="text-sm font-medium text-zinc-800">{poll.question}</p>
                  {poll.description && <p className="mt-1 text-sm text-zinc-500">{poll.description}</p>}

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(poll.options ?? []).map((option) => (
                      <span key={option.id} className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600">
                        {option.text}
                      </span>
                    ))}
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-3 text-xs text-zinc-500 sm:grid-cols-4">
                    <div>
                      <dt>Voting</dt>
                      <dd className="font-medium text-zinc-800">
                        {poll.votingType === 'MULTIPLE' ? 'Multiple choice' : 'Single choice'}
                      </dd>
                    </div>
                    <div>
                      <dt>Ends</dt>
                      <dd className="font-medium text-zinc-800">{formatDate(poll.endsAt)}</dd>
                    </div>
                    <div>
                      <dt>Entry fee</dt>
                      <dd className="font-medium text-zinc-800">{formatNumber(poll.entryFee ?? 0)} QCoins</dd>
                    </div>
                    <div>
                      <dt>Reward</dt>
                      <dd className="font-medium text-zinc-800">
                        {formatNumber(poll.reward ?? 0)} QCoins ({(poll.rewardMode ?? 'ALL_PARTICIPANTS').toLowerCase().replace('_', ' ')})
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <Link to={`/polls/${poll.slug}`} className="text-xs font-medium text-brand-600 hover:text-brand-700">
                      Open participant view →
                    </Link>
                    <ModerationActions targetType="poll" targetId={poll._id} status={poll.status} onDone={() => refetch()} />
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
          {meta && (
            <div className="mt-6">
              <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default AdminPollApprovalsPage;
