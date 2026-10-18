import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Award,
  BookOpenCheck,
  CalendarCheck,
  CheckCircle2,
  Compass,
  Download,
  Flame,
  Footprints,
  GraduationCap,
  Lock,
  Medal,
  Printer,
  Route,
  Sparkles,
  Star,
  Target,
  Timer,
  Trophy,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge, Button, Card, ProgressBar, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { ErrorBlock, PageHeader, StatCard } from '@/components/common';
import { apiGet, getApiError } from '@/lib/api';
import { cn, formatHours, formatMinutes } from '@/lib/utils';

interface AchievementItem {
  key: string;
  title: string;
  description: string;
  icon: string;
  category: 'milestone' | 'streak' | 'consistency' | 'completion';
  earned: boolean;
  earnedAt: string | null;
  progress?: { current: number; target: number; unit: string };
}

interface AchievementsResponse {
  stats: {
    completedTasks: number;
    totalMinutes: number;
    longestStreak: number;
    currentStreak: number;
    completedRoadmaps: number;
    enrolledRoadmaps: number;
    dailyGoalDays: number;
    activeDays: number;
  };
  achievements: AchievementItem[];
  roadmapAchievements: AchievementItem[];
}

interface Certificate {
  certificateId: string;
  enrollmentId: string;
  roadmap: { id: string; title: string; slug: string; category: string; difficulty: string };
  completedAt: string;
  completedTasks: number;
  totalTasks: number;
  totalMinutes: number;
  moduleCount: number;
  topicCount: number;
  skills: string[];
  learningOutcomes: string[];
}

interface CertificatesResponse {
  learner: { name: string; email: string };
  certificates: Certificate[];
}

const iconMap: Record<string, typeof Award> = {
  footprints: Footprints,
  award: Award,
  medal: Medal,
  trophy: Trophy,
  flame: Flame,
  star: Star,
  'book-open': BookOpenCheck,
  compass: Compass,
  target: Target,
  timer: Timer,
  route: Route,
  calendar: CalendarCheck,
  graduation: GraduationCap,
  sparkles: Sparkles,
};

