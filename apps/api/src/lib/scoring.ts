import type { AttemptResponse, Question, QuestionResult } from '../types.js';

function normalize(s: string, caseInsensitive: boolean) {
  const t = s.trim().replace(/\s+/g, ' ');
  return caseInsensitive ? t.toLowerCase() : t;
}

/** Server-side scoring. The client never sends scores or answer keys.
 *  - single_choice / True_false : exact correct option
 *  - multiple_choice            : full-credit-only by default; proportional
 *                                 partial credit ONLY when the question opts in:
 *                                 marks * max(0, (hits - wrongPicks) / correctCount)
 *  - fill_blank                 : trimmed compare (case per question config) vs accepted variants
 *  - short_answer               : NOT auto-graded -> pending_review, marks held in pendingMarks */
export function scoreQuestion(q: Question, r: AttemptResponse | undefined): QuestionResult {
  const marks = Number(q.marks) || 0;
  const selected = r?.selectedOptionIds || [];
  const text = (r?.textAnswer || '').trim();
  const unanswered = q.type === 'fill_blank' || q.type === 'short_answer' ? !text : selected.length === 0;
  if (unanswered) return { questionId: q.id, awarded: 0, maxMarks: marks, isCorrect: false, status: 'unanswered' };

  if (q.type === 'single_choice' || q.type === 'True_false') {
    const ok = selected.length === 1 && q.correctOptionIds.includes(selected[0]);
    return { questionId: q.id, awarded: ok ? marks : 0, maxMarks: marks, isCorrect: ok, status: ok ? 'correct' : 'incorrect' };
  }
  if (q.type === 'multiple_choice') {
    const correct = new Set(q.correctOptionIds);
    const hits = selected.filter(s => correct.has(s)).length;
    const wrong = selected.filter(s => !correct.has(s)).length;
    const exact = wrong === 0 && hits === correct.size;
    if (exact) return { questionId: q.id, awarded: marks, maxMarks: marks, isCorrect: true, status: 'correct' };
    if (q.allowPartialCredit && correct.size > 0) {
      const awarded = Math.round((marks * Math.max(0, hits - wrong) / correct.size) * 100) / 100;
      return { questionId: q.id, awarded, maxMarks: marks, isCorrect: false, status: awarded > 0 ? 'partial' : 'incorrect' };
    }
    return { questionId: q.id, awarded: 0, maxMarks: marks, isCorrect: false, status: 'incorrect' };
  }
  if (q.type === 'fill_blank') {
    const ok = (q.acceptedAnswers || []).some(a => normalize(a, q.caseInsensitive) === normalize(text, q.caseInsensitive));
    return { questionId: q.id, awarded: ok ? marks : 0, maxMarks: marks, isCorrect: ok, status: ok ? 'correct' : 'incorrect' };
  }
  // short_answer
  return { questionId: q.id, awarded: 0, maxMarks: marks, isCorrect: null, status: 'pending_review' };
}

export function scoreAttempt(questions: Question[], responses: AttemptResponse[]) {
  const byId = new Map(responses.map(r => [r.questionId, r]));
  const results = questions.map(q => scoreQuestion(q, byId.get(q.id)));
  let score = 0, maxAuto = 0, pendingMarks = 0, correct = 0, incorrect = 0, unanswered = 0;
  for (const r of results) {
    if (r.status === 'pending_review') { pendingMarks += r.maxMarks; continue; }
    score += r.awarded; maxAuto += r.maxMarks;
    if (r.status === 'correct' || r.status === 'partial') correct += r.status === 'correct' ? 1 : 0;
    if (r.status === 'incorrect' || r.status === 'partial') incorrect += 1;
    if (r.status === 'unanswered') unanswered += 1;
  }
  correct = results.filter(r => r.status === 'correct').length;
  incorrect = results.filter(r => r.status === 'incorrect' || r.status === 'partial').length;
  unanswered = results.filter(r => r.status === 'unanswered').length;
  return {
    results, score: Math.round(score * 100) / 100, maximumScore: maxAuto,
    pendingMarks, percentage: maxAuto > 0 ? Math.round((score / maxAuto) * 1000) / 10 : null,
    correctCount: correct, incorrectCount: incorrect, unansweredCount: unanswered,
    evaluationStatus: (pendingMarks > 0 ? 'pending_manual' : 'auto_graded') as 'pending_manual' | 'auto_graded',
  };
}
