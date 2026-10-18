import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  ClipboardList,
  EyeOff,
  FileText,
  History,
  MessageSquare,
  Star,
  Undo2,
  X,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useToast } from '@/components/ui/Toast';
import { PageHeading, Panel, Badge, StatusBadge, DetailList, Separator, Tabs } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { TextArea, Select } from '@/components/ui/Field';
import { ErrorState, FullPageLoader, EmptyState, InlineError } from '@/components/ui/States';
import { Modal, ConfirmDialog } from '@/components/ui/Dialog';
import { JsonViewer, TimestampCell } from '@/components/patterns/LogTable';
import { formatCoins, formatDate, formatDateTime, formatDuration, formatNumber, titleCase } from '@/lib/format';
import { cn } from '@/lib/cn';

interface ReviewQuestion {
  id: string;
  position: number;
  prompt: string;
  type: string;
  points: number;
  explanation: string;
  options: { id: string; position: number; body: string; isCorrect: boolean }[];
}

interface ReviewItem {
  contentType: 'quiz' | 'poll';
  id: string;
  title: string;
  summary?: string;
  description?: string;
  status: string;
  entry_fee?: number;
  reward_coins?: number;
  passing_score?: number;
  time_limit_seconds?: number | null;
  max_attempts?: number;
  version: number;
  submitted_at: string | null;
  published_at: string | null;
  review_notes: string | null;
  quality_rating: number | null;
  created_at: string;
  creator_id: string;
  creator_username: string;
  creator_name: string;
  category_name: string | null;
  difficulty_name?: string | null;
  closes_at?: string | null;
  allow_multiple?: boolean;
  is_anonymous?: boolean;
  tags?: { id: string; name: string }[];
  questions?: ReviewQuestion[];
  options?: { id: string; position: number; body: string; votes: number; percent: number }[];
  totalVotes?: number;
  rating: { count: number; average: number | null };
  history: { id: string; decision: string; reason: string | null; notes: string; quality_rating: number | null; version: number; created_at: string; reviewer_name: string | null }[];
  versions: { id: string; version: number; change_note: string; created_at: string; created_by_name: string | null }[];
  attemptStats?: { attempts: number; passes: number; average_score: number | null; fees_collected: number; rewards_paid: number } | null;
  reports: { id: string; reason: string; details: string; status: string; created_at: string; reporter: string }[];
}

type Decision = 'approve' | 'reject' | 'request-changes' | 'unpublish';

