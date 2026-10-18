import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Copy, Eye, History, ListChecks, Plus, Save, Send, Trash2, Undo2 } from 'lucide-react';
import { api, errList, errMsg } from '../lib/api';
import { fmtDate, QUESTION_TYPE_LABELS, uid } from '../lib/utils';
import type { Question, QuestionType } from '../lib/types';
import { Button } from '../components/ui/button';
import { Input, Label, Select, Textarea } from '../components/ui/input';
import { StatusBadge } from '../components/ui/badge';
import { EmptyState, Skeleton } from '../components/ui/misc';
import { AttemptQuestion } from '../components/QuestionView';
import { useToast } from '../contexts/ToastContext';

const LANGUAGES = ['English', 'Hindi', 'Spanish', 'French', 'German', 'Portuguese', 'Other'];
const TYPES = Object.keys(QUESTION_TYPE_LABELS) as QuestionType[];

function newQuestion(type: QuestionType): Question {
  const base: Question = {
    id: uid(), type, text: '', options: [], correctOptionIds: [], acceptedAnswers: [''],
    caseInsensitive: true, explanation: '', hint: '', imageUrl: '', codeSnippet: null,
    difficulty: 'Beginner', marks: 1, topicTag: '', order: 0, allowPartialCredit: false,
  };
  if (type === 'True_false') { const t = uid(), f = uid(); base.options = [{ id: t, text: 'True' }, { id: f, text: 'False' }]; base.correctOptionIds = [t]; }
  if (type === 'single_choice' || type === 'multiple_choice') base.options = [{ id: uid(), text: '' }, { id: uid(), text: '' }];
  return base;
}
function blankPayload() {
  return {
    title: '', description: '', coverImage: '', categoryId: '', subcategoryId: null as string | null,
    tags: [] as string[], difficulty: 'Beginner', language: 'English', estimatedDuration: 10,
    timeLimit: null as number | null,
    settings: { explanationMode: 'after_submission', shuffleQuestions: false, shuffleOptions: false, showScoreImmediately: true },
    questions: [newQuestion('single_choice')] as Question[],
  };
}
type Payload = ReturnType<typeof blankPayload>;

/** Mirror of the server-side submission rules for instant feedback. */
export function validateClient(p: Payload): string[] {
  const e: string[] = [];
  if (p.title.trim().length < 3) e.push('Title must be at least 3 characters.');
  if (p.description.trim().length < 10) e.push('Description must be at least 10 characters.');
  if (!p.categoryId) e.push('A valid, active category is required.');
  if (!p.questions.length) e.push('Add at least one question before submitting.');
  p.questions.forEach((q, i) => {
    const L = `Question ${i + 1}`;
    if (!q.text.trim()) e.push(`${L}: question text is required.`);
    if (!q.explanation.trim()) e.push(`${L}: an explanation is required before submission.`);
    if (!(q.marks > 0)) e.push(`${L}: marks must be greater than 0.`);
    if (q.type === 'single_choice') { if (q.options.length < 2) e.push(`${L}: needs at least 2 options.`); if (q.correctOptionIds.length !== 1) e.push(`${L}: exactly one correct option is required.`); }
    if (q.type === 'multiple_choice') { if (q.options.length < 2) e.push(`${L}: needs at least 2 options.`); if (q.correctOptionIds.length < 1) e.push(`${L}: mark at least one correct option.`); }
    if (q.type === 'True_false' && (q.options.length !== 2 || q.correctOptionIds.length !== 1)) e.push(`${L}: True/False needs exactly one correct answer.`);
    if (['single_choice', 'multiple_choice', 'True_false'].includes(q.type) && q.options.some(o => !o.text.trim())) e.push(`${L}: every option needs text.`);
    if (q.type === 'fill_blank' && !q.acceptedAnswers.some(a => a.trim())) e.push(`${L}: add at least one accepted answer.`);
  });
  return e;
}

