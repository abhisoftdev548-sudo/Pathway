import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { History as HistoryIcon } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { fmtDate, fmtTime } from '../lib/utils';
import { Button } from '../components/ui/button';
import { EmptyState, Skeleton } from '../components/ui/misc';
import { useToast } from '../contexts/ToastContext';

export default function History() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { api.get('/api/me/attempts').then(r => setItems(r.data.items)).catch(e => toast(errMsg(e), 'error')).finally(() => setLoading(false)); }, [toast]);
  return <div>
    <h1 className="inline-flex items-center gap-2 text-2xl font-extrabold text-navy-950 sm:text-3xl"><HistoryIcon className="h-7 w-7 text-brand-600" />Attempt history</h1>
    <p className="mt-1 text-sm text-slate-500">Every attempt is scored on the server against the exact quiz version you saw — results stay correct even if the quiz is later edited.</p>
    {loading ? <div className="mt-6 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}</div>
      : items.length === 0 ? <div className="mt-6"><EmptyState icon={<HistoryIcon className="h-6 w-6" />} title="No attempts yet" description="Start any published quiz and your scores, explanations and progress will live here."><Link to="/explore"><Button>Explore quizzes</Button></Link></EmptyState></div>
      : <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">
          <thead><tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3 font-bold">Quiz</th><th className="px-4 py-3 font-bold">Date</th><th className="px-4 py-3 font-bold">Score</th><th className="px-4 py-3 font-bold">Correct</th><th className="px-4 py-3 font-bold">Time</th><th className="px-4 py-3 font-bold">Status</th><th className="px-4 py-3" /></tr></thead>
          <tbody>{items.map(a => <tr key={a.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
            <td className="px-4 py-3 font-bold text-navy-950">{a.title}<span className="block text-[11px] font-normal text-slate-400">{a.questionCount} questions{a.pendingMarks ? ` · ${a.pendingMarks} marks pending review` : ''}</span></td>
            <td className="px-4 py-3 text-slate-600">{fmtDate(a.submittedAt || a.startedAt)}</td>
            <td className="px-4 py-3">{a.status === 'submitted' ? <strong>{a.percentage != null ? `${a.percentage}%` : '—'}</strong> : '—'}<span className="block text-[11px] text-slate-400">{a.status === 'submitted' ? `${a.score}/${a.maximumScore} pts` : ''}</span></td>
            <td className="px-4 py-3 text-slate-600">{a.status === 'submitted' ? `${a.correctCount}/${a.questionCount}` : '—'}</td>
            <td className="px-4 py-3 text-slate-600">{fmtTime(a.timeTaken)}</td>
            <td className="px-4 py-3">{a.status === 'submitted' ? <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">{a.evaluationStatus === 'pending_manual' ? 'Pending review' : 'Graded'}</span> : <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">In progress</span>}</td>
            <td className="px-4 py-3 text-right">{a.status === 'submitted' ? <Link className="font-bold text-brand-600" to={`/attempts/${a.id}/results`}>Review →</Link> : <Link className="font-bold text-brand-600" to={`/attempts/${a.id}`}>Resume →</Link>}</td>
          </tr>)}</tbody>
        </table></div>
      </div>}
  </div>;
}