export function Achievements() {
  const achievements = useQuery({ queryKey: ['me', 'achievements'], queryFn: () => apiGet<AchievementsResponse>('/me/achievements') });
  const certificates = useQuery({ queryKey: ['me', 'certificates'], queryFn: () => apiGet<CertificatesResponse>('/me/certificates') });
  const [tab, setTab] = useState<'achievements' | 'certificates'>('achievements');
  const [downloading, setDownloading] = useState<string | null>(null);
  const certificateRefs = useRef<Record<string, HTMLDivElement | null>>({});

  async function downloadCertificate(certificate: Certificate) {
    const element = certificateRefs.current[certificate.certificateId];
    if (!element) return;
    setDownloading(certificate.certificateId);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const link = document.createElement('a');
      link.download = `${certificate.certificateId}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Certificate downloaded');
    } catch {
      toast.error('Could not render the image in this browser', { description: 'Use “Print” to save the certificate as a PDF instead.' });
    } finally {
      setDownloading(null);
    }
  }

  if (achievements.isLoading) {
    return <div className="space-y-5"><Skeleton className="h-24 w-full" /><div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-64" /></div>;
  }
  if (achievements.isError || !achievements.data) return <ErrorBlock message={getApiError(achievements.error).message} onRetry={() => void achievements.refetch()} />;

  const data = achievements.data;
  const earned = data.achievements.filter((item) => item.earned);
  const locked = data.achievements.filter((item) => !item.earned);
  const completion = data.achievements.length > 0 ? Math.round((earned.length / data.achievements.length) * 100) : 0;
  const certs = certificates.data?.certificates ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Milestones"
        title="Achievements"
        description="Recognition attached to real work: completions, streaks, consistency and finished roadmaps. Locked badges show the exact target still ahead."
        actions={<Button asChild variant="outline"><Link to="/analytics"><Target /> View analytics</Link></Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Unlocked" value={`${earned.length} / ${data.achievements.length}`} hint={`${completion}% of all achievements`} icon={<Trophy className="size-5" />} tone="accent" />
        <StatCard label="Completed tasks" value={data.stats.completedTasks} hint={`${formatMinutes(data.stats.totalMinutes)} studied`} icon={<CheckCircle2 className="size-5" />} />
        <StatCard label="Longest streak" value={`${data.stats.longestStreak} days`} hint={`Current ${data.stats.currentStreak} · ${data.stats.activeDays} active days`} icon={<Flame className="size-5" />} tone="rose" />
        <StatCard label="Roadmaps" value={`${data.stats.completedRoadmaps} completed`} hint={`${data.stats.enrolledRoadmaps} enrolled`} icon={<Route className="size-5" />} tone="sky" />
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
        <TabsList className="inline-flex gap-1 rounded-xl bg-surface p-1 ring-1 ring-line">
          <TabsTrigger value="achievements" className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted data-[state=active]:bg-brand-soft data-[state=active]:text-brand-deep">
            Achievements <span className="ml-1 text-[11px] opacity-70">{data.achievements.length}</span>
          </TabsTrigger>
          <TabsTrigger value="certificates" className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted data-[state=active]:bg-brand-soft data-[state=active]:text-brand-deep">
            Certificates <span className="ml-1 text-[11px] opacity-70">{certs.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="achievements" className="mt-5 space-y-6">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-base font-semibold text-ink">Unlocked</h2>
              <Badge tone="bg-emerald-50 text-emerald-700 ring-emerald-200">{earned.length}</Badge>
            </div>
            {earned.length === 0 ? (
              <Card className="p-6 text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><Award className="size-6" /></span>
                <p className="mt-3 text-sm font-semibold text-ink">Your first badge is one task away</p>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">Complete any unlocked published task to unlock First Steps. It will appear here with a timestamp.</p>
                <Button asChild size="sm" className="mt-4"><Link to="/today">Open today's plan <ArrowRight /></Link></Button>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {earned.map((item) => {
                  const Icon = iconMap[item.icon] ?? Award;
                  return (
                    <Card key={item.key} className="relative overflow-hidden border-amber-200/70 bg-gradient-to-br from-amber-50/70 to-surface p-5">
                      <div className="absolute right-3 top-3"><Badge tone="bg-emerald-50 text-emerald-700 ring-emerald-200"><CheckCircle2 className="size-3" /> Earned</Badge></div>
                      <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-amber-600 shadow-card ring-1 ring-amber-200/70"><Icon className="size-6" /></span>
                      <h3 className="mt-3 text-base font-semibold text-ink">{item.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted">{item.description}</p>
                      <p className="mt-3 text-[10px] font-medium uppercase tracking-wide text-amber-700/70">
                        {item.earnedAt ? `Earned ${new Date(item.earnedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Earned'}
                      </p>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {locked.length > 0 ? (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-base font-semibold text-ink">In progress</h2>
                <Badge tone="bg-canvas text-ink/60 ring-line">{locked.length}</Badge>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {locked.map((item) => {
                  const Icon = iconMap[item.icon] ?? Award;
                  const progress = item.progress;
                  const value = progress ? Math.min(100, Math.round((progress.current / Math.max(1, progress.target)) * 100)) : 0;
                  return (
                    <Card key={item.key} className="p-5">
                      <div className="flex items-start justify-between">
                        <span className="flex size-11 items-center justify-center rounded-2xl bg-canvas text-muted ring-1 ring-inset ring-line"><Icon className="size-5" /></span>
                        <Lock className="size-4 text-muted/60" />
                      </div>
                      <h3 className="mt-3 text-sm font-semibold text-ink">{item.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted">{item.description}</p>
                      {progress ? (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-[11px] text-muted">
                            <span className="capitalize">{progress.unit}</span>
                            <span className="font-medium text-ink">{progress.current} / {progress.target}</span>
                          </div>
                          <ProgressBar value={value} className="mt-1.5" label={`${item.title} progress`} />
                        </div>
                      ) : null}
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : null}

          {data.roadmapAchievements.length > 0 ? (
            <div>
              <h2 className="mb-3 text-base font-semibold text-ink">Roadmap badges</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {data.roadmapAchievements.map((item) => {
                  const Icon = iconMap[item.icon] ?? GraduationCap;
                  return (
                    <Card key={item.key} className={cn('p-5', item.earned ? 'border-brand/20 bg-brand-soft/30' : '')}>
                      <div className="flex items-center justify-between">
                        <span className="flex size-10 items-center justify-center rounded-xl bg-surface text-brand shadow-card"><Icon className="size-5" /></span>
                        {item.earned ? <Badge tone="bg-emerald-50 text-emerald-700 ring-emerald-200">Earned</Badge> : <Badge tone="bg-canvas text-muted ring-line">In progress</Badge>}
                      </div>
                      <h3 className="mt-3 text-sm font-semibold text-ink">{item.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted">{item.description}</p>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="certificates" className="mt-5">
          {certificates.isLoading ? (
            <div className="grid gap-5 lg:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-72" />)}</div>
          ) : certificates.isError ? (
            <ErrorBlock message={getApiError(certificates.error).message} onRetry={() => void certificates.refetch()} />
          ) : certs.length === 0 ? (
            <Card className="p-8 text-center">
              <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand"><GraduationCap className="size-7" /></span>
              <h2 className="mt-3 text-base font-semibold text-ink">Certificates arrive at 100%</h2>
              <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted">Complete every eligible published task in a roadmap to earn a verifiable certificate with your name, completion date and roadmap details.</p>
              <div className="mx-auto mt-4 max-w-md rounded-xl bg-canvas/70 p-3 text-left text-xs leading-relaxed text-muted">
                <p className="font-medium text-ink">Currently closest</p>
                {data.stats.enrolledRoadmaps === 0 ? (
                  <p className="mt-1">No enrollments yet. <Link to="/explore" className="font-medium text-brand hover:underline">Explore roadmaps</Link>.</p>
                ) : (
                  <p className="mt-1">{data.stats.completedRoadmaps} of {data.stats.enrolledRoadmaps} enrollments complete. Progress is computed from published tasks only, so certificates stay accurate through curriculum updates.</p>
                )}
              </div>
              <Button asChild className="mt-4"><Link to="/my-roadmaps">My roadmaps <ArrowRight /></Link></Button>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="rounded-xl border border-brand/20 bg-brand-soft/40 p-3 text-xs leading-relaxed text-brand-deep">
                Certificates identify the learner and the completed roadmap. Download a PNG or print to PDF — both are generated from the data shown here.
              </div>
              <div className="grid gap-5 xl:grid-cols-2">
                {certs.map((certificate) => (
                  <div key={certificate.certificateId} className="space-y-2">
                    <div
                      ref={(element) => { certificateRefs.current[certificate.certificateId] = element; }}
                      className="relative overflow-hidden rounded-2xl border-[6px] border-double border-brand/30 bg-white p-7 shadow-card"
                    >
                      <div className="absolute -right-10 -top-10 size-32 rounded-full bg-brand-soft/60" aria-hidden />
                      <div className="absolute -bottom-12 -left-8 size-36 rounded-full bg-amber-50" aria-hidden />
                      <div className="relative text-center">
                        <p className="font-serif text-[10px] uppercase tracking-[0.3em] text-brand">PathForge</p>
                        <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-slate-400">Certificate of completion</p>
                        <p className="mt-5 text-[10px] text-slate-500">This certifies that</p>
                        <p className="mt-1 font-serif text-2xl text-slate-900">{certificates.data?.learner.name}</p>
                        <p className="mt-4 text-[10px] text-slate-500">has completed the roadmap</p>
                        <p className="mx-auto mt-1 max-w-xs text-base font-semibold leading-snug text-slate-900">{certificate.roadmap.title}</p>
                        <div className="mx-auto mt-3 flex max-w-xs items-center justify-center gap-4 text-[9px] text-slate-500">
                          <span>{certificate.moduleCount} modules</span>
                          <span aria-hidden>·</span>
                          <span>{certificate.topicCount} topics</span>
                          <span aria-hidden>·</span>
                          <span>{certificate.totalTasks} tasks</span>
                        </div>
                        <div className="mt-6 flex items-end justify-between text-left text-[9px] text-slate-500">
                          <div>
                            <p className="border-t border-slate-300 pt-1 font-medium text-slate-700">{new Date(certificate.completedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            <p>Completion date</p>
                          </div>
                          <div className="text-center">
                            <span className="mx-auto flex size-9 items-center justify-center rounded-full bg-brand text-white"><GraduationCap className="size-4" /></span>
                          </div>
                          <div className="text-right">
                            <p className="border-t border-slate-300 pt-1 font-mono font-medium text-slate-700">{certificate.certificateId}</p>
                            <p>Certificate ID</p>
                          </div>
                        </div>
                        <p className="mt-4 text-[8px] text-slate-400">{formatHours(certificate.totalMinutes)} of structured learning · {certificate.roadmap.category}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" loading={downloading === certificate.certificateId} onClick={() => void downloadCertificate(certificate)}><Download /> Download PNG</Button>
                      <Button size="sm" variant="outline" onClick={() => window.print()}><Printer /> Print / PDF</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
