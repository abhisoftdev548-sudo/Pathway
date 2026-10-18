import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { api, buildQuery, type Page } from '@/lib/api';
import { qk } from '@/lib/queries';
import { PageHeading, Badge, Panel } from '@/components/ui/Primitives';
import { Select } from '@/components/ui/Field';
import { Pagination } from '@/components/ui/Table';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { StarRating } from '@/components/patterns/RatingSection';
import { formatDate, initials } from '@/lib/format';

interface FeedbackRow {
  id: string;
  content_type: 'quiz' | 'poll';
  content_id: string;
  content_title: string;
  score: number;
  review_text: string;
  status: string;
  created_at: string;
  username: string;
  display_name: string;
}

export function CreatorFeedback() {
  const [page, setPage] = useState(1);
  const [minScore, setMinScore] = useState('all');

  const path = `/creator/feedback${buildQuery({ page, pageSize: 20, minScore })}`;
  const query = useQuery<Page<FeedbackRow>>({
    queryKey: qk.creatorFeedback({ page, minScore }),
    queryFn: () => api.get(path),
    placeholderData: (prev) => prev,
  });

  const items = query.data?.items ?? [];
  const average = items.length ? items.reduce((sum, row) => sum + row.score, 0) / items.length : null;

  return (
    <>
      <PageHeading
        title="Ratings and feedback"
        description="What players said about your published quizzes and polls."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Panel title="Average rating">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums text-ink">{average ? average.toFixed(1) : '—'}</span>
            {average !== null && <StarRating value={Math.round(average)} readOnly size="sm" />}
          </div>
        </Panel>
        <Panel title="Reviews received">
          <span className="text-2xl font-semibold tabular-nums text-ink">{query.data?.total ?? 0}</span>
        </Panel>
        <Panel title="With written feedback">
          <span className="text-2xl font-semibold tabular-nums text-ink">
            {items.filter((row) => row.review_text).length}
          </span>
          <p className="mt-1 text-2xs text-ink-faint">On this page</p>
        </Panel>
      </div>

      <div className="mb-3">
        <Select
          wrapperClassName="w-48"
          aria-label="Minimum score"
          value={minScore}
          onChange={(event) => {
            setMinScore(event.target.value);
            setPage(1);
          }}
          options={[
            { value: 'all', label: 'All ratings' },
            { value: '5', label: '5 stars only' },
            { value: '4', label: '4 stars and above' },
            { value: '3', label: '3 stars and above' },
            { value: '2', label: '2 stars and above' },
            { value: '1', label: '1 star and above' },
          ]}
        />
      </div>

      {query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !items.length ? (
        <EmptyState
          icon={<Star className="h-4 w-4" />}
          title="No feedback yet"
          description="Ratings and reviews appear here once players who completed your content leave feedback."
        />
      ) : (
        <>
          <Panel bodyClassName="p-0">
            <ul className="divide-y divide-line">
              {items.map((row) => (
                <li key={row.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <a
                        href={`/app/${row.content_type === 'quiz' ? 'quizzes' : 'polls'}/${row.content_id}`}
                        className="text-[13px] font-medium text-ink hover:text-brand-700"
                      >
                        {row.content_title}
                      </a>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <StarRating value={row.score} readOnly size="sm" />
                        <span className="text-2xs text-ink-faint">
                          {row.display_name} · {formatDate(row.created_at)}
                        </span>
                        {row.status === 'hidden' && <Badge tone="danger">Hidden by moderator</Badge>}
                      </div>
                    </div>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-2xs font-semibold text-brand-700">
                      {initials(row.display_name)}
                    </span>
                  </div>
                  {row.review_text && (
                    <p className="mt-2 whitespace-pre-line rounded border border-line bg-canvas/60 px-2.5 py-2 text-[13px] leading-relaxed text-ink-soft">
                      {row.review_text}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
          {query.data && query.data.total > 0 && (
            <Pagination page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPage={setPage} />
          )}
        </>
      )}
    </>
  );
}
