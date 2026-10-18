import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, LifeBuoy, MessageSquareQuote, ShieldQuestion } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useBootstrap } from '@/lib/bootstrap';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { PageHeading, Panel, Badge, StatusBadge } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { TextInput, TextArea, Select } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/States';
import { formatDate } from '@/lib/format';

interface MyReport {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  status: string;
  resolution: string;
  created_at: string;
}

interface MyAppeal {
  id: string;
  content_type: string;
  content_id: string;
  reason: string;
  status: string;
  resolution: string;
  created_at: string;
}

const FAQ = [
  {
    q: 'How do I publish a quiz?',
    a: 'Create it in the quiz builder, save it as a draft, then submit it for review. An administrator will approve it, reject it with a reason, or request changes. You get a notification either way.',
  },
  {
    q: 'Where do QCoins come from?',
    a: 'Your balance is the sum of your ledger entries: a welcome bonus, rewards for completing quizzes, refunds, and any manual adjustment an administrator makes. Every entry is visible on the wallet page.',
  },
  {
    q: 'Why was my quiz rejected?',
    a: 'The reviewer leaves a reason with the decision. Open the quiz from My Quizzes to read it, make the change, then resubmit. The new version is stored so the reviewer can compare it with the previous one.',
  },
  {
    q: 'Can I get a refund for an entry fee?',
    a: 'Yes, while the attempt is inside the refund window. Open the wallet page, go to Refund requests and submit a reason. An administrator reviews it before any QCoin is returned.',
  },
];

