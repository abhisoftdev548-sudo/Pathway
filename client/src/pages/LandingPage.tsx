import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, CheckCircle2, Coins, Compass, LineChart, ShieldCheck,
  Sparkles, Vote, PenLine, Trophy,
} from 'lucide-react';
import endpoints, { type PollSummary, type QuizSummary } from '@/services/endpoints';
import { Button } from '@/components/ui/Button';
import { Badge, RatingStars } from '@/components/ui/Data';
import { useDocumentTitle } from '@/hooks';
import { cn } from '@/utils/cn';
import { formatNumber, timeUntil } from '@/utils/format';

/**
 * Landing page — STRICT no-fake-data policy:
 *
 *  - Statistics render ONLY when the API reports real, meaningful values.
 *  - Quiz/poll previews render ONLY when published content exists.
 *  - No testimonials, no fabricated activity, no vanity counters.
 *  - With an empty database the page is still a complete, polished design:
 *    typography, real feature explanations, and clear calls to action.
 */
export function LandingPage() {
  useDocumentTitle('Community quizzes & polls');
  const reduceMotion = useReducedMotion();

  const { data: statsData } = useQuery({
    queryKey: ['public-stats'],
    queryFn: () => endpoints.public.stats(),
    staleTime: 60000,
    retry: 1,
  });

  const { data: highlights } = useQuery({
    queryKey: ['public-highlights'],
    queryFn: () => endpoints.public.highlights(),
    staleTime: 60000,
    retry: 1,
  });

  const stats = statsData?.stats ?? {};
  const statEntries = Object.entries(stats).filter(([, v]) => Number.isFinite(v) && v > 0);
  const quizzes = highlights?.quizzes ?? [];
  const polls = highlights?.polls ?? [];

  const fadeUp = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.45, delay, ease: [0.21, 0.65, 0.32, 0.9] as const },
        };

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-zinc-100">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(900px 380px at 85% -10%, rgb(99 102 241 / 0.10), transparent 60%), radial-gradient(700px 340px at 0% 110%, rgb(139 92 246 / 0.07), transparent 55%)',
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pb-20 sm:pt-24">
          <motion.div {...fadeUp(0)} className="max-w-2xl">
            <Badge tone="brand" className="mb-5">
              <Sparkles className="h-3 w-3" /> Community knowledge, honestly measured
            </Badge>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-zinc-900 sm:text-5xl lg:text-[3.4rem]">
              Quizzes and polls that
              <span className="text-brand-600"> reward real participation</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-zinc-600">
              QuizSphere is a community platform where creators publish quizzes and polls, every
              submission is reviewed before it goes live, and participants earn QCoins under clear,
              transparent rules.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/register">
                <Button size="lg" icon={<ArrowRight className="h-4 w-4" />}>
                  Create your account
                </Button>
              </Link>
              <Link to="/explore/quizzes">
                <Button size="lg" variant="outline" icon={<Compass className="h-4 w-4" />}>
                  Explore content
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-sm text-zinc-400">
              Free to join · Internal QCoins only — never cash · Every score is server-verified
            </p>
          </motion.div>
        </div>
      </section>

      {/* Real statistics — omitted entirely when there is nothing meaningful to show */}
      {statEntries.length > 0 && (
        <section className="border-b border-zinc-100 bg-zinc-50/60">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-3 sm:px-6">
            {statEntries.map(([key, value], i) => (
              <motion.div key={key} {...fadeUp(0.05 * i)}>
                <p className="text-3xl font-semibold tracking-tight text-zinc-900">{formatNumber(value as number)}</p>
                <p className="mt-1 text-sm text-zinc-500">{STAT_LABELS[key] ?? key}</p>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Features — genuine descriptions of implemented platform functionality */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <motion.div {...fadeUp(0)} className="max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            Everything a community quiz platform needs — done properly
          </h2>
          <p className="mt-3 text-zinc-600">
            Not a template: a complete workflow from draft to publication, participation, and reward.
          </p>
        </motion.div>

        <div className="mt-10 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <motion.div key={feature.title} {...fadeUp(0.04 * i)} className="flex gap-4">
              <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', feature.tone)}>
                <feature.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-900">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Quiz previews — only when real published quizzes exist */}
      {quizzes.length > 0 && (
        <section className="border-y border-zinc-100 bg-zinc-50/60">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Fresh quizzes</h2>
                <p className="mt-1 text-sm text-zinc-500">Recently published and reviewed by moderators.</p>
              </div>
              <Link to="/explore/quizzes" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                Browse all quizzes →
              </Link>
            </div>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {quizzes.map((quiz) => (
                <QuizPreviewCard key={quiz._id} quiz={quiz} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Poll previews — only when real open polls exist */}
      {polls.length > 0 && (
        <section>
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Open polls</h2>
                <p className="mt-1 text-sm text-zinc-500">Share your opinion before voting closes.</p>
              </div>
              <Link to="/explore/polls" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                Browse all polls →
              </Link>
            </div>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {polls.map((poll) => (
                <PollPreviewCard key={poll._id} poll={poll} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* QCoin economy explainer */}
      <section className="border-t border-zinc-100 bg-zinc-900">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center">
          <motion.div {...fadeUp(0)}>
            <Badge tone="warning" className="mb-4">
              <Coins className="h-3 w-3" /> The QCoin economy
            </Badge>
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Incentives without hidden rules
            </h2>
            <p className="mt-4 leading-relaxed text-zinc-300">
              QCoins are internal platform credits. Creators decide per quiz or poll whether to charge
              an entry fee, offer a reward, do both, or do neither — and every credit and debit is
              written to an immutable ledger you can audit.
            </p>
            <ul className="mt-6 space-y-3">
              {ECONOMY_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm text-zinc-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  {point}
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div {...fadeUp(0.1)} className="grid gap-4">
            {ECONOMY_MODES.map((mode) => (
              <div key={mode.title} className="rounded-xl border border-zinc-700/80 bg-zinc-800/70 p-5">
                <p className="text-sm font-semibold text-white">{mode.title}</p>
                <p className="mt-1 text-sm text-zinc-400">{mode.description}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
        <motion.h2 {...fadeUp(0)} className="text-3xl font-semibold tracking-tight text-zinc-900">
          Ready to build something people actually take?
        </motion.h2>
        <motion.p {...fadeUp(0.06)} className="mx-auto mt-4 max-w-xl text-zinc-600">
          Create an account, publish your first quiz or poll, and watch real participation roll in —
          with honest data at every step.
        </motion.p>
        <motion.div {...fadeUp(0.12)} className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/register">
            <Button size="lg">Get started free</Button>
          </Link>
          <Link to="/explore/quizzes">
            <Button size="lg" variant="outline">
              See what&apos;s published
            </Button>
          </Link>
        </motion.div>
      </section>
    </>
  );
}

const STAT_LABELS: Record<string, string> = {
  registeredUsers: 'Community members',
  publishedQuizzes: 'Published quizzes',
  publishedPolls: 'Published polls',
  quizzesTaken: 'Quizzes completed',
};

const FEATURES = [
  {
    icon: PenLine,
    title: 'Structured quiz builder',
    description:
      'Five question types — single choice, multiple choice, true/false, fill-in-the-blank, and keyword-graded short answers — with hints, explanations, and preview.',
    tone: 'bg-brand-50 text-brand-600',
  },
  {
    icon: ShieldCheck,
    title: 'Moderation before publication',
    description:
      'Every quiz and poll is reviewed by moderators before it reaches participants. Creators get clear feedback and can resubmit revisions.',
    tone: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: Vote,
    title: 'Opinion polls done right',
    description:
      'Single or multiple voting, deadlines enforced on the server, optional anonymity, and results visibility you control. Poll rewards never pretend opinions have a right answer.',
    tone: 'bg-sky-50 text-sky-600',
  },
  {
    icon: Coins,
    title: 'Transparent QCoin wallet',
    description:
      'Optional entry fees and rewards in four independent configurations, refunds with defined rules, and an immutable transaction ledger for every movement.',
    tone: 'bg-amber-50 text-amber-600',
  },
  {
    icon: Trophy,
    title: 'Earned rankings',
    description:
      'Performance, consistency, and creator leaderboards computed from server-verified attempts and eligible ratings — never from wallet balances or fabricated entries.',
    tone: 'bg-violet-50 text-violet-600',
  },
  {
    icon: LineChart,
    title: 'Creator analytics',
    description:
      'Real attempt counts, score distributions, pass rates, and community feedback on your published content — with loading, empty, and error states handled honestly.',
    tone: 'bg-rose-50 text-rose-600',
  },
];

const ECONOMY_POINTS = [
  'Entry fees are optional — quizzes and polls can be completely free.',
  'Rewards are optional and paid only after server-verified completion.',
  'Refunds follow documented rules for cancellations and abandoned attempts.',
  'Admin adjustments always carry a mandatory, audited reason.',
];

const ECONOMY_MODES = [
  { title: 'Free entry · No reward', description: 'Pure participation — zero friction for your audience.' },
  { title: 'Free entry · Reward', description: 'Sponsor engagement by rewarding completions or votes.' },
  { title: 'Paid entry · No reward', description: 'Gate participation behind a small QCoin commitment.' },
  { title: 'Paid entry · Reward', description: 'Full economy loop: fees fund the reward pool.' },
];

function QuizPreviewCard({ quiz }: { quiz: QuizSummary }) {
  return (
    <Link
      to={`/quizzes/${quiz.slug}`}
      className="surface group p-5 transition-shadow hover:shadow-pop"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-zinc-900 group-hover:text-brand-700">{quiz.title}</h3>
        {quiz.difficulty && (
          <Badge tone={quiz.difficulty === 'HARD' ? 'danger' : quiz.difficulty === 'EASY' ? 'success' : 'info'}>
            {quiz.difficulty.toLowerCase()}
          </Badge>
        )}
      </div>
      {quiz.description && (
        <p className="mt-2 line-clamp-2 text-sm text-zinc-500">{quiz.description}</p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-400">
        {quiz.creator?.name && <span>by {quiz.creator.name}</span>}
        {(quiz.stats?.ratingCount ?? 0) > 0 && (
          <RatingStars value={quiz.stats?.ratingBayes ?? 0} count={quiz.stats?.ratingCount} />
        )}
      </div>
    </Link>
  );
}

function PollPreviewCard({ poll }: { poll: PollSummary }) {
  return (
    <Link to={`/polls/${poll.slug}`} className="surface group flex items-center justify-between gap-4 p-5 transition-shadow hover:shadow-pop">
      <div>
        <h3 className="text-base font-semibold text-zinc-900 group-hover:text-brand-700">{poll.title}</h3>
        {poll.question && <p className="mt-1 line-clamp-1 text-sm text-zinc-500">{poll.question}</p>}
        <p className="mt-2 text-xs text-zinc-400">{timeUntil(poll.endsAt)}</p>
      </div>
      <Vote className="h-5 w-5 shrink-0 text-zinc-300" />
    </Link>
  );
}

export default LandingPage;
