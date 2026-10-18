/**
 * Quiz scoring engine — pure functions, no I/O.
 * Every question type from the spec is evaluated with explicit, documented rules:
 *
 *  - SINGLE_CHOICE:   correct when the selected option is the flagged correct option.
 *  - MULTIPLE_CHOICE: correct only when the selected set exactly equals the correct set.
 *  - TRUE_FALSE:      correct when the boolean answer equals the keyed answer.
 *  - FILL_BLANK:      correct when the normalized text matches one of the accepted answers.
 *                     Normalization: trim, collapse inner whitespace, lowercase (unless
 *                     `caseSensitive`), strip a trailing period.
 *  - SHORT_ANSWER:    keyword evaluation. Each keyword carries a weight; the awarded points
 *                     scale with the matched weight ratio. `minMatches` is a hard floor and
 *                     `passRatio` (default 0.7) decides correctness. `MANUAL` mode always
 *                     yields `needsReview: true` and awards no auto points.
 */

import { QUESTION_TYPES, SHORT_ANSWER_MODES } from '../constants/index.js';

export function normalizeAnswer(text, { caseSensitive = false } = {}) {
  if (text === null || text === undefined) return '';
  let value = String(text).trim().replace(/\s+/g, ' ');
  value = value.replace(/[.。]+$/, '');
  return caseSensitive ? value : value.toLowerCase();
}

function isSameOptionSet(a = [], b = []) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  const setA = new Set(a.map(String));
  const setB = new Set(b.map(String));
  if (setA.size !== setB.size) return false;
  for (const id of setB) if (!setA.has(id)) return false;
  return true;
}

function evaluateShortAnswer(question, rawAnswer) {
  const rules = question.evaluationRules ?? {};
  const mode = rules.mode ?? SHORT_ANSWER_MODES.KEYWORDS;
  const maxPoints = question.points ?? 1;

  if (mode === SHORT_ANSWER_MODES.MANUAL) {
    return { awardedPoints: 0, correct: false, needsReview: true, maxPoints, matchedKeywords: [] };
  }

  const keywords = Array.isArray(rules.keywords) ? rules.keywords : [];
  const text = normalizeAnswer(rawAnswer, { caseSensitive: Boolean(rules.caseSensitive) });
  if (!text) {
    return { awardedPoints: 0, correct: false, needsReview: false, maxPoints, matchedKeywords: [] };
  }

  const matchedKeywords = [];
  let matchedWeight = 0;
  let totalWeight = 0;

  for (const keyword of keywords) {
    const needle = normalizeAnswer(keyword.text, { caseSensitive: Boolean(rules.caseSensitive) });
    const weight = Number.isFinite(keyword.weight) && keyword.weight > 0 ? keyword.weight : 1;
    totalWeight += weight;
    if (needle && text.includes(needle)) {
      matchedWeight += weight;
      matchedKeywords.push(keyword.text);
    }
  }

  if (totalWeight === 0) {
    // No rules defined → cannot auto-evaluate; flag for review rather than guessing.
    return { awardedPoints: 0, correct: false, needsReview: true, maxPoints, matchedKeywords: [] };
  }

  const minMatches = Number.isInteger(rules.minMatches) && rules.minMatches > 0 ? rules.minMatches : 1;
  const passRatio = Number.isFinite(rules.passRatio) && rules.passRatio > 0 ? rules.passRatio : 0.7;
  const ratio = matchedWeight / totalWeight;

  if (matchedKeywords.length < minMatches) {
    return { awardedPoints: 0, correct: false, needsReview: false, maxPoints, matchedKeywords };
  }

  const correct = ratio >= passRatio;
  const awardedPoints = correct ? maxPoints : 0;
  return {
    awardedPoints,
    correct,
    needsReview: rules.flagForReviewOnFail === true && !correct,
    maxPoints,
    matchedKeywords,
  };
}

/**
 * Evaluate a single answer.
 * @param {object} question — question definition from a quiz version snapshot
 * @param {unknown} answer — user-submitted value
 */