export function AdminContentReview() {
  const { id = '' } = useParams();
  const location = window.location.pathname;
  const contentType: 'quiz' | 'poll' = location.startsWith('/admin/polls') ? 'poll' : 'quiz';
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState('content');
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [quality, setQuality] = useState('');
  const [annotateOpen, setAnnotateOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const query = useQuery<{ item: ReviewItem }>({
    queryKey: contentType === 'quiz' ? qk.adminQuiz(id) : qk.adminPoll(id),
    queryFn: () => api.get(contentType === 'quiz' ? `/admin/quizzes/${id}` : `/admin/polls/${id}`),
  });

  const act = useMutation({
    mutationFn: () =>
      api.post(`/admin/${contentType === 'quiz' ? 'quizzes' : 'polls'}/${id}/${decision}`, {
        reason,
        notes,
        qualityRating: quality ? Number(quality) : null,
      }),
    onSuccess: () => {
      setConfirmOpen(false);
      setDecision(null);
      setReason('');
      setNotes('');
      setQuality('');
      queryClient.invalidateQueries();
      toast.success('Decision recorded in the moderation history.');
    },
    onError: (err) => {
      setConfirmOpen(false);
      toast.error(err instanceof ApiError ? err.message : 'Could not record the decision.');
    },
  });

  const annotate = useMutation({
    mutationFn: () =>
      api.post(`/admin/${contentType === 'quiz' ? 'quizzes' : 'polls'}/${id}/annotate`, {
        notes,
        qualityRating: quality ? Number(quality) : null,
      }),
    onSuccess: () => {
      setAnnotateOpen(false);
      setNotes('');
      queryClient.invalidateQueries();
      toast.success('Internal note and quality rating saved.');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not save the note.'),
  });

  if (query.isLoading) return <FullPageLoader />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const item = query.data!.item;
  const isQuiz = item.contentType === 'quiz';
  const decided = ['approved', 'published', 'rejected', 'changes_requested'].includes(item.status);

  const tabs = [
    { id: 'content', label: isQuiz ? 'Questions' : 'Options' },
    { id: 'history', label: 'Moderation history', count: item.history.length },
    { id: 'versions', label: 'Versions', count: item.versions.length },
    { id: 'reports', label: 'Reports', count: item.reports.length },
  ];

  return (
    <>
      <Link to={isQuiz ? '/admin/quizzes' : '/admin/polls'} className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to {isQuiz ? 'quizzes' : 'polls'}
      </Link>

      <PageHeading
        title={item.title}
        description={`${isQuiz ? 'Quiz' : 'Poll'} submitted by ${item.creator_name} (@${item.creator_username})`}
        actions={
          <>
            <Button size="sm" variant="ghost" icon={<MessageSquare className="h-3.5 w-3.5" />} onClick={() => setAnnotateOpen(true)}>
              Add note / rate
            </Button>
            {item.status === (isQuiz ? 'approved' : 'published') ? (
              <Button
                size="sm"
                variant="danger"
                icon={<EyeOff className="h-3.5 w-3.5" />}
                onClick={() => {
                  setDecision('unpublish');
                  setConfirmOpen(true);
                }}
              >
                Unpublish
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<X className="h-3.5 w-3.5" />}
                  onClick={() => {
                    setDecision('reject');
                    setConfirmOpen(true);
                  }}
                  disabled={item.status === 'rejected'}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Undo2 className="h-3.5 w-3.5" />}
                  onClick={() => {
                    setDecision('request-changes');
                    setConfirmOpen(true);
                  }}
                  disabled={item.status === 'changes_requested'}
                >
                  Request changes
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Check className="h-3.5 w-3.5" />}
                  onClick={() => {
                    setDecision('approve');
                    setConfirmOpen(true);
                  }}
                  disabled={item.status === (isQuiz ? 'approved' : 'published')}
                >
                  Approve and publish
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel bodyClassName="p-0">
            <Tabs className="px-3" tabs={tabs.map((t) => ({ ...t, count: t.count ?? null }))} active={tab} onChange={setTab} />

            <div className="p-4">
              {tab === 'content' && (
                <>
                  {item.summary && <p className="mb-3 text-[13px] text-ink-soft">{item.summary}</p>}
                  {item.description && item.description !== item.summary && (
                    <p className="mb-4 whitespace-pre-line text-[13px] leading-relaxed text-ink-muted">{item.description}</p>
                  )}

                  {isQuiz && item.questions && (
                    <ol className="space-y-3">
                      {item.questions.map((question, index) => (
                        <li key={question.id} className="rounded-md border border-line bg-canvas/40 p-3">
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-surface text-2xs font-semibold text-ink-soft ring-1 ring-line">
                              {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-[13px] font-medium text-ink">{question.prompt}</p>
                                <Badge tone="neutral">{titleCase(question.type)}</Badge>
                                <Badge tone="neutral">{question.points} pt</Badge>
                              </div>
                              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                                {question.options.map((option) => (
                                  <li
                                    key={option.id}
                                    className={cn(
                                      'rounded border px-2 py-1.5 text-[13px]',
                                      option.isCorrect
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                        : 'border-line bg-surface text-ink-soft',
                                    )}
                                  >
                                    {option.body}
                                    {option.isCorrect && <span className="ml-1.5 text-2xs font-medium">correct</span>}
                                  </li>
                                ))}
                              </ul>
                              {question.explanation && (
                                <p className="mt-2 text-xs leading-relaxed text-ink-muted">{question.explanation}</p>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}

                  {!isQuiz && item.options && (
                    <div className="space-y-2">
                      {item.options.map((option) => (
                        <div key={option.id} className="rounded-md border border-line bg-canvas/40 px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[13px] text-ink">{option.body}</span>
                            <span className="shrink-0 tabular-nums text-xs text-ink-muted">
                              {option.percent}% · {formatNumber(option.votes)}
                            </span>
                          </div>
                        </div>
                      ))}
                      <p className="pt-2 text-xs text-ink-muted">{formatNumber(item.totalVotes ?? 0)} votes cast</p>
                    </div>
                  )}

                  {isQuiz && (!item.questions || item.questions.length === 0) && (
                    <EmptyState compact icon={<FileText className="h-4 w-4" />} title="No questions in this submission" />
                  )}
                </>
              )}

              {tab === 'history' &&
                (item.history.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<ClipboardList className="h-4 w-4" />}
                    title="No moderation history yet"
                    description="Decisions, reasons and internal notes are recorded here each time a reviewer acts."
                  />
                ) : (
                  <ul className="space-y-3">
                    {item.history.map((entry) => (
                      <li key={entry.id} className="rounded-md border border-line p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={entry.decision} />
                            <Badge tone="neutral">v{entry.version}</Badge>
                            {entry.quality_rating !== null && (
                              <Badge tone="brand">
                                <Star className="h-3 w-3" />
                                {entry.quality_rating}/5
                              </Badge>
                            )}
                          </div>
                          <TimestampCell value={entry.created_at} />
                        </div>
                        {entry.reason && <p className="mt-2 text-[13px] text-ink">{entry.reason}</p>}
                        {entry.notes && <p className="mt-1 text-xs leading-relaxed text-ink-muted">{entry.notes}</p>}
                        <p className="mt-1.5 text-2xs text-ink-faint">{entry.reviewer_name ?? 'System'}</p>
                      </li>
                    ))}
                  </ul>
                ))}

              {tab === 'versions' &&
                (item.versions.length === 0 ? (
                  <EmptyState compact icon={<History className="h-4 w-4" />} title="No stored versions" />
                ) : (
                  <ul className="divide-y divide-line">
                    {item.versions.map((version) => (
                      <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge tone={version.version === item.version ? 'brand' : 'neutral'}>Version {version.version}</Badge>
                            {version.version === item.version && <span className="text-2xs text-ink-faint">current</span>}
                          </div>
                          <p className="mt-0.5 text-xs text-ink-muted">{version.change_note || 'No change note'}</p>
                          <p className="text-2xs text-ink-faint">
                            {version.created_by_name ?? 'Unknown'} · {formatDateTime(version.created_at)}
                          </p>
                        </div>
                        {version.version > 1 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            to={`/admin/${isQuiz ? 'quizzes' : 'polls'}/${item.id}?compare=${version.version - 1}`}
                          >
                            Compare with v{version.version - 1}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                ))}

              {tab === 'reports' &&
                (item.reports.length === 0 ? (
                  <EmptyState compact icon={<ClipboardList className="h-4 w-4" />} title="No reports against this content" />
                ) : (
                  <ul className="space-y-2">
                    {item.reports.map((report) => (
                      <li key={report.id} className="rounded-md border border-line p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[13px] font-medium text-ink">{report.reason}</span>
                          <StatusBadge status={report.status} />
                        </div>
                        {report.details && <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{report.details}</p>}
                        <p className="mt-1 text-2xs text-ink-faint">
                          Reported by @{report.reporter} · {formatDate(report.created_at)}
                        </p>
                      </li>
                    ))}
                  </ul>
                ))}
            </div>
          </Panel>

          {item.review_notes && (
            <Panel title="Latest reviewer notes">
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">{item.review_notes}</p>
            </Panel>
          )}
        </div>

        <div className="space-y-4">
          <Panel title="Submission">
            <DetailList
              columns={1}
              items={[
                { label: 'Status', value: <StatusBadge status={item.status} /> },
                { label: 'Version', value: `v${item.version}` },
                { label: 'Submitted', value: formatDateTime(item.submitted_at) },
                { label: 'Published', value: formatDateTime(item.published_at) },
                { label: 'Created', value: formatDateTime(item.created_at) },
                { label: 'Category', value: item.category_name ?? '—' },
                ...(isQuiz
                  ? [
                      { label: 'Difficulty', value: (item as ReviewItem).difficulty_name ?? '—' },
                      { label: 'Entry fee', value: `${formatCoins(item.entry_fee ?? 0)} QCoin` },
                      { label: 'Reward on pass', value: `${formatCoins(item.reward_coins ?? 0)} QCoin` },
                      { label: 'Passing score', value: `${item.passing_score ?? 0}%` },
                      {
                        label: 'Time limit',
                        value: item.time_limit_seconds ? formatDuration(item.time_limit_seconds) : 'No limit',
                      },
                      { label: 'Attempts allowed', value: formatNumber(item.max_attempts ?? 1) },
                    ]
                  : [
                      { label: 'Closes', value: item.closes_at ? formatDateTime(item.closes_at) : 'No closing date' },
                      { label: 'Multiple choices', value: item.allow_multiple ? 'Yes' : 'No' },
                      { label: 'Anonymous', value: item.is_anonymous ? 'Yes' : 'No' },
                    ]),
                {
                  label: 'Rating',
                  value: item.rating.count > 0 ? `${item.rating.average} (${item.rating.count})` : 'No ratings yet',
                },
                {
                  label: 'Quality rating',
                  value:
                    item.quality_rating !== null && item.quality_rating !== undefined ? (
                      <Badge tone="brand">
                        <Star className="h-3 w-3" />
                        {item.quality_rating}/5
                      </Badge>
                    ) : (
                      'Not rated'
                    ),
                },
              ]}
            />
          </Panel>

          {isQuiz && item.attemptStats && (
            <Panel title="Attempt statistics">
              <div className="space-y-2 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Attempts</span>
                  <span className="tabular-nums text-ink">{formatNumber(item.attemptStats.attempts)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Passed</span>
                  <span className="tabular-nums text-ink">{formatNumber(item.attemptStats.passes)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Average score</span>
                  <span className="tabular-nums text-ink">
                    {item.attemptStats.average_score !== null ? `${item.attemptStats.average_score}%` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Entry fees collected</span>
                  <span className="tabular-nums text-ink">{formatCoins(item.attemptStats.fees_collected)} QCoin</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Rewards paid out</span>
                  <span className="tabular-nums text-ink">{formatCoins(item.attemptStats.rewards_paid)} QCoin</span>
                </div>
              </div>
            </Panel>
          )}

          <Panel title="Creator">
            <DetailList
              columns={1}
              items={[
                { label: 'Name', value: item.creator_name },
                { label: 'Username', value: `@${item.creator_username}` },
              ]}
            />
            <Button className="mt-3" to={`/admin/users/${item.creator_id}`} size="sm" variant="secondary" block>
              Open user record
            </Button>
          </Panel>

          {isQuiz && item.tags && item.tags.length > 0 && (
            <Panel title="Tags">
              <div className="flex flex-wrap gap-1.5">
                {item.tags.map((tag) => (
                  <Badge key={tag.id} tone="neutral">
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </Panel>
          )}

          <Panel title="Audit trail">
            <JsonViewer value={{ id: item.id, contentType: item.contentType, version: item.version, status: item.status }} />
          </Panel>
        </div>
      </div>

      <Modal
        open={annotateOpen}
        onClose={() => setAnnotateOpen(false)}
        title="Internal note and quality rating"
        description="Recorded in the moderation history without changing the workflow state."
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setAnnotateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={annotate.isPending} onClick={() => annotate.mutate()}>
              Save note
            </Button>
          </>
        }
      >
        <Select
          label="Quality rating"
          value={quality}
          onChange={(event) => setQuality(event.target.value)}
          options={[
            { value: '', label: 'No rating' },
            { value: '5', label: '5 — excellent' },
            { value: '4', label: '4 — good' },
            { value: '3', label: '3 — acceptable' },
            { value: '2', label: '2 — weak' },
            { value: '1', label: '1 — poor' },
          ]}
        />
        <TextArea
          className="mt-3"
          label="Internal note"
          rows={4}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Visible to other administrators in the moderation history."
        />
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title={
          decision === 'approve'
            ? 'Approve and publish?'
            : decision === 'reject'
              ? 'Reject this submission?'
              : decision === 'request-changes'
                ? 'Request changes?'
                : 'Unpublish this content?'
        }
        description={
          decision === 'approve'
            ? 'The content becomes publicly available and players can start attempting or voting on it.'
            : decision === 'unpublish'
              ? 'It will no longer be listed. Existing attempts, votes and results are kept.'
              : 'The creator is notified with your reason and can resubmit a new version.'
        }
        confirmLabel={
          decision === 'approve'
            ? 'Approve'
            : decision === 'reject'
              ? 'Reject'
              : decision === 'request-changes'
                ? 'Request changes'
                : 'Unpublish'
        }
        tone={decision === 'approve' ? 'primary' : 'danger'}
        loading={act.isPending}
        onConfirm={() => act.mutate()}
        onCancel={() => {
          setConfirmOpen(false);
          setDecision(null);
        }}
      >
        <div className="space-y-3">
          {decision !== 'approve' && (
            <TextArea
              label="Reason"
              required
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              hint="Required. The creator sees this."
            />
          )}
          <TextArea
            label={decision === 'approve' ? 'Notes (optional)' : 'Additional notes (optional)'}
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            hint="Internal notes are visible to administrators."
          />
          <Select
            label="Quality rating"
            value={quality}
            onChange={(event) => setQuality(event.target.value)}
            options={[
              { value: '', label: 'No rating' },
              { value: '5', label: '5 — excellent' },
              { value: '4', label: '4 — good' },
              { value: '3', label: '3 — acceptable' },
              { value: '2', label: '2 — weak' },
              { value: '1', label: '1 — poor' },
            ]}
          />
          {decision !== 'approve' && reason.trim().length < 5 && (
            <InlineError message="A reason of at least 5 characters is required." />
          )}
        </div>
      </ConfirmDialog>
    </>
  );
}

export { Separator };