export function SupportPage() {
  const { rules } = useBootstrap();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [appealOpen, setAppealOpen] = useState(false);
  const [contentType, setContentType] = useState('quiz');
  const [contentId, setContentId] = useState('');
  const [reason, setReason] = useState('');

  const reports = useQuery<{ items: MyReport[] }>({ queryKey: qk.myReports, queryFn: () => api.get('/reports/mine') });
  const appeals = useQuery<{ items: MyAppeal[] }>({ queryKey: qk.myAppeals, queryFn: () => api.get('/appeals/mine') });

  const myContent = useQuery<{ items: { id: string; title: string }[] }>({
    queryKey: ['my-content-for-appeal', contentType],
    queryFn: () =>
      api.get(contentType === 'quiz' ? '/quizzes/mine/list?page=1&pageSize=100' : '/polls/mine/list?page=1&pageSize=100'),
    enabled: appealOpen,
  });

  const appeal = useMutation({
    mutationFn: () => api.post('/appeals', { contentType, contentId, reason }),
    onSuccess: () => {
      setAppealOpen(false);
      setReason('');
      setContentId('');
      queryClient.invalidateQueries({ queryKey: qk.myAppeals });
      toast.success('Appeal submitted. A moderator will review it.');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not submit the appeal.'),
  });

  return (
    <>
      <PageHeading
        title="Help and Support"
        description="How the platform works, plus the status of anything you have reported or appealed."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title="Frequently asked questions" bodyClassName="p-0">
            <dl className="divide-y divide-line">
              {FAQ.map((item) => (
                <div key={item.q} className="px-4 py-3">
                  <dt className="text-[13px] font-medium text-ink">{item.q}</dt>
                  <dd className="mt-1 text-[13px] leading-relaxed text-ink-soft">{item.a}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Content guidelines" description="What reviewers look for when they assess a submission.">
            {rules.guidelines ? (
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">{rules.guidelines}</p>
            ) : (
              <p className="text-[13px] text-ink-muted">
                No content guidelines have been published by an administrator yet.
              </p>
            )}
          </Panel>

          <Panel
            title="Your reports"
            description="Reports you have submitted about quizzes, polls, reviews or users."
            bodyClassName="p-0"
          >
            {reports.isLoading ? (
              <div className="p-4">
                <LoadingBlock rows={3} />
              </div>
            ) : reports.error ? (
              <div className="p-4">
                <ErrorState error={reports.error} onRetry={() => reports.refetch()} compact />
              </div>
            ) : !reports.data?.items.length ? (
              <div className="p-4">
                <EmptyState
                  compact
                  icon={<ShieldQuestion className="h-4 w-4" />}
                  title="You have not reported anything"
                  description="Use the Report button on a quiz or poll if something breaks the guidelines."
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {reports.data.items.map((report) => (
                  <li key={report.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge tone="neutral">{report.target_type}</Badge>
                        <span className="text-[13px] font-medium text-ink">{report.reason}</span>
                      </div>
                      <StatusBadge status={report.status} />
                    </div>
                    {report.resolution && (
                      <p className="mt-1.5 rounded border border-line bg-canvas px-2 py-1 text-xs text-ink-soft">
                        {report.resolution}
                      </p>
                    )}
                    <p className="mt-1 text-2xs text-ink-faint">Submitted {formatDate(report.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Your appeals"
            description="Requests to re-review a moderation decision on your own content."
            actions={
              <Button size="sm" variant="secondary" icon={<MessageSquareQuote className="h-3.5 w-3.5" />} onClick={() => setAppealOpen(true)}>
                New appeal
              </Button>
            }
            bodyClassName="p-0"
          >
            {appeals.isLoading ? (
              <div className="p-4">
                <LoadingBlock rows={2} />
              </div>
            ) : !appeals.data?.items.length ? (
              <div className="p-4">
                <EmptyState
                  compact
                  icon={<LifeBuoy className="h-4 w-4" />}
                  title="You have not submitted any appeals"
                  description="If your content was rejected or changes were requested, you can ask for a re-review."
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {appeals.data.items.map((item) => (
                  <li key={item.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge tone="neutral">{item.content_type}</Badge>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{item.reason}</p>
                    {item.resolution && (
                      <p className="mt-1 rounded border border-line bg-canvas px-2 py-1 text-xs text-ink-soft">{item.resolution}</p>
                    )}
                    <p className="mt-1 text-2xs text-ink-faint">Submitted {formatDate(item.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Contacting a moderator">
            <p className="text-[13px] leading-relaxed text-ink-soft">
              Moderation decisions are made by administrators. Use an appeal for decisions on your own content, and a report for
              anything else. Both are tracked with a status you can follow on this page.
            </p>
            <p className="mt-3 text-xs text-ink-muted">Signed in as {user?.email}</p>
          </Panel>

          <Panel title="Platform rules">
            <div className="space-y-2 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Minimum questions</span>
                <span className="tabular-nums text-ink">{String(rules.quiz?.min_questions ?? '—')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Maximum entry fee</span>
                <span className="tabular-nums text-ink">{String(rules.quiz?.max_entry_fee ?? '—')} QCoin</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Maximum reward</span>
                <span className="tabular-nums text-ink">{String(rules.quiz?.max_reward_coins ?? '—')} QCoin</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Poll duration limit</span>
                <span className="tabular-nums text-ink">{String(rules.poll?.max_duration_days ?? '—')} days</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Refund window</span>
                <span className="tabular-nums text-ink">{String(rules.rewards?.refund_window_hours ?? '—')} hours</span>
              </div>
            </div>
          </Panel>

          <Panel title="Getting started">
            <div className="space-y-2">
              <Button to="/app/quizzes/new" size="sm" variant="secondary" block icon={<BookOpen className="h-3.5 w-3.5" />}>
                Create your first quiz
              </Button>
              <Button to="/app/polls/new" size="sm" variant="ghost" block>
                Create a poll
              </Button>
            </div>
          </Panel>
        </div>
      </div>

      {appealOpen && (
        <div className="surface mt-4 p-4">
          <h3 className="text-[13px] font-semibold text-ink">Submit an appeal</h3>
          <p className="mt-0.5 text-xs text-ink-muted">
            Explain why the decision should be reconsidered. An administrator will review it and record the outcome here.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Select
              label="Content type"
              value={contentType}
              onChange={(event) => {
                setContentType(event.target.value);
                setContentId('');
              }}
              options={[
                { value: 'quiz', label: 'Quiz' },
                { value: 'poll', label: 'Poll' },
              ]}
            />
            <Select
              label="Your content"
              value={contentId}
              onChange={(event) => setContentId(event.target.value)}
              options={[
                { value: '', label: myContent.isLoading ? 'Loading…' : 'Select content' },
                ...(myContent.data?.items ?? []).map((item) => ({ value: item.id, label: item.title })),
              ]}
            />
          </div>
          <TextArea
            className="mt-3"
            label="Reason"
            required
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            hint="At least 15 characters."
          />
          <div className="mt-3 flex gap-2">
            <Button variant="primary" size="sm" loading={appeal.isPending} disabled={!contentId || reason.trim().length < 15} onClick={() => appeal.mutate()}>
              Submit appeal
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setAppealOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
