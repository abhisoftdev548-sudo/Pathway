import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Bell, Bookmark, FileQuestion, History, PenSquare, Play, Sparkles, Target, Trophy } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, errMsg } from '../lib/api';
import { fmtDate, STATUS_LABELS } from '../lib/utils';
import QuizCard from '../components/QuizCard';
import { Button } from '../components/ui/button';
import { EmptyState, Skeleton } from '../components/ui/misc';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function Dashboard() {
  const { user } = useAuth(); const { toast } = useToast();
  const [dash, setDash] = useState<any>(null); const [attempts, setAttempts] = useState<any[]>([]);
  const [bookmarks, setBookmarks] = useState<any[]>([]); const [notifs, setNotifs] = useState<any[]>([]);
  const [myQuizzes, setMyQuizzes] = useState<any[]>([]);
  useEffect(() => {
    Promise.allSettled([
      api.get('/api/me/dashboard').then(r => setDash(r.data)),
      api.get('/api/me/attempts').then(r => setAttempts(r.data.items)),
      api.get('/api/me/bookmarks').then(r => setBookmarks(r.data.items)),
      api.get('/api/me/notifications').then(r => setNotifs(r.data.items.slice(0, 5))),
      api.get('/api/me/quizzes').then(r => setMyQuizzes(r.data.items)),
    ]).catch(e => toast(errMsg(e), 'error'));
  }, [toast]);
  if (!dash) return <div className="space-y-4"><Skeleton className="h-28" /><div className="grid gap-4 sm:grid-cols-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}</div></div>;
  const s = dash.stats;
  const cards = [
    { icon: Play, label: 'Quizzes attempted', value: s.quizzesAttempted, hint: `${s.totalAttempts} total attempts` },
    { icon: Target, label: 'Average score', value: s.averagePercentage != null ? `${s.averagePercentage}%` : '—', hint: 'Across submitted attempts' },
    { icon: Trophy, label: 'Best score', value: s.bestPercentage != null ? `${s.bestPercentage}%` : '—', hint: 'Personal best' },
    { icon: FileQuestion, label: 'Questions answered', value: s.questionsAnswered, hint: 'Correct + incorrect' },
    { icon: PenSquare, label: 'Quizzes created', value: s.createdQuizzes, hint: `${s.attemptsOnMyQuizzes} community attempts` },
    { icon: Bookmark, label: 'Bookmarks', value: s.bookmarks, hint: 'Saved for later' },
  ];
  const recent = attempts.slice(0, 5);
  const inProgress = attempts.filter(a => a.status === 'in_progress');
  return <div>
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="text-2xl font-extrabold text-navy-950 sm:text-3xl">Namaste, {user?.displayName.split(' ')[0]} 👋</h1>
      <div className="ml-auto flex gap-2"><Link to="/explore"><Button variant="outline">Find a quiz</Button></Link><Link to="/quizzes/new"><Button><Sparkles className="h-4 w-4" />Create quiz</Button></Link></div>
    </div>

    <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map(c => <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-4"><c.icon className="h-5 w-5 text-brand-600" /><div className="mt-2 text-2xl font-extrabold text-navy-950">{c.value}</div><div className="text-xs font-bold text-slate-600">{c.label}</div><div className="text-[11px] text-slate-400">{c.hint}</div></div>)}
    </div>

    {inProgress.length > 0 && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <strong className="text-amber-900">Continue where you left off:</strong>
      <div className="mt-2 flex flex-wrap gap-2">{inProgress.map(a => <Link key={a.id} to={`/attempts/${a.id}`} className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-amber-900 shadow-sm hover:underline">{a.title} →</Link>)}</div>
    </div>}

    <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Score trend">
        <h2 className="inline-flex items-center gap-2 font-bold text-navy-950"><BarChart3 className="h-4 w-4 text-brand-600" />Score trend (last 12 attempts)</h2>
        {dash.scoreChart?.length ? <div className="mt-4 h-56"><ResponsiveContainer width="100%" height="100%">
          <LineChart data={dash.scoreChart}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" /><Tooltip formatter={(v: any) => [`${v}%`, 'Score']} /><Line type="monotone" dataKey="percentage" stroke="#4a47c4" strokeWidth={2.5} dot={{ r: 3 }} /></LineChart>
        </ResponsiveContainer></div>
          : <p className="mt-3 text-sm text-slate-500">Submit your first attempt and your real score trend appears here — no placeholder charts.</p>}
        <h2 className="mt-6 inline-flex items-center gap-2 font-bold text-navy-950"><History className="h-4 w-4 text-brand-600" />Recent attempts</h2>
        <div className="mt-3 space-y-2">
          {recent.length === 0 && <p className="text-sm text-slate-500">No attempts yet. <Link className="font-bold text-brand-600" to="/explore">Explore quizzes →</Link></p>}
          {recent.map(a => <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm">
            <span className="font-bold text-navy-950">{a.title}</span>
            <span className="text-slate-400">{fmtDate(a.submittedAt || a.startedAt)}</span>
            {a.status === 'submitted' ? <span className="ml-auto inline-flex items-center gap-2"><strong>{a.percentage != null ? `${a.percentage}%` : `${a.score}/${a.maximumScore}`}</strong><Link className="font-bold text-brand-600" to={`/attempts/${a.id}/results`}>Review</Link></span>
              : <Link className="ml-auto font-bold text-amber-700" to={`/attempts/${a.id}`}>Resume</Link>}
          </div>)}
        </div>
      </section>

      <aside className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="My quiz creation">
          <div className="flex items-center justify-between"><h2 className="font-bold text-navy-950">My quizzes</h2><Link className="text-xs font-bold text-brand-600" to="/my-quizzes">Manage →</Link></div>
          <div className="mt-3 space-y-1.5">{Object.entries(dash.createdByStatus || {}).map(([st, n]: any) => (
            <div key={st} className="flex justify-between text-sm"><span className="text-slate-600">{STATUS_LABELS[st] || st}</span><strong>{n}</strong></div>))}
            {myQuizzes.length === 0 && <p className="text-sm text-slate-500">You haven&apos;t created a quiz yet.</p>}
          </div>
          {myQuizzes.filter(q => ['CHANGES_REQUESTED', 'REJECTED', 'DRAFT'].includes(q.status)).slice(0, 3).map(q => (
            <div key={q.id} className="mt-3 rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-900"><strong>{q.title || 'Untitled'}</strong> needs attention — <Link className="font-bold underline" to={`/quizzes/${q.id}/edit`}>{q.status === 'DRAFT' ? 'continue editing' : 'view feedback & fix'}</Link></div>
          ))}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Notifications">
          <div className="flex items-center justify-between"><h2 className="inline-flex items-center gap-2 font-bold text-navy-950"><Bell className="h-4 w-4 text-brand-600" />Notifications</h2><Link className="text-xs font-bold text-brand-600" to="/notifications">All →</Link></div>
          <div className="mt-3 space-y-2">{notifs.length === 0 ? <p className="text-sm text-slate-500">Moderation updates for your quizzes will appear here.</p> : notifs.map(n => (
            <p key={n.id} className={`rounded-xl px-3 py-2 text-sm ${n.read ? 'bg-slate-50 text-slate-600' : 'bg-brand-50 font-medium text-navy-950'}`}>{n.message}<span className="block text-[11px] text-slate-400">{fmtDate(n.createdAt)}</span></p>))}
          </div>
        </section>
      </aside>
    </div>

    <section className="mt-8" aria-label="Bookmarks">
      <h2 className="inline-flex items-center gap-2 text-lg font-extrabold text-navy-950"><Bookmark className="h-5 w-5 text-brand-600" />Favorite quizzes</h2>
      {bookmarks.length === 0
        ? <div className="mt-3"><EmptyState icon={<Bookmark className="h-6 w-6" />} title="No bookmarks yet" description="Tap the bookmark icon on any quiz card or detail page to save it here." /></div>
        : <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{bookmarks.map(q => <QuizCard key={q.id} quiz={q} />)}</div>}
    </section>
  </div>;
}