export function evaluateAnswer(question, answer) {
  const maxPoints = question.points ?? 1;
  const type = question.type;

  switch (type) {
    case QUESTION_TYPES.SINGLE_CHOICE: {
      const correctOption = (question.options ?? []).find((o) => o.isCorrect);
      const correct = Boolean(correctOption) && String(answer) === String(correctOption.id);
      return {
        awardedPoints: correct ? maxPoints : 0,
        correct,
        needsReview: false,
        maxPoints,
        matchedKeywords: [],
      };
    }
    case QUESTION_TYPES.MULTIPLE_CHOICE: {
      const correctIds = (question.options ?? []).filter((o) => o.isCorrect).map((o) => o.id);
      const correct = correctIds.length > 0 && isSameOptionSet(answer ?? [], correctIds);
      return {
        awardedPoints: correct ? maxPoints : 0,
        correct,
        needsReview: false,
        maxPoints,
        matchedKeywords: [],
      };
    }
    case QUESTION_TYPES.TRUE_FALSE: {
      const expected = question.correctBoolean;
      const given = answer === true || answer === 'true' ? true : answer === false || answer === 'false' ? false : null;
      const correct = given !== null && given === expected;
      return {
        awardedPoints: correct ? maxPoints : 0,
        correct,
        needsReview: false,
        maxPoints,
        matchedKeywords: [],
      };
    }
    case QUESTION_TYPES.FILL_BLANK: {
      const accepted = (question.correctAnswers ?? []).map((a) =>
        normalizeAnswer(a, { caseSensitive: Boolean(question.evaluationRules?.caseSensitive) })
      );
      const given = normalizeAnswer(answer, { caseSensitive: Boolean(question.evaluationRules?.caseSensitive) });
      const correct = accepted.length > 0 && accepted.includes(given);
      return {
        awardedPoints: correct ? maxPoints : 0,
        correct,
        needsReview: false,
        maxPoints,
        matchedKeywords: [],
      };
    }
    case QUESTION_TYPES.SHORT_ANSWER:
      return evaluateShortAnswer(question, answer);
    default:
      return { awardedPoints: 0, correct: false, needsReview: false, maxPoints, matchedKeywords: [] };
  }
}

/**
 * Score a full attempt.
 * @param {object[]} questions — snapshot questions
 * @param {Record<string, unknown>} answersByQuestionId — map questionId → answer
 * @param {{passingScore?: number}} quiz — quiz/version fields (passingScore is percent 0-100)
 */
export function scoreAttempt(questions, answersByQuestionId = {}, quiz = {}) {
  const questionResults = [];
  let score = 0;
  let maxScore = 0;
  let needsReview = false;

  for (const question of questions) {
    const answer = answersByQuestionId[question.id];
    const result = evaluateAnswer(question, answer);
    score += result.awardedPoints;
    maxScore += result.maxPoints;
    if (result.needsReview) needsReview = true;
    questionResults.push({
      questionId: question.id,
      type: question.type,
      awardedPoints: result.awardedPoints,
      maxPoints: result.maxPoints,
      correct: result.correct,
      needsReview: result.needsReview,
      matchedKeywords: result.matchedKeywords,
    });
  }

  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0;
  const passingScore = Number.isFinite(quiz.passingScore) ? quiz.passingScore : 50;
  const passed = !needsReview && percentage >= passingScore;

  return {
    score,
    maxScore,
    percentage,
    passed,
    needsReview,
    passingScore,
    questionResults,
  };
}

/**
 * Extract only the presentation-safe fields of a question (never includes correctness).
 * Used when serving quiz play data to participants.
 */
export function toParticipantQuestion(question) {
  return {
    id: question.id,
    type: question.type,
    text: question.text,
    hint: question.hint ?? null,
    points: question.points ?? 1,
    options:
      question.options?.map((o) => ({
        id: o.id,
        text: o.text,
        // TRUE_FALSE keeps isCorrect off the wire as well; correctness lives server-side.
      })) ?? [],
  };
}

/**
 * Extract solution data for creators / admins (includes answers and explanations).
 */
export function toSolutionQuestion(question) {
  return {
    ...toParticipantQuestion(question),
    explanation: question.explanation ?? null,
    isCorrectOptionIds: (question.options ?? []).filter((o) => o.isCorrect).map((o) => o.id),
    correctBoolean: question.correctBoolean ?? null,
    correctAnswers: question.correctAnswers ?? [],
    evaluationRules: question.evaluationRules ?? null,
  };
}
