import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, BarChart3, BookOpenCheck, BrainCircuit, FileQuestion, Layers, ListChecks, ShieldCheck, Trophy, Users } from 'lucide-react';
import { api } from '../lib/api';
import QuizCard from '../components/QuizCard';
import { Skeleton } from '../components/ui/misc';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';

export default function Landing() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [cats, setCats] = useState<any[]>([]);
  useEffect(() => {
    api.get('/api/stats').then(r => setStats(r.data)).catch(() => {});
    api.get('/api/quizzes/filters').then(r => setCats(r.data.categories || [])).catch(() => {});
  }, []);
  const features = [
    { icon: FileQuestion, title: 'Five question types', text: 'Single & multiple choice, True/False, fill-in-the-blank with accepted variants, and honestly-labelled short answers — mixed freely in one quiz.' },
    { icon: ShieldCheck, title: 'Reviewed before publishing', text: 'Every quiz goes through admin moderation. Creators get actionable feedback instead of silent rejection, and can resubmit.' },
    { icon: BookOpenCheck, title: 'Explanations on every question', text: 'Submissions require a worked explanation per question, so attempts turn into learning the moment you see your score.' },
    { icon: BarChart3, title: 'Real progress data', text: 'Server-side scoring, attempt history, score trends and per-question review with correct answers and points awarded.' },
  ];
  return <div>
    <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white px-6 py-12 sm:px-12 sm:py-16">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-100/70 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-violet-100/70 blur-3xl" />
      <div className="relative max-w-3xl">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700"><BadgeCheck className="h-3.5 w-3.5" />Community quizzes · Admin reviewed</span>
        <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-navy-950 sm:text-5xl">Create quizzes. <span className="brand-text">Share knowledge.</span> Learn from every answer.</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">QuizSphere is where learners build quizzes on any subject — programming, DSA, networking, grammar, general knowledge — with detailed explanations. Approved quizzes are published for the whole community to attempt, score and review.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link to="/explore"><Button size="lg">Explore quizzes <ArrowRight className="h-4 w-4" /></Button></Link>
          <Link to={user ? '/quizzes/new' : '/register'}><Button size="lg" variant="outline"><BrainCircuit className="h-4 w-4" />{user ? 'Create a quiz' : 'Join & create'}</Button></Link>
        </div>
        <div className="mt-9 grid max-w-xl grid-cols-2 gap-4 sm:grid-cols-4" aria-label="Platform statistics">
          {[['Published quizzes', stats?.publishedQuizzes], ['Questions', stats?.totalQuestions], ['Attempts', stats?.totalAttempts], ['Creators', stats?.creators]].map(([label, v]) => (
            <div key={label as string}><div className="text-2xl font-extrabold text-navy-950">{v == null ? '—' : v}</div><div className="text-xs font-medium text-slate-500">{label}</div></div>
          ))}
        </div>
      </div>
    </section>

    <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {features.map(f => <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><f.icon className="h-5 w-5" /></span>
        <h3 className="mt-3 font-bold text-navy-950">{f.title}</h3><p className="mt-1 text-sm leading-relaxed text-slate-500">{f.text}</p>
      </div>)}
    </section>

    {cats.length > 0 && <section className="mt-10">
      <div className="flex items-center justify-between"><h2 className="inline-flex items-center gap-2 text-xl font-extrabold text-navy-950"><Layers className="h-5 w-5 text-brand-600" />Browse by category</h2><Link className="text-sm font-bold text-brand-600 hover:underline" to="/explore">All quizzes →</Link></div>
      <div className="mt-4 flex flex-wrap gap-2">
        {cats.map((c: any) => <Link key={c.id} to={`/explore?categoryId=${c.id}`} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-navy-900 hover:border-brand-300 hover:text-brand-700">{c.name} <span className="text-slate-400">· {c.quizCount}</span></Link>)}
      </div>
    </section>}

    <section className="mt-10">
      <h2 className="inline-flex items-center gap-2 text-xl font-extrabold text-navy-950"><Trophy className="h-5 w-5 text-amber-500" />Popular right now</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {!stats ? [1, 2, 3].map(i => <Skeleton key={i} className="h-64" />) : (stats.featured || []).map((q: any) => <QuizCard key={q.id} quiz={q} />)}
      </div>
      {stats && stats.featured?.length === 0 && <p className="mt-3 text-sm text-slate-500">No published quizzes yet — be the first creator!</p>}
    </section>

    <section className="mt-10 grid gap-4 lg:grid-cols-3">
      {[
        { icon: ListChecks, step: '1', title: 'Build', text: 'Add questions of any type, mark correct answers, write an explanation for each, and preview exactly what learners will see.' },
        { icon: ShieldCheck, step: '2', title: 'Get reviewed', text: 'Submit for moderation. Admins approve, reject with reasons, or request specific changes. Edit and resubmit any time.' },
        { icon: Users, step: '3', title: 'Teach the community', text: 'Approved quizzes go live in the explorer with categories, tags, difficulty and language filters — and you see their attempt stats.' },
      ].map(s => <div key={s.step} className="rounded-2xl border border-slate-200 bg-white p-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-full brand-gradient text-sm font-extrabold text-white">{s.step}</span>
        <h3 className="mt-3 font-bold text-navy-950">{s.title}</h3><p className="mt-1 text-sm leading-relaxed text-slate-500">{s.text}</p>
      </div>)}
    </section>
  </div>;
}
