import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BookOpenCheck, Users } from 'lucide-react';
import { api } from '../lib/api';
import { fmtDate } from '../lib/utils';
import QuizCard from '../components/QuizCard';
import { Button } from '../components/ui/button';
import { EmptyState, Skeleton } from '../components/ui/misc';

export default function CreatorProfile() {
  const { id } = useParams(); const [data, setData] = useState<any>(null); const [missing, setMissing] = useState(false);
  useEffect(() => { api.get(`/api/users/${id}`).then(r => setData(r.data)).catch(() => setMissing(true)); }, [id]);
  if (missing) return <EmptyState title="Creator not found" description="This profile does not exist."><Link to="/explore"><Button>Explore quizzes</Button></Link></EmptyState>;
  if (!data) return <div className="space-y-4"><Skeleton className="h-36" /><Skeleton className="h-64" /></div>;
  const c = data.creator;
  return <div>
    <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-4">
        {c.avatar ? <img src={c.avatar} alt="" className="h-20 w-20 rounded-full object-cover" /> : <span className="flex h-20 w-20 items-center justify-center rounded-full brand-gradient text-3xl font-extrabold text-white">{c.displayName.slice(0, 1)}</span>}
        <div>
          <h1 className="text-2xl font-extrabold text-navy-950">{c.displayName}</h1>
          <p className="text-sm text-slate-500">QuizSphere creator · joined {fmtDate(c.createdAt)}</p>
          {c.bio && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">{c.bio}</p>}
        </div>
        <div className="ml-auto flex gap-6 text-center">
          <div><div className="inline-flex items-center gap-1 text-2xl font-extrabold"><BookOpenCheck className="h-5 w-5 text-brand-600" />{data.stats.publishedQuizzes}</div><div className="text-[11px] font-medium text-slate-500">Published quizzes</div></div>
          <div><div className="inline-flex items-center gap-1 text-2xl font-extrabold"><Users className="h-5 w-5 text-brand-600" />{data.stats.totalAttempts}</div><div className="text-[11px] font-medium text-slate-500">Community attempts</div></div>
        </div>
      </div>
    </section>
    <h2 className="mb-4 mt-8 text-lg font-extrabold text-navy-950">Published quizzes by {c.displayName.split(' ')[0]}</h2>
    {data.quizzes.length === 0 ? <EmptyState title="No published quizzes yet" description="Approved quizzes from this creator will appear here. Drafts and email addresses are never shown publicly." />
      : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.quizzes.map((q: any) => <QuizCard key={q.id} quiz={q} />)}</div>}
  </div>;
}
