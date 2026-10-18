import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Bookmark, Clock, FileQuestion, Flag, Globe, Info, Layers, Play, RotateCcw, Sigma, Timer, Users } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import type { QuizCard as QC } from '../lib/types';
import { QUESTION_TYPE_LABELS } from '../lib/utils';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input, Label, Textarea } from '../components/ui/input';
import { Dialog, EmptyState, Skeleton } from '../components/ui/misc';
import { Stars } from '../components/QuizCard';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function QuizDetail() {
  const { slug } = useParams(); const { user } = useAuth(); const { toast } = useToast(); const navigate = useNavigate();
  const [quiz, setQuiz] = useState<QC | null>(null);
  const [inProgress, setInProgress] = useState<string | null>(null);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [loading, setLoading] = useState(true); const [missing, setMissing] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState(''); const [details, setDetails] = useState('');
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    try { const { data } = await api.get(`/api/quizzes/${slug}`); setQuiz(data.quiz); setInProgress(data.inProgressAttemptId); setSubmittedCount(data.mySubmittedAttempts || 0); }
    catch { setMissing(true); } finally { setLoading(false); }
  }, [slug]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-48" /><Skeleton className="h-64" /></div>;
  if (missing || !quiz) return <EmptyState icon={<FileQuestion className="h-6 w-6" />} title="Quiz not found" description="It may not be published yet, or it was unpublished by an administrator."><Link to="/explore"><Button>Browse published quizzes</Button></Link></EmptyState>;

  const start = async () => {
    if (!user) return navigate('/login', { state: { from: `/quizzes/${slug}` } });
    setStarting(true);
    try { const { data } = await api.post(`/api/quizzes/${quiz.slug}/attempts`); navigate(`/attempts/${data.attempt.id}`); }
    catch (e) { toast(errMsg(e), 'error'); } finally { setStarting(false); }
  };
  const bookmark = async () => {
    if (!user) return toast('Log in to bookmark quizzes', 'info');
    try { quiz.isBookmarked ? await api.delete(`/api/quizzes/${quiz.id}/bookmark`) : await api.post(`/api/quizzes/${quiz.id}/bookmark`); setQuiz({ ...quiz, isBookmarked: !quiz.isBookmarked }); }
    catch (e) { toast(errMsg(e), 'error'); }
  };
  const rate = async (n: number) => {
    try { const { data } = await api.post(`/api/quizzes/${quiz.id}/rating`, { rating: n }); setQuiz({ ...quiz, myRating: n, ratingAvg: data.ratingAvg, ratingCount: data.ratingCount }); toast('Thanks for rating!'); }
    catch (e) { toast(errMsg(e), 'error'); }
  };
  const report = async () => {
    try { await api.post(`/api/quizzes/${quiz.id}/report`, { reason, details }); setReportOpen(false); toast('Report submitted. An administrator will review it.'); }
    catch (e) { toast(errMsg(e), 'error'); }
  };

  const facts = [
    { icon: FileQuestion, label: 'Questions', value: String(quiz.questionCount) },
    { icon: Sigma, label: 'Total points', value: String(quiz.totalPoints) },
    { icon: Clock, label: 'Estimated time', value: `~${quiz.estimatedDuration} min` },
    { icon: Timer, label: 'Time limit', value: quiz.timeLimit ? `${quiz.timeLimit} min (auto-submits saved answers)` : 'None' },
    { icon: Globe, label: 'Language', value: quiz.language },
    { icon: Users, label: 'Attempts', value: String(quiz.attemptsCount) },
  ];
  return <div>
    <Link to="/explore" className="text-sm font-bold text-brand-600 hover:underline">← Back to explorer</Link>
    <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap gap-2">{quiz.category && <Badge>{quiz.category.name}</Badge>}{quiz.subcategory && <Badge>{quiz.subcategory.name}</Badge>}<Badge>{quiz.difficulty}</Badge></div>
        <h1 className="mt-3 text-3xl font-extrabold text-navy-950">{quiz.title}</h1>
        <p className="mt-3 leading-relaxed text-slate-600">{quiz.description}</p>
        {quiz.tags.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2"><Layers className="h-4 w-4 text-slate-400" />{quiz.tags.map(t => <Link key={t} to={`/explore?tags=${encodeURIComponent(t)}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-brand-700">{t}</Link>)}</div>}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {facts.map(ft => <div key={ft.label} className="rounded-xl bg-slate-50 p-3"><ft.icon className="h-4 w-4 text-brand-600" /><div className="mt-1 text-sm font-bold text-navy-950">{ft.value}</div><div className="text-[11px] font-medium text-slate-500">{ft.label}</div></div>)}
        </div>
        <h2 className="mt-7 font-bold text-navy-950">What&apos;s inside</h2>
        <div className="mt-2 space-y-2">
          {Object.entries(quiz.questionTypes).map(([t, c]) => <div key={t} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-2.5 text-sm"><span className="font-semibold text-navy-900">{QUESTION_TYPE_LABELS[t] || t}</span><span className="text-slate-500">{c} {c === 1 ? 'question' : 'questions'}</span></div>)}
        </div>
        <div className="mt-6 space-y-2 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="flex gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0" />Scoring is done on the server when you submit. Answer keys and explanations are revealed {quiz.explanationMode === 'immediate' ? 'as you check each question (creator enabled immediate explanations)' : 'after submission'}.</p>
          {quiz.hasPartialCredit && <p>One or more multiple-choice questions award <strong>partial credit</strong>: correct picks minus wrong picks, divided by the number of correct options. All others are full-credit-only (select <em>exactly</em> the correct set).</p>}
          {!quiz.hasPartialCredit && quiz.questionTypes['multiple_choice'] && <p>Multiple-choice questions are <strong>full-credit-only</strong>: select all correct options and no incorrect ones.</p>}
          {quiz.hasShortAnswer && <p className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Short-answer questions are <strong>not auto-graded</strong>. They show as “pending review / self-assessment” and you compare your response with the model explanation. Your percentage excludes those marks.</p>}
          {quiz.questionTypes['fill_blank'] && <p>Fill-in-the-blank answers are checked exactly against creator-provided variants (trimmed; case per question setting), so semantically-equivalent free text may not be recognized.</p>}
        </div>
      </section>
      <aside className="space-y-4 self-start lg:sticky lg:top-24">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          {inProgress ? <Link to={`/attempts/${inProgress}`}><Button className="w-full" size="lg"><RotateCcw className="h-4 w-4" />Resume your attempt</Button></Link>
            : <Button className="w-full" size="lg" onClick={start} disabled={starting}><Play className="h-4 w-4" />{starting ? 'Starting…' : submittedCount ? 'Attempt again' : 'Start quiz'}</Button>}
          {!user && <p className="mt-2 text-center text-xs text-slate-500">You&apos;ll be asked to log in — attempts are saved to your account.</p>}
          {submittedCount > 0 && <p className="mt-2 text-center text-xs text-slate-500">You&apos;ve submitted {submittedCount} attempt{submittedCount > 1 ? 's' : ''} of this quiz. <Link className="font-bold text-brand-600" to="/history">View history</Link></p>}
          <div className="mt-4 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={bookmark}><Bookmark className={`h-4 w-4 ${quiz.isBookmarked ? 'fill-brand-500 text-brand-500' : ''}`} />{quiz.isBookmarked ? 'Saved' : 'Bookmark'}</Button>
            <Button variant="ghost" onClick={() => user ? setReportOpen(true) : toast('Log in to report a quiz', 'info')}><Flag className="h-4 w-4" />Report</Button>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2"><Stars value={quiz.ratingAvg} /><span className="text-sm font-semibold">{quiz.ratingCount ? `${quiz.ratingAvg} · ${quiz.ratingCount} ratings` : 'No ratings yet'}</span></div>
            {quiz.canRate && <div className="mt-2"><span className="text-xs font-medium text-slate-500">Your rating: </span><Stars value={quiz.myRating || 0} onRate={rate} size={20} /></div>}
          </div>
        </div>
        {quiz.creator && <Link to={`/creators/${quiz.creator.id}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 hover:border-brand-200">
          <span className="flex h-12 w-12 items-center justify-center rounded-full brand-gradient text-base font-bold text-white">{quiz.creator.displayName.slice(0, 1)}</span>
          <span><span className="block text-xs font-medium text-slate-500">Created by</span><span className="block font-bold text-navy-950">{quiz.creator.displayName}</span><span className="text-xs font-semibold text-brand-600">View creator profile →</span></span>
        </Link>}
      </aside>
    </div>
    <Dialog open={reportOpen} onClose={() => setReportOpen(false)} title="Report this quiz">
      <div className="space-y-3">
        <div><Label htmlFor="rep-reason">Reason *</Label><Input id="rep-reason" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Incorrect answer in question 2" /></div>
        <div><Label htmlFor="rep-details">Details</Label><Textarea id="rep-details" value={details} onChange={e => setDetails(e.target.value)} placeholder="What is wrong, and what should it be?" /></div>
        <div className="flex justify-end gap-2 pt-1"><Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button><Button disabled={reason.trim().length < 3} onClick={report}>Submit report</Button></div>
      </div>
    </Dialog>
  </div>;
}
