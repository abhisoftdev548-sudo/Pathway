import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlarmClock, Check, ChevronLeft, ChevronRight, Flag, Lightbulb, Send } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import type { AttemptResponse, AttemptView } from '../lib/types';
import { AttemptQuestion } from '../components/QuestionView';
import { Button } from '../components/ui/button';
import { Dialog, EmptyState, Progress, Skeleton } from '../components/ui/misc';
import { useToast } from '../contexts/ToastContext';

export default function Attempt() {
  const { attemptId } = useParams(); const navigate = useNavigate(); const { toast } = useToast();
  const [attempt, setAttempt] = useState<AttemptView | null>(null);
  const [responses, setResponses] = useState<Map<string, AttemptResponse>>(new Map());
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true); const [gone, setGone] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [checks, setChecks] = useState<Record<string, any>>({});
  const saveTimer = useRef<any>(null); const submittedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/api/attempts/${attemptId}`);
        const a: AttemptView = data.attempt;
        if (a.status === 'submitted') return navigate(`/attempts/${attemptId}/results`, { replace: true });
        setAttempt(a);
        setResponses(new Map(a.responses.map((r: any) => [r.questionId, r])));
      } catch { setGone(true); } finally { setLoading(false); }
    })();
  }, [attemptId, navigate]);

  useEffect(() => { const t = setInterval(() => setNowMs(Date.now()), 1000); return () => clearInterval(t); }, []);

  const save = useCallback((map: Map<string, AttemptResponse>) => {
    if (!attemptId) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try { await api.patch(`/api/attempts/${attemptId}/responses`, { responses: [...map.values()] }); setSavedAt(new Date()); }
      catch { /* autosave will retry on next change */ }
    }, 500);
  }, [attemptId]);

  const update = (r: AttemptResponse) => {
    setResponses(prev => { const next = new Map(prev); next.set(r.questionId, r); save(next); return next; });
  };

  const submit = useCallback(async (auto = false) => {
    if (submittedRef.current || !attemptId) return;
    submittedRef.current = true; setSubmitting(true);
    try {
      await api.post(`/api/attempts/${attemptId}/submit`, { responses: [...responses.values()] });
      toast(auto ? 'Time expired — your saved answers were submitted.' : 'Attempt submitted!', auto ? 'info' : 'success');
      navigate(`/attempts/${attemptId}/results`);
    } catch (e) { submittedRef.current = false; toast(errMsg(e), 'error'); } finally { setSubmitting(false); setConfirmOpen(false); }
  }, [attemptId, responses, navigate, toast]);

  // timer expiry -> submit saved responses (server also enforces this)
  const deadlineMs = attempt?.deadline ? new Date(attempt.deadline).getTime() : null;
  const remaining = deadlineMs != null ? Math.max(0, Math.floor((deadlineMs - nowMs) / 1000)) : null;
  useEffect(() => { if (remaining === 0 && attempt) submit(true); }, [remaining, attempt, submit]);

  const answered = useMemo(() => {
    if (!attempt) return new Set<string>();
    const s = new Set<string>();
    attempt.questions.forEach(q => { const r = responses.get(q.id); if (r && ((r.selectedOptionIds?.length || 0) > 0 || (r.textAnswer || '').trim())) s.add(q.id); });
    return s;
  }, [attempt, responses]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-16" /><Skeleton className="h-96" /></div>;
  if (gone || !attempt) return <EmptyState title="Attempt not found" description="It may belong to another account, or the quiz is no longer available."><Link to="/explore"><Button>Explore quizzes</Button></Link></EmptyState>;

  const q = attempt.questions[idx];
  const response: AttemptResponse = responses.get(q.id) || { questionId: q.id, selectedOptionIds: [], textAnswer: '', markedForReview: false };
  const total = attempt.questions.length;
  const unansweredCount = total - answered.size;
  const mm = remaining != null ? `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}` : null;

  const checkNow = async () => {
    try {
      await api.patch(`/api/attempts/${attemptId}/responses`, { responses: [...responses.values()] });
      const { data } = await api.post(`/api/attempts/${attemptId}/check`, { questionId: q.id });
      setChecks(c => ({ ...c, [q.id]: data }));
    } catch (e) { toast(errMsg(e), 'error'); }
  };

  return <div>
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-extrabold text-navy-950">{attempt.title}</h1>
        {mm && <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${remaining! < 60 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`} role="timer" aria-live="off"><AlarmClock className="h-4 w-4" />{mm} left</span>}
        <span className="ml-auto text-xs font-medium text-slate-400">{savedAt ? `Autosaved ${savedAt.toLocaleTimeString()}` : 'Answers autosave as you go'}</span>
      </div>
      <Progress className="mt-3" value={(answered.size / total) * 100} />
      <p className="mt-2 text-xs font-medium text-slate-500">{answered.size} of {total} answered · Question {idx + 1} of {total}{attempt.timeLimitMinutes ? ` · ${attempt.timeLimitMinutes}-minute limit — saved answers submit automatically at zero` : ''}</p>
    </div>

    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_260px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7" aria-label={`Question ${idx + 1}`}>
        <AttemptQuestion q={q} index={idx} response={response} onChange={update} />
        {attempt.explanationMode === 'immediate' && <div className="mt-5 border-t border-slate-100 pt-4">
          {!checks[q.id] ? <Button variant="soft" size="sm" onClick={checkNow}><Lightbulb className="h-4 w-4" />Check answer &amp; see explanation</Button>
            : <div className={`rounded-xl p-4 text-sm ${checks[q.id].isCorrect ? 'bg-emerald-50 text-emerald-900' : checks[q.id].status === 'pending_review' ? 'bg-violet-50 text-violet-900' : 'bg-red-50 text-red-900'}`}>
              <strong>{checks[q.id].status === 'pending_review' ? 'Self-assessment — compare with:' : checks[q.id].isCorrect ? 'Correct!' : 'Not quite.'}</strong> {checks[q.id].explanation}
            </div>}
        </div>}
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <Button variant="outline" disabled={idx === 0} onClick={() => setIdx(i => i - 1)}><ChevronLeft className="h-4 w-4" />Previous</Button>
          <Button variant="outline" disabled={idx === total - 1} onClick={() => setIdx(i => i + 1)}>Next<ChevronRight className="h-4 w-4" /></Button>
          <Button variant={response.markedForReview ? 'soft' : 'ghost'} onClick={() => update({ ...response, markedForReview: !response.markedForReview })} aria-pressed={!!response.markedForReview}>
            <Flag className={`h-4 w-4 ${response.markedForReview ? 'fill-brand-500 text-brand-500' : ''}`} />{response.markedForReview ? 'Marked for review' : 'Mark for review'}
          </Button>
          <Button className="ml-auto" onClick={() => setConfirmOpen(true)} disabled={submitting}><Send className="h-4 w-4" />Submit quiz</Button>
        </div>
      </section>
      <aside className="self-start rounded-2xl border border-slate-200 bg-white p-4 lg:sticky lg:top-24" aria-label="Question navigator">
        <h2 className="text-sm font-bold text-navy-950">Questions</h2>
        <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-5">
          {attempt.questions.map((qq, i) => {
            const r = responses.get(qq.id); const done = answered.has(qq.id); const marked = !!r?.markedForReview;
            return <button key={qq.id} onClick={() => setIdx(i)} aria-current={i === idx} aria-label={`Go to question ${i + 1}${done ? ', answered' : ''}${marked ? ', marked for review' : ''}`}
              className={`relative flex h-10 items-center justify-center rounded-xl border text-sm font-bold ${i === idx ? 'border-brand-600 bg-brand-600 text-white' : done ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-600 hover:border-brand-300'}`}>
              {done && i !== idx ? <Check className="h-4 w-4" /> : i + 1}
              {marked && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white" />}
            </button>;
          })}
        </div>
        <div className="mt-3 space-y-1 text-[11px] text-slate-500">
          <p><span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-300" /> Answered · <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" /> Marked for review</p>
          <p>Closing the tab is safe — resume any time from the quiz page{attempt.timeLimitMinutes ? ' before the timer ends' : ''}.</p>
        </div>
      </aside>
    </div>

    <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Submit this attempt?">
      <p className="text-sm text-slate-600">You answered <strong>{answered.size} of {total}</strong> questions{unansweredCount > 0 ? ` — ${unansweredCount} will count as unanswered` : ''}. After submitting you&apos;ll see your score, the correct answers and every explanation. This cannot be undone (but you can attempt the quiz again).</p>
      <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setConfirmOpen(false)}>Keep working</Button><Button onClick={() => submit()} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit attempt'}</Button></div>
    </Dialog>
  </div>;
}
