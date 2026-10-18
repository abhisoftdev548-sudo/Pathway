import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Clock3, Compass, History, Hourglass, MinusCircle, Trophy, XCircle } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { api, errMsg } from '../lib/api';
import { fmtTime } from '../lib/utils';
import { ReviewQuestion } from '../components/QuestionView';
import { Button } from '../components/ui/button';
import { EmptyState, Skeleton } from '../components/ui/misc';
import { useToast } from '../contexts/ToastContext';

export default function Results() {
  const { attemptId } = useParams(); const { toast } = useToast();
  const [review, setReview] = useState<any>(null); const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get(`/api/me/attempts/${attemptId}/review`).then(r => setReview(r.data.review)).catch(e => toast(errMsg(e), 'error')).finally(() => setLoading(false));
  }, [attemptId, toast]);
  if (loading) return <div className="space-y-4"><Skeleton className="h-48" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div>;
  if (!review) return <EmptyState title="Results unavailable" description="This attempt has not been submitted yet, or it belongs to another account."><Link to="/history"><Button>View my history</Button></Link></EmptyState>;

  const pct = review.percentage;
  const pie = [
    { name: 'Correct', value: review.correctCount, color: '#059669' },
    { name: 'Incorrect', value: review.incorrectCount, color: '#dc2626' },
    { name: 'Unanswered', value: review.unansweredCount, color: '#cbd5e1' },
  ].filter(d => d.value > 0);
  const pendingCount = review.questions.filter((q: any) => q.result?.status === 'pending_review').length;

  return <div>
    <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-6">
        <div className="relative h-36 w-36 shrink-0" aria-label={pct != null ? `Score ${pct}%` : 'Score pending'}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart><Pie data={pie.length ? pie : [{ name: '—', value: 1, color: '#e2e8f0' }]} dataKey="value" innerRadius={48} outerRadius={66} startAngle={90} endAngle={-270} stroke="none">
              {(pie.length ? pie : [{ color: '#e2e8f0' }]).map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
            </Pie></PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-extrabold text-navy-950">{pct != null ? `${pct}%` : '—'}</span>
            <span className="text-[11px] font-medium text-slate-500">{review.score} / {review.maximumScore} pts</span>
          </div>
        </div>
        <div className="min-w-56 flex-1">
          <h1 className="inline-flex items-center gap-2 text-2xl font-extrabold text-navy-950"><Trophy className="h-6 w-6 text-amber-500" />{review.title}</h1>
          <p className="mt-1 text-sm text-slate-500">Submitted {review.submittedAt ? new Date(review.submittedAt).toLocaleString() : ''} · Time taken {fmtTime(review.timeTaken)}</p>
          <div className="mt-4 grid max-w-lg grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} value={review.correctCount} label="Correct" />
            <Stat icon={<XCircle className="h-4 w-4 text-red-500" />} value={review.incorrectCount} label="Incorrect" />
            <Stat icon={<MinusCircle className="h-4 w-4 text-slate-400" />} value={review.unansweredCount} label="Unanswered" />
            <Stat icon={<Clock3 className="h-4 w-4 text-brand-600" />} value={fmtTime(review.timeTaken)} label="Time taken" />
          </div>
          {pendingCount > 0 && <p className="mt-3 flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-800"><Hourglass className="h-4 w-4" />{pendingCount} short-answer response{pendingCount > 1 ? 's are' : ' is'} pending manual review / self-assessment ({review.pendingMarks} marks not counted in the percentage above).</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/explore"><Button variant="outline"><Compass className="h-4 w-4" />Find another quiz</Button></Link>
            <Link to="/history"><Button variant="soft"><History className="h-4 w-4" />My attempt history</Button></Link>
          </div>
        </div>
      </div>
    </section>
    <h2 className="mb-3 mt-8 text-lg font-extrabold text-navy-950">Question-by-question review</h2>
    <div className="space-y-4">{review.questions.map((q: any, i: number) => <ReviewQuestion key={q.id} q={q} index={i} />)}</div>
  </div>;
}
function Stat({ icon, value, label }: any) {
  return <div className="rounded-xl bg-slate-50 p-3"><div className="flex items-center gap-1.5">{icon}<span className="text-base font-extrabold text-navy-950">{value}</span></div><div className="text-[11px] font-medium text-slate-500">{label}</div></div>;
}