export default function Builder() {
  const { id } = useParams(); const navigate = useNavigate(); const { toast } = useToast();
  const [payload, setPayload] = useState<Payload>(blankPayload());
  const [quizMeta, setQuizMeta] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]); const [subcategories, setSubcategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(!!id); const [busy, setBusy] = useState('');
  const [tab, setTab] = useState<'edit' | 'preview' | 'revisions'>('edit');
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [revisions, setRevisions] = useState<any>(null);
  const [previewResponses, setPreviewResponses] = useState<any>({});
  const [dirty, setDirty] = useState(false);

  const loadRevisions = useCallback(async (qid: string) => {
    try { const { data } = await api.get(`/api/me/quizzes/${qid}/revisions`); setRevisions(data); } catch { /* non-critical */ }
  }, []);
  useEffect(() => { api.get('/api/categories').then(r => { setCategories(r.data.categories); setSubcategories(r.data.subcategories); }).catch(() => {}); }, []);
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const { data } = await api.get(`/api/me/quizzes/${id}`);
        const quiz = data.quiz; setQuizMeta(quiz);
        const v = quiz.workingVersion;
        if (v) setPayload({
          title: v.metadata.title, description: v.metadata.description, coverImage: v.metadata.coverImage || '',
          categoryId: v.metadata.categoryId, subcategoryId: v.metadata.subcategoryId || null, tags: v.metadata.tags || [],
          difficulty: v.metadata.difficulty, language: v.metadata.language, estimatedDuration: v.metadata.estimatedDuration,
          timeLimit: v.metadata.timeLimit ?? null, settings: v.metadata.settings, questions: v.questions,
        });
        loadRevisions(id);
      } catch (e) { toast(errMsg(e), 'error'); } finally { setLoading(false); }
    })();
  }, [id, toast, loadRevisions]);

  const set = (patch: Partial<Payload>) => { setPayload(p => ({ ...p, ...patch })); setDirty(true); };
  const setQ = (qid: string, patch: Partial<Question>) => { setPayload(p => ({ ...p, questions: p.questions.map(q => q.id === qid ? { ...q, ...patch } : q) })); setDirty(true); };
  const errors = useMemo(() => validateClient(payload), [payload]);
  const subs = subcategories.filter(s => s.parentCategoryId === payload.categoryId);
  const totalPoints = payload.questions.reduce((s, q) => s + (Number(q.marks) || 0), 0);
  const locked = !!quizMeta?.hasPending;

  const persist = async (): Promise<string | null> => {
    const body = { ...payload, questions: payload.questions.map((q, i) => ({ ...q, order: i, acceptedAnswers: q.acceptedAnswers.filter(a => a.trim() !== '' || q.type !== 'fill_blank') })) };
    if (id) { const { data } = await api.patch(`/api/me/quizzes/${id}`, body); setQuizMeta(data.quiz); return id; }
    const { data } = await api.post('/api/quizzes', body);
    setQuizMeta(data.quiz); navigate(`/quizzes/${data.quiz.id}/edit`, { replace: true }); return data.quiz.id;
  };
  const save = async () => {
    setBusy('save'); setServerErrors([]);
    try { await persist(); setDirty(false); toast('Draft saved'); if (id) loadRevisions(id); }
    catch (e) { setServerErrors(errList(e)); toast(errMsg(e), 'error'); } finally { setBusy(''); }
  };
  const submit = async () => {
    setBusy('submit'); setServerErrors([]);
    try {
      const qid = await persist(); if (!qid) throw new Error('Save failed');
      const isResubmit = quizMeta && ['CHANGES_REQUESTED', 'REJECTED'].includes(quizMeta.status);
      const { data } = await api.post(`/api/me/quizzes/${qid}/${isResubmit ? 'resubmit' : 'submit'}`);
      setQuizMeta(data.quiz); setDirty(false); loadRevisions(qid);
      toast('Submitted! An administrator will review your quiz.');
    } catch (e: any) { setServerErrors(e?.response?.data?.error?.details?.errors || errList(e)); toast('Not ready to submit — check the issues below.', 'error'); }
    finally { setBusy(''); }
  };
  const withdraw = async () => {
    setBusy('withdraw');
    try { const { data } = await api.post(`/api/me/quizzes/${id}/withdraw`); setQuizMeta(data.quiz); toast('Submission withdrawn — you can edit again.'); loadRevisions(id!); }
    catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(''); }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-96" /></div>;

  const showErrors = [...errors, ...serverErrors.filter(x => !errors.includes(x))];
  return <div>
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="text-2xl font-extrabold text-navy-950 sm:text-3xl">{id ? 'Edit quiz' : 'Create a quiz'}</h1>
      {quizMeta && <StatusBadge status={quizMeta.status} isLive={quizMeta.isLive} hasPending={quizMeta.hasPending} />}
      {dirty && <span className="text-xs font-semibold text-amber-700">Unsaved changes</span>}
      <div className="ml-auto flex flex-wrap gap-2">
        <Button variant="outline" onClick={save} disabled={!!busy || locked}><Save className="h-4 w-4" />{busy === 'save' ? 'Saving…' : 'Save draft'}</Button>
        {locked
          ? <Button variant="soft" onClick={withdraw} disabled={!!busy}><Undo2 className="h-4 w-4" />Withdraw submission</Button>
          : <Button onClick={submit} disabled={!!busy}><Send className="h-4 w-4" />{busy === 'submit' ? 'Submitting…' : quizMeta && ['CHANGES_REQUESTED', 'REJECTED'].includes(quizMeta.status) ? 'Resubmit for approval' : 'Submit for approval'}</Button>}
      </div>
    </div>

    {quizMeta?.latestFeedback && ['CHANGES_REQUESTED', 'REJECTED'].includes(quizMeta.status) && (
      <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900" role="alert">
        <strong>Administrator feedback:</strong> {quizMeta.latestFeedback}
        <span className="mt-1 block">Fix the issues, save, then resubmit — your quiz returns to the moderation queue.</span>
      </div>
    )}
    {locked && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">This version is <strong>under review</strong> and is locked for editing. Withdraw the submission if you need to change something.{quizMeta?.isLive ? ' Your previous approved version is still public meanwhile.' : ''}</div>}
    {quizMeta?.isLive && !locked && <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">This quiz is live. Edits are saved to a <strong>new draft version</strong> and only replace the public version after admin approval — the live quiz never changes silently.</div>}

    <div className="mt-5 flex gap-2" role="tablist" aria-label="Builder tabs">
      {([['edit', ListChecks, 'Editor'], ['preview', Eye, 'Preview'], ...(id ? [['revisions', History, 'Revisions & feedback']] : [])] as any[]).map(([key, Icon, label]: any) => (
        <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold ${tab === key ? 'bg-navy-950 text-white' : 'bg-white text-navy-900 border border-slate-200 hover:bg-slate-50'}`}><Icon className="h-4 w-4" />{label}</button>
      ))}
    </div>

    {tab === 'preview' && <div className="mt-5 space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-2xl font-extrabold">{payload.title || '(untitled quiz)'}</h2>
        <p className="mt-2 text-slate-600">{payload.description}</p>
        <p className="mt-2 text-xs font-medium text-slate-400">{payload.questions.length} questions · {totalPoints} points · {payload.difficulty} · {payload.language}{payload.timeLimit ? ` · ${payload.timeLimit} min limit` : ''} — this is exactly the learner view (answer keys hidden).</p>
      </div>
      {payload.questions.map((q, i) => <div key={q.id} className="rounded-2xl border border-slate-200 bg-white p-6">
        <AttemptQuestion q={q} index={i} response={previewResponses[q.id] || { questionId: q.id, selectedOptionIds: [], textAnswer: '' }} onChange={r => setPreviewResponses((p: any) => ({ ...p, [q.id]: r }))} />
      </div>)}
      {payload.questions.length === 0 && <EmptyState title="Nothing to preview yet" description="Add a question in the editor first." />}
    </div>}

    {tab === 'revisions' && <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold">Versions</h2>
        <div className="mt-3 space-y-2">{(revisions?.versions || []).map((v: any) => (
          <div key={v.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5 text-sm">
            <span><strong>v{v.versionNumber}</strong> · {v.title}<span className="block text-xs text-slate-400">{fmtDate(v.updatedAt)} · {v.questionCount} questions · {v.totalPoints} pts</span></span>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold capitalize">{v.state}</span>
          </div>))}{!revisions?.versions?.length && <p className="text-sm text-slate-500">Save the quiz to start its version history.</p>}</div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold">Moderation history</h2>
        <div className="mt-3 space-y-2">{(revisions?.moderationLogs || []).map((l: any) => (
          <div key={l.id} className="rounded-xl bg-slate-50 px-4 py-2.5 text-sm">
            <span className="font-bold capitalize">{l.action.replace('_', ' ')}</span> <span className="text-slate-400">· {l.previousStatus} → {l.newStatus} · {fmtDate(l.createdAt)}</span>
            {l.feedback && <span className="mt-1 block text-slate-600">“{l.feedback}”</span>}
          </div>))}{!revisions?.moderationLogs?.length && <p className="text-sm text-slate-500">No moderation events yet — submit the quiz to start the trail.</p>}</div>
      </div>
    </div>}

    {tab === 'edit' && <fieldset disabled={locked} className="mt-5 grid gap-5 lg:grid-cols-[360px_1fr]">
      <section className="space-y-4 self-start rounded-2xl border border-slate-200 bg-white p-5" aria-label="Quiz metadata">
        <h2 className="font-bold text-navy-950">Quiz details</h2>
        <div><Label htmlFor="b-title">Title *</Label><Input id="b-title" value={payload.title} onChange={e => set({ title: e.target.value })} placeholder="e.g. JavaScript Fundamentals" /></div>
        <div><Label htmlFor="b-desc">Description *</Label><Textarea id="b-desc" value={payload.description} onChange={e => set({ description: e.target.value })} placeholder="What will learners practice? Who is it for?" rows={4} /></div>
        <div><Label htmlFor="b-cat">Category *</Label><Select id="b-cat" value={payload.categoryId} onChange={e => set({ categoryId: e.target.value, subcategoryId: null })}>
          <option value="">Choose a category…</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
        <div><Label htmlFor="b-sub">Subcategory</Label><Select id="b-sub" value={payload.subcategoryId || ''} onChange={e => set({ subcategoryId: e.target.value || null })} disabled={!subs.length}>
          <option value="">None</option>{subs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
        <div><Label htmlFor="b-tags">Topic tags (comma-separated)</Label><Input id="b-tags" value={payload.tags.join(', ')} onChange={e => set({ tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="closures, async, es6" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="b-diff">Difficulty</Label><Select id="b-diff" value={payload.difficulty} onChange={e => set({ difficulty: e.target.value })}>{['Beginner', 'Intermediate', 'Advanced'].map(d => <option key={d}>{d}</option>)}</Select></div>
          <div><Label htmlFor="b-lang">Language</Label><Select id="b-lang" value={payload.language} onChange={e => set({ language: e.target.value })}>{LANGUAGES.map(d => <option key={d}>{d}</option>)}</Select></div>
          <div><Label htmlFor="b-est">Estimated (min)</Label><Input id="b-est" type="number" min={1} max={600} value={payload.estimatedDuration} onChange={e => set({ estimatedDuration: Number(e.target.value) })} /></div>
          <div><Label htmlFor="b-limit">Time limit (min, optional)</Label><Input id="b-limit" type="number" min={1} max={600} value={payload.timeLimit ?? ''} onChange={e => set({ timeLimit: e.target.value ? Number(e.target.value) : null })} placeholder="None" /></div>
        </div>
        <div><Label htmlFor="b-cover">Cover image URL (optional)</Label><Input id="b-cover" value={payload.coverImage} onChange={e => set({ coverImage: e.target.value })} placeholder="https://…" /></div>
        <div><Label htmlFor="b-mode">When are explanations shown?</Label>
          <Select id="b-mode" value={payload.settings.explanationMode} onChange={e => set({ settings: { ...payload.settings, explanationMode: e.target.value } })}>
            <option value="after_submission">After submission (recommended)</option>
            <option value="immediate">Immediately (learner can check each question)</option>
            <option value="after_manual_review">After manual review of short answers</option>
          </Select></div>
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[#4a47c4]" checked={payload.settings.shuffleQuestions} onChange={e => set({ settings: { ...payload.settings, shuffleQuestions: e.target.checked } })} />Shuffle question order per attempt</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[#4a47c4]" checked={payload.settings.shuffleOptions} onChange={e => set({ settings: { ...payload.settings, shuffleOptions: e.target.checked } })} />Shuffle answer options per attempt</label>
        </div>
        <div className={`rounded-xl p-4 text-sm ${showErrors.length ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`} role="status">
          <strong>{showErrors.length ? `${showErrors.length} issue${showErrors.length > 1 ? 's' : ''} before this can be submitted:` : '✓ Ready to submit for moderation'}</strong>
          {showErrors.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5">{showErrors.slice(0, 12).map((x, i) => <li key={i}>{x}</li>)}</ul>}
          <p className="mt-2 text-xs opacity-80">Drafts can be saved incomplete. Submission requires valid metadata, correct answers and an explanation on every question. Total: {totalPoints} points.</p>
        </div>
      </section>

      <section className="space-y-4" aria-label="Questions">
        {payload.questions.map((q, i) => <QuestionEditor key={q.id} q={q} index={i} total={payload.questions.length}
          onChange={patch => setQ(q.id, patch)}
          onTypeChange={type => { const fresh = newQuestion(type); setQ(q.id, { type, options: fresh.options, correctOptionIds: fresh.correctOptionIds, acceptedAnswers: type === 'fill_blank' ? (q.acceptedAnswers.length ? q.acceptedAnswers : ['']) : q.acceptedAnswers }); }}
          onDelete={() => set({ questions: payload.questions.filter(x => x.id !== q.id) })}
          onDuplicate={() => { const copy: Question = JSON.parse(JSON.stringify(q)); copy.id = uid(); copy.options = copy.options.map(o => ({ ...o })); const qs = [...payload.questions]; qs.splice(i + 1, 0, copy); set({ questions: qs }); }}
          onMove={dir => { const qs = [...payload.questions]; const j = i + dir; if (j < 0 || j >= qs.length) return; [qs[i], qs[j]] = [qs[j], qs[i]]; set({ questions: qs }); }}
        />)}
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4">
          <p className="text-sm font-bold text-navy-950">Add a question</p>
          <div className="mt-2 flex flex-wrap gap-2">{TYPES.map(t => <Button key={t} size="sm" variant="outline" onClick={() => set({ questions: [...payload.questions, newQuestion(t)] })}><Plus className="h-3.5 w-3.5" />{QUESTION_TYPE_LABELS[t]}</Button>)}</div>
        </div>
      </section>
    </fieldset>}
    <p className="mt-6 text-sm text-slate-500"><Link to="/my-quizzes" className="font-bold text-brand-600">← Back to my quizzes</Link></p>
  </div>;
}

function QuestionEditor({ q, index, total, onChange, onTypeChange, onDelete, onDuplicate, onMove }: {
  q: Question; index: number; total: number; onChange: (p: Partial<Question>) => void; onTypeChange: (t: QuestionType) => void;
  onDelete: () => void; onDuplicate: () => void; onMove: (d: -1 | 1) => void;
}) {
  const isChoice = ['single_choice', 'multiple_choice', 'True_false'].includes(q.type);
  const toggleCorrect = (oid: string) => {
    if (q.type === 'multiple_choice') onChange({ correctOptionIds: q.correctOptionIds.includes(oid) ? q.correctOptionIds.filter(x => x !== oid) : [...q.correctOptionIds, oid] });
    else onChange({ correctOptionIds: [oid] });
  };
  return <article className="rounded-2xl border border-slate-200 bg-white p-5" aria-label={`Question ${index + 1} editor`}>
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-950 text-sm font-bold text-white">{index + 1}</span>
      <Select aria-label="Question type" className="w-44" value={q.type} onChange={e => onTypeChange(e.target.value as QuestionType)}>{TYPES.map(t => <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>)}</Select>
      <div className="ml-auto flex gap-1">
        <Button size="sm" variant="ghost" aria-label="Move up" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" aria-label="Move down" disabled={index === total - 1} onClick={() => onMove(1)}><ArrowDown className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" aria-label="Duplicate question" onClick={onDuplicate}><Copy className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" aria-label="Delete question" className="text-red-600 hover:bg-red-50" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
      </div>
    </div>
    <div className="mt-4"><Label>Question text *</Label><Textarea value={q.text} onChange={e => onChange({ text: e.target.value })} placeholder={q.type === 'fill_blank' ? 'Use _____ for the blank, e.g. The capital of France is _____.' : 'Ask something clear and specific…'} rows={2} /></div>

    {isChoice && <div className="mt-4">
      <Label>Answer options {q.type === 'multiple_choice' ? '(tick every correct one)' : '(select the one correct answer)'}</Label>
      <div className="space-y-2">{q.options.map(o => (
        <div key={o.id} className="flex items-center gap-2">
          <input type={q.type === 'multiple_choice' ? 'checkbox' : 'radio'} name={`correct-${q.id}`} aria-label="Mark as correct" className="h-4 w-4 shrink-0 accent-[#4a47c4]"
            checked={q.correctOptionIds.includes(o.id)} onChange={() => toggleCorrect(o.id)} />
          <Input value={o.text} disabled={q.type === 'True_false'} onChange={e => onChange({ options: q.options.map(x => x.id === o.id ? { ...x, text: e.target.value } : x) })} placeholder="Option text…" />
          {q.type !== 'True_false' && q.options.length > 2 && <Button size="sm" variant="ghost" aria-label="Remove option" className="text-red-500" onClick={() => onChange({ options: q.options.filter(x => x.id !== o.id), correctOptionIds: q.correctOptionIds.filter(x => x !== o.id) })}><Trash2 className="h-4 w-4" /></Button>}
        </div>))}
      </div>
      {q.type !== 'True_false' && q.options.length < 8 && <Button size="sm" variant="soft" className="mt-2" onClick={() => onChange({ options: [...q.options, { id: uid(), text: '' }] })}><Plus className="h-3.5 w-3.5" />Add option</Button>}
      {q.type === 'multiple_choice' && <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#4a47c4]" checked={!!q.allowPartialCredit} onChange={e => onChange({ allowPartialCredit: e.target.checked })} /><span>Allow partial credit <span className="block text-xs text-slate-400">Off = full-credit-only (exact correct set). On = proportional, and this policy is shown to learners before they start.</span></span></label>}
    </div>}

    {q.type === 'fill_blank' && <div className="mt-4">
      <Label>Accepted answers (variants) *</Label>
      <div className="space-y-2">{q.acceptedAnswers.map((a, ai) => (
        <div key={ai} className="flex gap-2"><Input value={a} onChange={e => { const next = [...q.acceptedAnswers]; next[ai] = e.target.value; onChange({ acceptedAnswers: next }); }} placeholder="Accepted answer…" />
          {q.acceptedAnswers.length > 1 && <Button size="sm" variant="ghost" className="text-red-500" aria-label="Remove accepted answer" onClick={() => onChange({ acceptedAnswers: q.acceptedAnswers.filter((_, i) => i !== ai) })}><Trash2 className="h-4 w-4" /></Button>}</div>))}
      </div>
      <Button size="sm" variant="soft" className="mt-2" onClick={() => onChange({ acceptedAnswers: [...q.acceptedAnswers, ''] })}><Plus className="h-3.5 w-3.5" />Add variant</Button>
      <label className="ml-3 inline-flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#4a47c4]" checked={q.caseInsensitive} onChange={e => onChange({ caseInsensitive: e.target.checked })} />Case-insensitive</label>
      <p className="mt-1 text-xs text-slate-400">Answers are trimmed. Note: automatic checking may not recognize semantically-equivalent free text — add common variants here.</p>
    </div>}

    {q.type === 'short_answer' && <p className="mt-4 rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-800">Short answers are <strong>not auto-graded</strong>. Learners self-assess against your explanation / model answer below, and those marks stay out of their percentage (shown as pending review).</p>}

    <div className="mt-4"><Label>Explanation * {q.type === 'short_answer' ? '(model answer)' : ''}</Label>
      <Textarea value={q.explanation} onChange={e => onChange({ explanation: e.target.value })} placeholder="Explain WHY the correct answer is correct — this is where the learning happens." rows={3} />
      {!q.explanation.trim() && <p className="mt-1 text-xs font-medium text-red-600">Required before submission.</p>}</div>

    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div><Label>Hint (optional)</Label><Input value={q.hint || ''} onChange={e => onChange({ hint: e.target.value })} /></div>
      <div><Label>Topic tag (optional)</Label><Input value={q.topicTag || ''} onChange={e => onChange({ topicTag: e.target.value })} placeholder="e.g. closures" /></div>
      <div><Label>Image URL (optional)</Label><Input value={q.imageUrl || ''} onChange={e => onChange({ imageUrl: e.target.value })} placeholder="https://…" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Marks</Label><Input type="number" min={0} max={100} value={q.marks} onChange={e => onChange({ marks: Number(e.target.value) })} /></div>
        <div><Label>Difficulty</Label><Select value={q.difficulty} onChange={e => onChange({ difficulty: e.target.value })}>{['Beginner', 'Intermediate', 'Advanced'].map(d => <option key={d}>{d}</option>)}</Select></div>
      </div>
    </div>
    <details className="mt-4">
      <summary className="cursor-pointer text-sm font-bold text-brand-700">Code snippet (optional, shown safely as text — never executed)</summary>
      <div className="mt-2 space-y-2">
        <Input placeholder="Language, e.g. javascript" value={q.codeSnippet?.language || ''} onChange={e => onChange({ codeSnippet: { code: q.codeSnippet?.code || '', language: e.target.value } })} />
        <Textarea className="font-mono text-[13px]" rows={5} placeholder={'function example() {\n  // …\n}'} value={q.codeSnippet?.code || ''} onChange={e => onChange({ codeSnippet: e.target.value ? { code: e.target.value, language: q.codeSnippet?.language } : null })} />
      </div>
    </details>
  </article>;
}
