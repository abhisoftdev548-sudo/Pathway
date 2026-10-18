import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Coins, FileCheck, Shield } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { qk } from '@/lib/queries';
import { formatNumber } from '@/lib/format';
import { useAuth } from '@/lib/auth';

interface PlatformStats {
  registeredUsers: number;
  publishedQuizzes: number;
  publishedPolls: number;
  completedAttempts: number;
  votesCast: number;
}

const FEATURES = [
  {
    icon: FileCheck,
    title: 'Every submission is reviewed',
    body: 'Quizzes and polls go through a moderation queue with approve, reject and request-changes decisions. Each decision is recorded with a reason.',
  },
  {
    icon: Coins,
    title: 'A QCoin ledger you can audit',
    body: 'Entry fees, rewards and refunds are written to an append-only ledger. Balances are derived from ledger entries, never edited in the browser.',
  },
  {
    icon: BarChart3,
    title: 'Analytics from real activity',
    body: 'Creator and platform charts are built from recorded attempts, votes and ratings. When there is no data, you see an empty chart — not a guess.',
  },
  {
    icon: Shield,
    title: 'Roles with real boundaries',
    body: 'Player, creator and administrator capabilities are enforced on the server. Administrative actions are written to an immutable audit trail.',
  },
];

export function LandingPage() {
  const { user } = useAuth();
  const stats = useQuery<PlatformStats>({
    queryKey: qk.stats,
    queryFn: () => api.get<PlatformStats>('/meta/stats'),
  });

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-12 sm:px-6 lg:py-16">
      <header className="max-w-2xl">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-2.5 py-1 text-2xs font-medium text-ink-soft">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
          Quizzes, polls and a transparent QCoin economy
        </div>
        <h1 className="text-[32px] font-semibold leading-[1.15] tracking-[-0.025em] text-ink sm:text-[40px]">
          Publish quizzes people want to take, and see exactly how they perform.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
          QuizSphere is a quiz and polling platform with a real moderation workflow, a double-entry style QCoin
          ledger and analytics derived only from recorded activity.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {user ? (
            <Button to="/app" size="md" variant="primary">
              Go to your dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <>
              <Button to="/register" size="md" variant="primary">
                Create an account
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
              <Button to="/login" size="md" variant="secondary">
                Sign in
              </Button>
            </>
          )}
          <Button to="/app/quizzes" size="md" variant="ghost">
            Browse quizzes
          </Button>
        </div>
      </header>

      <section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Registered accounts', value: stats.data?.registeredUsers },
          { label: 'Published quizzes', value: stats.data?.publishedQuizzes },
          { label: 'Published polls', value: stats.data?.publishedPolls },
          { label: 'Completed attempts', value: stats.data?.completedAttempts },
        ].map((item) => (
          <div key={item.label} className="surface px-4 py-3">
            <div className="text-2xs uppercase tracking-wide text-ink-faint">{item.label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-ink">
              {stats.isLoading ? '—' : formatNumber(item.value ?? 0)}
            </div>
          </div>
        ))}
      </section>
      <p className="mt-2 text-xs text-ink-faint">
        Counted directly from the database. On a fresh installation these are zero.
      </p>

      <section className="mt-14 grid gap-4 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <article key={feature.title} className="surface p-5">
            <feature.icon className="h-4 w-4 text-brand-600" />
            <h2 className="mt-3 text-[14px] font-semibold text-ink">{feature.title}</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{feature.body}</p>
          </article>
        ))}
      </section>

      <section className="mt-14 surface p-6">
        <h2 className="text-[17px] font-semibold text-ink">How publishing works</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-4">
          {[
            ['Draft your quiz', 'Write questions, mark correct answers and add explanations.'],
            ['Submit for review', 'A version snapshot is stored so reviewers can compare revisions.'],
            ['Moderation decision', 'An administrator approves, rejects with a reason, or requests changes.'],
            ['Publish and earn', 'Players pay any entry fee in QCoins and earn rewards, all written to the ledger.'],
          ].map(([title, body], index) => (
            <li key={title}>
              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-line bg-canvas text-2xs font-semibold text-ink-soft">
                {index + 1}
              </div>
              <h3 className="mt-2.5 text-[13px] font-semibold text-ink">{title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">{body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-xs text-ink-muted">
          Already have an account? <Link className="link" to="/login">Sign in</Link>.
        </p>
      </section>
    </div>
  );
}
