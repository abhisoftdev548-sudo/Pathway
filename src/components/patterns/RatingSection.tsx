import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Field';
import { Badge, Panel } from '@/components/ui/Primitives';
import { EmptyState, ErrorState, InlineError, LoadingBlock } from '@/components/ui/States';
import { api, ApiError, type Page } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { formatDate, initials } from '@/lib/format';
import { ConfirmDialog } from '@/components/ui/Dialog';

interface RatingRow {
  id: string;
  score: number;
  review_text: string;
  created_at: string;
  user_id: string;
  username: string;
  display_name: string;
}

export function StarRating({
  value,
  onChange,
  size = 'md',
  readOnly = false,
}: {
  value: number;
  onChange?: (next: number) => void;
  size?: 'sm' | 'md';
  readOnly?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  const dimension = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5';

  return (
    <div className="flex items-center gap-0.5" role={readOnly ? 'img' : 'radiogroup'} aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          aria-pressed={value === star}
          onMouseEnter={() => !readOnly && setHover(star)}
          onMouseLeave={() => !readOnly && setHover(0)}
          onClick={() => onChange?.(star)}
          className={readOnly ? 'cursor-default' : 'cursor-pointer'}
        >
          <Star
            className={`${dimension} ${
              star <= shown ? 'fill-amber-400 text-amber-400' : 'text-line-strong'
            } transition-colors`}
          />
        </button>
      ))}
    </div>
  );
}

export function RatingSection({
  contentType,
  contentId,
  canRate,
  canRateHint,
  ownerView = false,
}: {
  contentType: 'quiz' | 'poll';
  contentId: string;
  canRate: boolean;
  canRateHint?: string;
  ownerView?: boolean;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [score, setScore] = useState(0);
  const [review, setReview] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const queryKey = qk.ratings({ contentType, contentId, page: 1, pageSize: 20 });
  const query = useQuery<Page<RatingRow> & { distribution: { score: number; n: number }[] }>({
    queryKey,
    queryFn: () => api.get(`/ratings?contentType=${contentType}&contentId=${contentId}&page=1&pageSize=20`),
  });

  const existing = query.data?.items.find((r) => r.user_id === user?.id) ?? null;

  const submit = useMutation({
    mutationFn: () => api.post('/ratings', { contentType, contentId, score, reviewText: review }),
    onSuccess: () => {
      setError(null);
      toast.success(existing ? 'Your rating was updated.' : 'Thanks — your rating was recorded.');
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not save your rating.'),
  });

  const remove = useMutation({
    mutationFn: () => api.del(`/ratings/${existing?.id}`),
    onSuccess: () => {
      setConfirmRemove(false);
      toast.info('Your rating was removed.');
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not remove your rating.'),
  });

  const average = query.data?.items.length
    ? query.data.items.reduce((sum, r) => sum + r.score, 0) / query.data.items.length
    : null;

  return (
    <Panel
      title="Ratings and reviews"
      description={
        average !== null
          ? `Average ${average.toFixed(1)} from ${query.data?.total ?? 0} rating(s).`
          : 'No ratings have been left for this content yet.'
      }
    >
      {error && <InlineError message={error} className="mb-3" />}

      {canRate && !ownerView && (
        <div className="mb-5 rounded-md border border-line bg-canvas/70 p-3">
          <p className="mb-2 text-[13px] font-medium text-ink">
            {existing ? 'Your rating' : 'Rate this ' + contentType}
          </p>
          <StarRating value={score || existing?.score || 0} onChange={setScore} />
          <TextArea
            className="mt-2"
            rows={3}
            placeholder="Optional: what did you think? (max 1200 characters)"
            value={review === '' && existing ? existing.review_text : review}
            onChange={(event) => setReview(event.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="primary"
              disabled={!score && !existing}
              loading={submit.isPending}
              onClick={() => submit.mutate()}
            >
              {existing ? 'Update rating' : 'Submit rating'}
            </Button>
            {existing && (
              <Button size="sm" variant="danger" onClick={() => setConfirmRemove(true)}>
                Remove
              </Button>
            )}
          </div>
        </div>
      )}

      {!canRate && canRateHint && <p className="mb-4 text-[13px] text-ink-muted">{canRateHint}</p>}
      {ownerView && <p className="mb-4 text-[13px] text-ink-muted">You cannot rate your own content.</p>}

      {query.isLoading ? (
        <LoadingBlock rows={3} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} compact />
      ) : !query.data?.items.length ? (
        <EmptyState
          compact
          icon={<Star className="h-4 w-4" />}
          title="This content has not received any ratings yet"
          description="Ratings appear here once players who have completed the content leave feedback."
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const n = query.data?.distribution.find((d) => d.score === star)?.n ?? 0;
              const total = query.data?.total ?? 0;
              const percent = total ? Math.round((n / total) * 100) : 0;
              return (
                <div key={star} className="flex min-w-[150px] flex-1 items-center gap-2">
                  <span className="w-8 shrink-0 text-2xs text-ink-muted">{star}★</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${percent}%` }} />
                  </div>
                  <span className="w-6 shrink-0 text-right text-2xs tabular-nums text-ink-faint">{n}</span>
                </div>
              );
            })}
          </div>
          <ul className="divide-y divide-line">
            {query.data.items.map((row) => (
              <li key={row.id} className="flex gap-3 py-3 first:pt-0">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-2xs font-semibold text-brand-700">
                  {initials(row.display_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-medium text-ink">{row.display_name}</span>
                    <StarRating value={row.score} readOnly size="sm" />
                    <span className="text-2xs text-ink-faint">{formatDate(row.created_at)}</span>
                    {row.user_id === user?.id && <Badge tone="brand">You</Badge>}
                  </div>
                  {row.review_text && (
                    <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">{row.review_text}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <ConfirmDialog
        open={confirmRemove}
        title="Remove your rating?"
        description="Your score and review will be deleted. This cannot be undone."
        confirmLabel="Remove rating"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirmRemove(false)}
      />
    </Panel>
  );
}
