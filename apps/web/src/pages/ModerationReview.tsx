import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, MessageSquareWarning, XCircle } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { fmtDate, QUESTION_TYPE_LABELS } from '../lib/utils';
import { CodeBlock } from '../components/CodeBlock';
import { StatusBadge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Label, Textarea } from '../components/ui/input';
import { Dialog, EmptyState, Skeleton } from '../components/ui/misc';
import { useToast } from '../contexts/ToastContext';

export default function ModerationReview() {
  const { quizId } = useParams(); const navigate = useNavigate(); const { toast } = useToast();
  const [data, setData] = useState<any>(null); const [missing, setMissing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [confirm, setConfirm] = useState<'approve' | 'reject' | 'request_changes' | null>(null);
  const [busy, setBusy] = useState(false); const [cats, setCats] = useState<any>({ categories: [], subcategories: [] });

  const load = useCallback(async () => {
    try { const r = await api.get(`/api/admin/submissions/${quizId}`); setData(r.data); }
    catch { setMissing(true); }
  }, [quizId]);
  useEffect(() => { load(); api.get('/api/categories').then(r => setCats(r.data)).catch(() => {}); }, [load]);

  if (missing) return <EmptyState title="Submission not found"><Link to="/admin"><Button>Back to admin</Button></Link></EmptyState>;
  if (!data) return <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-96" /></div>;

  const { quiz, creator, version, moderationLogs, revisions } = data;
  const meta = version?.metadata;
  const catName = [...cats.categories, ...cats.subcategories].find((c: any) => c.id === meta?.categoryId)?.name || meta?.categoryId;
  const subName = [...cats.categories, ...cats.subcategories].find((c: any) => c.id === meta?.subcategoryId)?.name;

  const decide = async () => {
    if (!confirm) return; setBusy(true);
    try {
      await api.post(`/api/admin/submissions/${quizId}/${confirm === 'approve' ? 'approve' : confirm === 'reject' ? 'reject' : 'request-changes'}`, { feedback });
      toast(confirm === 'approve' ? 'Approved and published!' : confirm === 'reject' ? 'Rejected with feedback' : 'Changes requested — creator notified');
      setConfirm(null); navigate('/admin');
    } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
  };

  return <div>
    <Link to="/admin" className="text-sm font-bold text-brand-600 hover:underline">← Back to admin</Link>
    <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center gap-2"><StatusBadge status={quiz.status} isLive={quiz.isLive} hasPending={quiz.hasPending} />
            {quiz.hasPublished && quiz.hasPending && <span className="text-xs font-semibold text-blue-700">Revision of a live quiz — approving replaces the public version; rejecting keeps the old one live.</span>}</div>
          <h1 className="mt-3 text-2xl font-extrabold text-navy-950">{meta?.title}</h1>
          <p className="mt-2 text-slate-600">{meta?.description}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            {[['Category', `${catName}${subName ? ' / ' + subName : ''}`], ['Difficulty', meta?.difficulty], ['Language', meta?.language], ['Tags', (meta?.tags || []).join(', ') || '—'], ['Duration', `~${meta?.estimatedDuration} min`], ['Time limit', meta?.timeLimit ? `${meta.timeLimit} min` : 'None'], ['Total points', version?.totalPoints], ['Explanations', meta?.settings?.explanationMode], ['Version', `v${version?.versionNumber} (${version?.state})`]].map(([k, v]) => (
              <div key={k as string} className="rounded-xl bg-slate-50 p-3"><dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{k}</dt><dd className="mt-0.5 font-semibold">{String(v)}</dd></div>
            ))}
          </dl>
        </section>

        {(version?.questions || []).map((q: any, i: number) => (
          <article key={q.id} className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-brand-50 px-2.5 py-0.5 font-bold text-brand-700">Q{i + 1}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold">{QUESTION_TYPE_LABELS[q.type]}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold">{q.marks} marks · {q.difficulty}</span>
              {q.allowPartialCredit && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-semibold text-amber-800">partial credit</span>}
            </div>
            <p className="mt-3 font-semibold whitespace-pre-wrap">{q.text}</p>
            {q.codeSnippet?.code && <div className="mt-3"><CodeBlock code={q.codeSnippet.code} language={q.codeSnippet.language} /></div>}
            {q.imageUrl && <img src={q.imageUrl} alt="" className="mt-3 max-h-56 rounded-xl border" />}
            {q.options?.length > 0 && <ul className="mt-3 space-y-1.5">{q.options.map((o: any) => {
              const correct = q.correctOptionIds.includes(o.id);
              return <li key={o.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${correct ? 'border-emerald-300 bg-emerald-50 font-semibold text-emerald-900' : 'border-slate-200 text-slate-600'}`}>{correct && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}{o.text}{correct && <span className="ml-auto text-[11px] font-bold uppercase">Correct</span>}</li>;
            })}</ul>}
            {q.type === 'fill_blank' && <p className="mt-3 text-sm text-emerald-800">Accepted answers: <strong>{(q.acceptedAnswers || []).join(' · ')}</strong> {q.caseInsensitive ? '(case-insensitive)' : ''}</p>}
            <div className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-950"><strong>Explanation:</strong> <span className="whitespace-pre-wrap">{q.explanation || '(missing!)'}</span></div>
            {q.hint && <p className="mt-2 text-xs text-slate-400">Hint: {q.hint}</p>}
          </article>
        ))}
      </div>

      <aside className="space-y-4 self-start lg:sticky lg:top-24">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold">Creator</h2>
          <div className="mt-3 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-full brand-gradient font-bold text-white">{creator?.displayName?.slice(0, 1)}</span>
            <div><p className="font-bold">{creator?.displayName}</p><Link className="text-xs font-bold text-brand-600" to={`/creators/${creator?.id}`}>Public profile →</Link></div></div>
          {creator?.bio && <p className="mt-2 text-sm text-slate-500">{creator.bio}</p>}
        </section>
        {quiz.hasPending ? <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Moderation actions">
          <h2 className="font-bold">Moderation decision</h2>
          <div className="mt-3"><Label htmlFor="fb">Feedback (required for reject / changes)</Label>
            <Textarea id="fb" value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Be specific and actionable…" rows={4} /></div>
          <div className="mt-3 space-y-2">
            <Button className="w-full" onClick={() => setConfirm('approve')}><CheckCircle2 className="h-4 w-4" />Approve & publish</Button>
            <Button variant="soft" className="w-full" disabled={!feedback.trim()} onClick={() => setConfirm('request_changes')}><MessageSquareWarning className="h-4 w-4" />Request changes</Button>
            <Button variant="destructive" className="w-full" disabled={!feedback.trim()} onClick={() => setConfirm('reject')}><XCircle className="h-4 w-4" />Reject submission</Button>
          </div>
          {!feedback.trim() && <p className="mt-2 text-xs text-slate-400">Add feedback above to enable reject / request-changes.</p>}
        </section> : <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold">No pending decision</h2><p className="mt-1 text-sm text-slate-500">This quiz has no version awaiting review. You are viewing its current working version.</p></section>}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold">Revision history</h2>
          <div className="mt-2 space-y-1.5 text-sm">{revisions.map((v: any) => <div key={v.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><span>v{v.versionNumber} · {v.questionCount}q</span><span className="font-bold capitalize">{v.state}</span></div>)}</div>
          <h2 className="mt-4 font-bold">Previous decisions</h2>
          <div className="mt-2 space-y-1.5 text-sm">{moderationLogs.length === 0 ? <p className="text-slate-500">None yet.</p> : moderationLogs.map((l: any) => (
            <div key={l.id} className="rounded-lg bg-slate-50 px-3 py-2"><span className="font-bold capitalize">{l.action.replace('_', ' ')}</span> <span className="text-slate-400">{fmtDate(l.createdAt)}</span>{l.feedback && <span className="block text-slate-600">“{l.feedback}”</span>}</div>))}
          </div>
        </section>
      </aside>
    </div>

    <Dialog open={!!confirm} onClose={() => setConfirm(null)} title={confirm === 'approve' ? 'Approve and publish?' : confirm === 'reject' ? 'Reject this submission?' : 'Request changes?'}>
      <p className="text-sm text-slate-600">{confirm === 'approve'
        ? 'This version becomes the public, attemptable version immediately. The decision is recorded in the audit log.'
        : `The creator gets your feedback as a notification and can edit and resubmit.${quiz.hasPublished ? ' Their previously approved version stays live.' : ''}`}</p>
      <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
        <Button variant={confirm === 'reject' ? 'destructive' : 'default'} disabled={busy} onClick={decide}>{busy ? 'Working…' : confirm === 'approve' ? 'Approve & publish' : confirm === 'reject' ? 'Reject' : 'Send change request'}</Button></div>
    </Dialog>
  </div>;
}
