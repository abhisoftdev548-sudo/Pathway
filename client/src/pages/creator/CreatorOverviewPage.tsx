import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, Eye, FileEdit, MessageSquareWarning, PenLine, Star, TrendingUp, Vote } from 'lucide-react';
import endpoints, { type QuizSummary } from '@/services/endpoints';
import { useAuth } from '@/context/AuthContext';
import { useDocumentTitle } from '@/hooks';
import { Badge, StatCard, statusTone, STATUS_LABELS } from '@/components/ui/Data';
import { Card, CardBody, CardHeader, EmptyState, ErrorState, SkeletonList } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { formatDate, formatNumber, formatPercent } from '@/utils/format';
import { apiErrorMessage } from '@/services/api';

/** Creator workspace overview: real counts across the content lifecycle. */
export function CreatorOverviewPage() {
  useDocumentTitle('Creator overview');
  const { user } = useAuth();

  const drafts = useQuery({
    queryKey: ['quizzes', 'mine', 'DRAFT', 1],
    queryFn: () => endpoints.quizzes.mine({ status: 'DRAFT', limit: 5 }),
  });
  const pending = useQuery({
    queryKey: ['quizzes', 'mine', 'PENDING_REVIEW', 1],
    queryFn: () => endpoints.quizzes.mine({ status: 'PENDING_REVIEW', limit: 5 }),
  });
  const published = useQuery({
    queryKey: ['quizzes', 'mine', 'APPROVED', 1],
    queryFn: () => endpoints.quizzes.mine({ status: 'APPROVED', limit: 5 }),
  });
  const changes = useQuery({
    queryKey: ['quizzes', 'mine', 'CHANGES_REQUESTED', 1],
    queryFn: () => endpoints.quizzes.mine({ status: 'CHANGES_REQUESTED', limit: 5 }),
  });

  const isLoading = drafts.isLoading || pending.isLoading || published.isLoading || changes.isLoading;
  const isError = drafts.isError || pending.isError || published.isError || changes.isError;

  const publishedItems = published.data?.items ?? [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Creator studio</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage every stage of your content — from draft to published.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/creator/quizzes/new">
            <Button icon={<PenLine className="h-4 w-4" />}>New quiz</Button>
          </Link>
          <Link to="/creator/polls/new">
            <Button variant="outline" icon={<Vote className="h-4 w-4" />}>
              New poll
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Drafts"
          value={formatNumber(drafts.data?.meta?.total ?? 0)}
          icon={<FileEdit className="h-5 w-5" />}
          tone="neutral"
        />
        <StatCard
          label="Pending review"
          value={formatNumber(pending.data?.meta?.total ?? 0)}
          icon={<Clock className="h-5 w-5" />}
          tone="warning"
        />
        <StatCard
          label="Changes requested"
          value={formatNumber(changes.data?.meta?.total ?? 0)}
          icon={<MessageSquareWarning className="h-5 w-5" />}
          tone="warning"
        />
        <StatCard
          label="Published"
          value={formatNumber(published.data?.meta?.total ?? 0)}
          icon={<Eye className="h-5 w-5" />}
          tone="success"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Needs your attention"
            subtitle="Drafts and submissions with requested changes."
            actions={
              <Link to="/creator/changes-requested" className="text-xs font-medium text-brand-600 hover:text-brand-700">
                View all
              </Link>
            }
          />
          <CardBody className="space-y-2">
            {[...(changes.data?.items ?? []), ...(drafts.data?.items ?? [])].slice(0, 5).map((quiz: QuizSummary) => (
              <Link
                key={quiz._id}
                to={`/creator/quizzes/${quiz._id}/edit`}
                className="flex items-center justify-between rounded-lg border border-zinc-100 px-4 py-2.5 hover:border-brand-200 hover:bg-brand-50/40"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900">{quiz.title}</p>
                  {quiz.moderation?.changesRequestedNote && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-amber-600">
                      {quiz.moderation.changesRequestedNote}
                    </p>
                  )}
                </div>
                <Badge tone={statusTone(quiz.status)}>{quiz.status ? STATUS_LABELS[quiz.status] : ''}</Badge>
              </Link>
            ))}
            {(changes.data?.items ?? []).length === 0 && (drafts.data?.items ?? []).length === 0 && !isLoading && (
              <EmptyState
                title="Nothing needs attention"
                description="Drafts and change requests will appear here."
                className="py-6"
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Recently published"
            subtitle="Your live quizzes and their real performance."
            actions={
              <Link to="/creator/analytics" className="text-xs font-medium text-brand-600 hover:text-brand-700">
                Analytics
              </Link>
            }
          />
          <CardBody className="space-y-2">
            {publishedItems.map((quiz) => (
              <Link
                key={quiz._id}
                to={`/quizzes/${quiz.slug}`}
                className="flex items-center justify-between rounded-lg border border-zinc-100 px-4 py-2.5 hover:border-brand-200 hover:bg-brand-50/40"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900">{quiz.title}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {formatNumber(quiz.stats?.attemptsCount ?? 0)} attempts · published {formatDate(quiz.publishedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {(quiz.stats?.ratingCount ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {(quiz.stats?.ratingBayes ?? 0).toFixed(1)}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-zinc-900">
                    {formatPercent(quiz.stats?.avgScore ?? 0)}
                  </span>
                </div>
              </Link>
            ))}
            {publishedItems.length === 0 && !isLoading && (
              <EmptyState
                icon={<TrendingUp className="h-6 w-6" />}
                title="No published content yet"
                description="Once a quiz or poll is approved, its performance shows up here."
                className="py-6"
              />
            )}
          </CardBody>
        </Card>
      </div>

      {isError && (
        <div className="mt-6">
          <ErrorState
            title="Some workspace data could not be loaded"
            description={apiErrorMessage(drafts.error ?? pending.error ?? published.error ?? changes.error)}
            action={<Button onClick={() => window.location.reload()}>Reload</Button>}
          />
        </div>
      )}

      {user?.role === 'ADMIN' && (
        <div className="mt-6 rounded-lg border border-brand-100 bg-brand-50/50 px-4 py-3 text-sm text-brand-800">
          You are an administrator — the{' '}
          <Link to="/admin" className="font-medium underline">
            admin workspace
          </Link>{' '}
          has moderation and platform tools.
        </div>
      )}
    </div>
  );
}

export default CreatorOverviewPage;
