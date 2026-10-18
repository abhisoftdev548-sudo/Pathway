import { CheckCircle2, Lightbulb, XCircle } from 'lucide-react';
import { CodeBlock } from './CodeBlock';
import { Input, Textarea } from './ui/input';
import { QUESTION_TYPE_LABELS } from '../lib/utils';
import type { AttemptResponse } from '../lib/types';
import { useState } from 'react';
import { Button } from './ui/button';

/** Interactive renderer used inside an attempt. Never receives answer keys. */
export function AttemptQuestion({ q, index, response, onChange, disabled }: {
  q: any; index: number; response: AttemptResponse; onChange: (r: AttemptResponse) => void; disabled?: boolean;
}) {
  const [showHint, setShowHint] = useState(false);
  const selected = response.selectedOptionIds || [];
  const toggle = (oid: string, multi: boolean) => {
    if (disabled) return;
    onChange({ ...response, selectedOptionIds: multi ? (selected.includes(oid) ? selected.filter(s => s !== oid) : [...selected, oid]) : [oid] });
  };
  return <fieldset>
    <legend className="sr-only">Question {index + 1}: {q.text}</legend>
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="rounded-full bg-brand-50 px-2.5 py-0.5 font-bold text-brand-700">Question {index + 1}</span>
      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-600">{QUESTION_TYPE_LABELS[q.type] || q.type}</span>
      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-600">{q.marks} {q.marks === 1 ? 'mark' : 'marks'}</span>
      {q.topicTag && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-600">{q.topicTag}</span>}
      {q.type === 'multiple_choice' && <span className="font-semibold text-brand-700">Select all that apply{q.allowPartialCredit ? ' · partial credit available' : ' · full credit only'}</span>}
    </div>
    <p className="mt-3 whitespace-pre-wrap text-base font-semibold leading-relaxed text-navy-950">{q.text}</p>
    {q.imageUrl && <img src={q.imageUrl} alt="" className="mt-3 max-h-72 rounded-xl border border-slate-200 object-contain" />}
    {q.codeSnippet?.code && <div className="mt-3"><CodeBlock code={q.codeSnippet.code} language={q.codeSnippet.language} /></div>}
    {q.hint && <div className="mt-3">
      {showHint ? <p className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />{q.hint}</p>
        : <Button type="button" variant="ghost" size="sm" onClick={() => setShowHint(true)}><Lightbulb className="h-4 w-4" />Show hint</Button>}
    </div>}
    <div className="mt-4">
      {(q.type === 'single_choice' || q.type === 'True_false') && <div className="space-y-2" role="radiogroup">
        {q.options.map((o: any) => {
          const active = selected.includes(o.id);
          return <button key={o.id} type="button" role="radio" aria-checked={active} disabled={disabled} onClick={() => toggle(o.id, false)}
            className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${active ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white hover:border-brand-200'}`}>
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${active ? 'border-brand-600 bg-brand-600' : 'border-slate-300'}`}>{active && <span className="h-2 w-2 rounded-full bg-white" />}</span>{o.text}
          </button>;
        })}
      </div>}
      {q.type === 'multiple_choice' && <div className="space-y-2">
        {q.options.map((o: any) => {
          const active = selected.includes(o.id);
          return <label key={o.id} className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition ${active ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white hover:border-brand-200'}`}>
            <input type="checkbox" className="h-4 w-4 accent-[#4a47c4]" checked={active} disabled={disabled} onChange={() => toggle(o.id, true)} />{o.text}
          </label>;
        })}
      </div>}
      {q.type === 'fill_blank' && <div>
        <Input value={response.textAnswer || ''} disabled={disabled} onChange={e => onChange({ ...response, textAnswer: e.target.value })} placeholder="Type your answer…" aria-label={`Answer for question ${index + 1}`} />
        <p className="mt-1.5 text-xs text-slate-400">Checked exactly against the creator&apos;s accepted answers{q.caseInsensitive ? ' (case-insensitive)' : ''}. Equivalent wording may not be recognized.</p>
      </div>}
      {q.type === 'short_answer' && <div>
        <Textarea value={response.textAnswer || ''} disabled={disabled} onChange={e => onChange({ ...response, textAnswer: e.target.value })} placeholder="Write your answer…" rows={4} aria-label={`Answer for question ${index + 1}`} />
        <p className="mt-1.5 text-xs text-amber-700">Self-assessment: this is not auto-graded. After submitting, compare your answer with the model explanation.</p>
      </div>}
    </div>
  </fieldset>;
}

/** Read-only review renderer (results screen) — safe to show keys here. */
export function ReviewQuestion({ q, index }: { q: any; index: number }) {
  const r = q.result; const your = q.yourResponse || { selectedOptionIds: [], textAnswer: '' };
  const statusStyle: Record<string, string> = { correct: 'bg-emerald-100 text-emerald-800', partial: 'bg-amber-100 text-amber-800', incorrect: 'bg-red-100 text-red-700', unanswered: 'bg-slate-100 text-slate-600', pending_review: 'bg-violet-100 text-violet-800' };
  const label: Record<string, string> = { correct: 'Correct', partial: 'Partially correct', incorrect: 'Incorrect', unanswered: 'Unanswered', pending_review: 'Pending review / self-assess' };
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="rounded-full bg-brand-50 px-2.5 py-0.5 font-bold text-brand-700">Question {index + 1}</span>
      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-600">{QUESTION_TYPE_LABELS[q.type]}</span>
      {r && <span className={`rounded-full px-2.5 py-0.5 font-bold ${statusStyle[r.status]}`}>{label[r.status]}</span>}
      {r && <span className="ml-auto font-bold text-navy-950">{r.awarded} / {r.maxMarks} marks</span>}
    </div>
    <p className="mt-3 whitespace-pre-wrap font-semibold text-navy-950">{q.text}</p>
    {q.codeSnippet?.code && <div className="mt-3"><CodeBlock code={q.codeSnippet.code} language={q.codeSnippet.language} /></div>}
    {q.imageUrl && <img src={q.imageUrl} alt="" className="mt-3 max-h-72 rounded-xl border border-slate-200 object-contain" />}
    {q.options?.length > 0 && <ul className="mt-4 space-y-2">
      {q.options.map((o: any) => {
        const isCorrect = (q.correctOptionIds || []).includes(o.id);
        const picked = (your.selectedOptionIds || []).includes(o.id);
        return <li key={o.id} className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm ${isCorrect ? 'border-emerald-300 bg-emerald-50 font-semibold text-emerald-900' : picked ? 'border-red-300 bg-red-50 text-red-800' : 'border-slate-200 text-slate-600'}`}>
          {isCorrect && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}{picked && !isCorrect && <XCircle className="h-4 w-4 shrink-0 text-red-500" />}
          <span className="flex-1">{o.text}</span>
          {picked && <span className="text-[11px] font-bold uppercase tracking-wide">Your answer</span>}
          {isCorrect && <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Correct</span>}
        </li>;
      })}
    </ul>}
    {q.type === 'fill_blank' && <div className="mt-4 space-y-1 text-sm">
      <p>Your answer: <strong>{your.textAnswer || '(blank)'}</strong></p>
      <p className="text-emerald-800">Accepted answers: <strong>{(q.acceptedAnswers || []).join(' · ')}</strong></p>
    </div>}
    {q.type === 'short_answer' && <div className="mt-4 text-sm">
      <p className="font-semibold text-navy-900">Your answer</p>
      <p className="mt-1 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-slate-700">{your.textAnswer || '(no answer given)'}</p>
      <p className="mt-2 flex gap-2 rounded-xl bg-violet-50 px-3 py-2 text-violet-800"><Info />This response awaits manual review / self-assessment — it is not included in your percentage. Use the model explanation below to judge it.</p>
    </div>}
    {q.explanation && <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950"><span className="font-bold">Explanation{q.type === 'short_answer' ? ' / model answer' : ''}: </span><span className="whitespace-pre-wrap">{q.explanation}</span></div>}
    {q.hint && <p className="mt-2 text-xs text-slate-400">Hint: {q.hint}</p>}
  </article>;
}
function Info() { return <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />; }
