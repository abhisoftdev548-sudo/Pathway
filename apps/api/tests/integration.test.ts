import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

process.env.QS_DATA_FILE = ':memory:';
process.env.SEED_ON_BOOT = 'false';

let app: any; let store: any;
let catJS: string; let catGK: string;

const agent = () => request.agent(app);
async function login(email: string, password: string) {
  const a = agent();
  const res = await a.post('/api/auth/login').send({ email, password });
  expect(res.status, `login ${email}`).toBe(200);
  return { a, user: res.body.user };
}
async function register(displayName: string, email: string) {
  const a = agent();
  const res = await a.post('/api/auth/register').send({ displayName, email, password: 'Password@123' });
  expect(res.status, `register ${email}`).toBe(201);
  return { a, user: res.body.user };
}

function allTypesQuiz(categoryId: string, title = 'Scoring Gauntlet') {
  return {
    title, description: 'A quiz exercising every question type and scoring rule.',
    categoryId, tags: ['test'], difficulty: 'Intermediate', language: 'English', estimatedDuration: 10, timeLimit: null as number | null,
    settings: { explanationMode: 'after_submission', shuffleQuestions: false, shuffleOptions: false, showScoreImmediately: true },
    questions: [
      { id: 'tq1', type: 'single_choice', text: 'Pick B', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correctOptionIds: ['b'], acceptedAnswers: [], caseInsensitive: true, explanation: 'B is correct.', marks: 2, difficulty: 'Beginner' },
      { id: 'tq2', type: 'multiple_choice', text: 'Pick X and Z', options: [{ id: 'x', text: 'X' }, { id: 'y', text: 'Y' }, { id: 'z', text: 'Z' }], correctOptionIds: ['x', 'z'], acceptedAnswers: [], caseInsensitive: true, explanation: 'X and Z.', marks: 2, difficulty: 'Beginner', allowPartialCredit: false },
      { id: 'tq3', type: 'multiple_choice', text: 'Pick P and Q (partial credit on)', options: [{ id: 'p', text: 'P' }, { id: 'q', text: 'Q' }, { id: 'r', text: 'R' }], correctOptionIds: ['p', 'q'], acceptedAnswers: [], caseInsensitive: true, explanation: 'P and Q.', marks: 4, difficulty: 'Beginner', allowPartialCredit: true },
      { id: 'tq4', type: 'True_false', text: 'The sky is green.', options: [{ id: 't', text: 'True' }, { id: 'f', text: 'False' }], correctOptionIds: ['f'], acceptedAnswers: [], caseInsensitive: true, explanation: 'It appears blue.', marks: 1, difficulty: 'Beginner' },
      { id: 'tq5', type: 'fill_blank', text: 'Array method that filters is _____.', options: [], correctOptionIds: [], acceptedAnswers: ['filter'], caseInsensitive: true, explanation: 'filter()', marks: 2, difficulty: 'Beginner' },
      { id: 'tq6', type: 'short_answer', text: 'Explain closures.', options: [], correctOptionIds: [], acceptedAnswers: [], caseInsensitive: true, explanation: 'A closure captures variables from its lexical scope.', marks: 3, difficulty: 'Beginner' },
    ],
  };
}

beforeAll(async () => {
  const { createStore } = await import('../src/db/store.js');
  const { createApp } = await import('../src/app.js');
  const { seedIfEmpty } = await import('../src/db/seed.js');
  store = createStore();
  await store.ready();
  await seedIfEmpty(store);
  app = createApp(store);
  const cats = await agent().get('/api/categories');
  catJS = cats.body.categories.find((c: any) => c.name === 'JavaScript').id;
  catGK = cats.body.categories.find((c: any) => c.name === 'General Knowledge').id;
});

describe('auth & access control', () => {
  it('rejects guests on /me, prevents duplicates & role escalation', async () => {
    expect((await agent().get('/api/auth/me')).status).toBe(401);
    const { a, user } = await register('Casey', 'casey@test.dev');
    expect(user.role).toBe('user');
    const dup = await agent().post('/api/auth/register').send({ displayName: 'Casey Two', email: 'casey@test.dev', password: 'Password@123' });
    expect(dup.status).toBe(409);
    const bad = await agent().post('/api/auth/login').send({ email: 'casey@test.dev', password: 'wrong-password' });
    expect(bad.status).toBe(401);
    const patch = await a.patch('/api/me').send({ role: 'admin', email: 'hacker@test.dev', displayName: 'Casey' });
    expect(patch.status).toBe(200);
    expect(patch.body.user.role).toBe('user');
    expect(patch.body.user.email).toBe('casey@test.dev');
    // regular users cannot use admin endpoints (including approving their own quizzes)
    expect((await a.get('/api/admin/dashboard')).status).toBe(403);
  });
  it('supports forgot/reset password', async () => {
    const forgot = await agent().post('/api/auth/forgot-password').send({ email: 'casey@test.dev' });
    expect(forgot.status).toBe(200);
    const reset = await agent().post('/api/auth/reset-password').send({ token: forgot.body.resetToken, password: 'NewPass@123' });
    expect(reset.status).toBe(200);
    expect((await agent().post('/api/auth/login').send({ email: 'casey@test.dev', password: 'NewPass@123' })).status).toBe(200);
  });
});

describe('answer-key privacy', () => {
  it('public list & detail never expose keys or explanations', async () => {
    const list = await agent().get('/api/quizzes');
    expect(list.status).toBe(200);
    const raw = JSON.stringify(list.body);
    expect(raw).not.toContain('correctOptionIds');
    expect(raw).not.toContain('"explanation":'); // explanationMode (when) is fine; content is not
    const detail = await agent().get('/api/quizzes/javascript-fundamentals');
    expect(JSON.stringify(detail.body)).not.toContain('correctOptionIds');
  });
  it('attempt payload has no correctOptionIds / acceptedAnswers / explanation', async () => {
    const { a } = await register('Privacy Pat', 'privacy-test@test.dev');
    const start = await a.post('/api/quizzes/javascript-fundamentals/attempts');
    expect(start.status).toBe(201);
    for (const q of start.body.attempt.questions) {
      expect(q.correctOptionIds).toBeUndefined();
      expect(q.acceptedAnswers).toBeUndefined();
      expect(q.explanation).toBeUndefined();
    }
  });
});

describe('quiz validation & ownership', () => {
  it('drafts may be incomplete, submissions may not; owners only', async () => {
    const creator = await register('Vera Vald', 'validity-check@test.dev');
    const payload: any = allTypesQuiz(catJS, 'Broken Quiz');
    payload.questions[0].explanation = '';
    payload.questions[0].correctOptionIds = ['a', 'b']; // single_choice with 2 correct
    payload.questions[4].acceptedAnswers = [];
    const created = await creator.a.post('/api/quizzes').send(payload);
    expect(created.status).toBe(201);
    const quizId = created.body.quiz.id;
    const submit = await creator.a.post(`/api/me/quizzes/${quizId}/submit`);
    expect(submit.status).toBe(400);
    const errors: string[] = submit.body.error.details.errors;
    expect(errors.join(' ')).toContain('explanation is required');
    expect(errors.join(' ')).toContain('exactly one correct option');
    expect(errors.join(' ')).toContain('accepted answer');
    // another user can neither view nor edit it
    const other = await register('Nosy Ned', 'nosy@test.dev');
    expect((await other.a.get(`/api/me/quizzes/${quizId}`)).status).toBe(403);
    expect((await other.a.patch(`/api/me/quizzes/${quizId}`).send(allTypesQuiz(catJS))).status).toBe(403);
  });
});

describe('full lifecycle: create -> Changes requested -> resubmit -> approve -> attempt -> score', () => {
  let creator: any; let taker: any; let admin: any; let quizId: string; let slug: string; let attemptId: string;
  it('moderation workflow incl. feedback requirement and double-decision guard', async () => {
    creator = await register('Mina Maker', 'maker@test.dev');
    admin = await login('admin@quizsphere.local', 'Admin@123');
    const created = await creator.a.post('/api/quizzes').send(allTypesQuiz(catJS));
    quizId = created.body.quiz.id; slug = created.body.quiz.slug;
    expect(created.body.quiz.status).toBe('DRAFT');
    expect((await creator.a.post(`/api/me/quizzes/${quizId}/submit`)).status).toBe(200);
    // pending quizzes are invisible publicly
    const list = await agent().get('/api/quizzes?q=Scoring%20Gauntlet');
    expect(list.body.pagination.total).toBe(0);
    // reject/request-changes without feedback is blocked
    expect((await admin.a.post(`/api/admin/submissions/${quizId}/request-changes`).send({ feedback: '' })).status).toBe(400);
    const changes = await admin.a.post(`/api/admin/submissions/${quizId}/request-changes`).send({ feedback: 'Tighten Q1 wording please.' });
    expect(changes.status).toBe(200);
    const mine = await creator.a.get(`/api/me/quizzes/${quizId}`);
    expect(mine.body.quiz.status).toBe('CHANGES_REQUESTED');
    expect(mine.body.quiz.latestFeedback).toContain('Tighten');
    // edit + resubmit + approve
    const payload = allTypesQuiz(catJS);
    payload.questions[0].text = 'Pick B (exactly one option)';
    expect((await creator.a.patch(`/api/me/quizzes/${quizId}`).send(payload)).status).toBe(200);
    expect((await creator.a.post(`/api/me/quizzes/${quizId}/resubmit`)).status).toBe(200);
    expect((await admin.a.post(`/api/admin/submissions/${quizId}/approve`).send({})).status).toBe(200);
    expect((await admin.a.post(`/api/admin/submissions/${quizId}/approve`).send({})).status).toBe(409); // idempotency guard
    const pub = await agent().get(`/api/quizzes/${slug}`);
    expect(pub.status).toBe(200);
    // creator got notified
    const notifs = await creator.a.get('/api/me/notifications');
    expect(notifs.body.items.some((n: any) => n.type === 'quiz_approved')).toBe(true);
    // revisions + audit trail exist
    const revs = await creator.a.get(`/api/me/quizzes/${quizId}/revisions`);
    expect(revs.body.moderationLogs.length).toBeGreaterThanOrEqual(4);
  });

  it('scores every question type on the server; duplicate submit is harmless', async () => {
    taker = await register('Tessa Taker', 'taker@test.dev');
    const start = await taker.a.post(`/api/quizzes/${slug}/attempts`);
    attemptId = start.body.attempt.id;
    const responses = [
      { questionId: 'tq1', selectedOptionIds: ['b'], textAnswer: '' },                    // correct  2/2
      { questionId: 'tq2', selectedOptionIds: ['x', 'z'], textAnswer: '' },              // exact    2/2
      { questionId: 'tq3', selectedOptionIds: ['p'], textAnswer: '' },                   // partial  2/4
      { questionId: 'tq4', selectedOptionIds: ['t'], textAnswer: '' },                   // wrong    0/1
      { questionId: 'tq5', selectedOptionIds: [], textAnswer: '  FILTER  ' },            // correct (trim+case) 2/2
      { questionId: 'tq6', selectedOptionIds: [], textAnswer: 'functions remembering scope' }, // pending 3
    ];
    expect((await taker.a.patch(`/api/attempts/${attemptId}/responses`).send({ responses })).status).toBe(200);
    const submitted = await taker.a.post(`/api/attempts/${attemptId}/submit`).send({});
    expect(submitted.status).toBe(200);
    const attempt = submitted.body.attempt;
    expect(attempt.score).toBe(8);            // 2+2+2+0+2
    expect(attempt.maximumScore).toBe(11);    // short-answer 3 marks excluded
    expect(attempt.pendingMarks).toBe(3);
    expect(attempt.percentage).toBe(72.7);
    expect(attempt.correctCount).toBe(3);
    expect(attempt.evaluationStatus).toBe('pending_manual');
    const q6 = attempt.questions.find((q: any) => q.id === 'tq6');
    expect(q6.result.status).toBe('pending_review');
    expect(q6.explanation).toContain('closure');
    const q2 = attempt.questions.find((q: any) => q.id === 'tq2');
    expect(q2.correctOptionIds).toEqual(['x', 'z']); // keys revealed only now
    // duplicate submit returns the same result and does not double-count attempts
    const before = (await agent().get(`/api/quizzes/${slug}`)).body.quiz.attemptsCount;
    const again = await taker.a.post(`/api/attempts/${attemptId}/submit`).send({});
    expect(again.body.attempt.score).toBe(8);
    const after = (await agent().get(`/api/quizzes/${slug}`)).body.quiz.attemptsCount;
    expect(after).toBe(before);
    // history + review endpoints
    const history = await taker.a.get('/api/me/attempts');
    expect(history.body.items.some((x: any) => x.id === attemptId && x.percentage === 72.7)).toBe(true);
  });

  it('editing an approved quiz creates a new version; old attempts stay intact', async () => {
    const payload = allTypesQuiz(catJS);
    payload.questions[0].correctOptionIds = ['a']; // flip the answer in v2
    payload.questions[0].explanation = 'Now A is correct in v2.';
    await creator.a.patch(`/api/me/quizzes/${quizId}`).send(payload);
    // v1 remains live while the revision is drafted/pending
    expect((await agent().get(`/api/quizzes/${slug}`)).status).toBe(200);
    await creator.a.post(`/api/me/quizzes/${quizId}/submit`);
    await admin.a.post(`/api/admin/submissions/${quizId}/approve`).send({});
    // the historical attempt still reviews against v1
    const review = await taker.a.get(`/api/me/attempts/${attemptId}/review`);
    const q1 = review.body.review.questions.find((q: any) => q.id === 'tq1');
    expect(q1.correctOptionIds).toEqual(['b']);
    expect(q1.result.status).toBe('correct');
    expect(review.body.review.score).toBe(8);
  });

  it('unpublish blocks discovery & new attempts but preserves records; restore works', async () => {
    await admin.a.post(`/api/admin/quizzes/${quizId}/unpublish`).send({ feedback: 'Under review' });
    expect((await agent().get(`/api/quizzes/${slug}`)).status).toBe(404);
    expect((await taker.a.post(`/api/quizzes/${slug}/attempts`)).status).toBe(404);
    expect((await taker.a.get(`/api/me/attempts/${attemptId}/review`)).status).toBe(200);
    await admin.a.post(`/api/admin/quizzes/${quizId}/restore`);
    expect((await agent().get(`/api/quizzes/${slug}`)).status).toBe(200);
  });
});

describe('discovery filters, bookmarks, ratings, timers', () => {
  it('combines category + difficulty + question-type + language filters', async () => {
    const res = await agent().get(`/api/quizzes?categoryId=${catJS}&difficulty=Beginner&questionType=multiple_choice&language=English`);
    expect(res.body.items.some((q: any) => q.slug === 'javascript-fundamentals')).toBe(true);
    expect(res.body.items.every((q: any) => q.difficulty === 'Beginner' && q.questionTypes.multiple_choice)).toBe(true);
    const none = await agent().get(`/api/quizzes?categoryId=${catJS}&difficulty=Advanced`);
    expect(none.body.items.some((q: any) => q.slug === 'javascript-fundamentals')).toBe(false);
    const filters = await agent().get('/api/quizzes/filters');
    expect(filters.body.categories.every((c: any) => c.quizCount > 0)).toBe(true);
    const sorted = await agent().get('/api/quizzes?sort=popular&limit=5');
    expect(sorted.body.items.length).toBeGreaterThan(0);
  });

  it('bookmark is unique per user+quiz; rating requires an attempt', async () => {
    const u = await register('Bea Bookmark', 'bea@test.dev');
    const quiz = (await agent().get('/api/quizzes/javascript-fundamentals')).body.quiz;
    await u.a.post(`/api/quizzes/${quiz.id}/bookmark`);
    await u.a.post(`/api/quizzes/${quiz.id}/bookmark`);
    const marks = await u.a.get('/api/me/bookmarks');
    expect(marks.body.items.filter((x: any) => x.id === quiz.id)).toHaveLength(1);
    expect((await u.a.post(`/api/quizzes/${quiz.id}/rating`).send({ rating: 5 })).status).toBe(403);
    await u.a.delete(`/api/quizzes/${quiz.id}/bookmark`);
    expect((await u.a.get('/api/me/bookmarks')).body.items).toHaveLength(0);
  });

  it('timed attempts auto-submit saved responses after expiry on the server', async () => {
    const creator = await register('Tim Tyme', 'tim@test.dev');
    const admin = await login('admin@quizsphere.local', 'Admin@123');
    const payload = allTypesQuiz(catGK, 'Timed Quiz');
    payload.timeLimit = 1;
    const created = await creator.a.post('/api/quizzes').send(payload);
    const id = created.body.quiz.id;
    await creator.a.post(`/api/me/quizzes/${id}/submit`);
    await admin.a.post(`/api/admin/submissions/${id}/approve`).send({});
    const u = await register('Uma Fast', 'uma@test.dev');
    const start = await u.a.post('/api/quizzes/timed-quiz/attempts');
    const attemptId = start.body.attempt.id;
    await u.a.patch(`/api/attempts/${attemptId}/responses`).send({ responses: [{ questionId: 'tq1', selectedOptionIds: ['b'], textAnswer: '' }] });
    // simulate the clock running out
    await store.attempts.update(attemptId, { startedAt: new Date(Date.now() - 10 * 60000).toISOString() });
    const got = await u.a.get(`/api/attempts/${attemptId}`);
    expect(got.body.attempt.status).toBe('submitted');
    const review = await u.a.get(`/api/me/attempts/${attemptId}/review`);
    expect(review.body.review.score).toBe(2);
  });

  it('suspended users are blocked from writing, then restored', async () => {
    const u = await register('Sid suspend', 'sid@test.dev');
    const admin = await login('admin@quizsphere.local', 'Admin@123');
    await admin.a.patch(`/api/admin/users/${u.user.id}`).send({ isSuspended: true });
    expect((await u.a.post('/api/quizzes/javascript-fundamentals/attempts')).status).toBe(403);
    await admin.a.patch(`/api/admin/users/${u.user.id}`).send({ isSuspended: false });
    expect([200, 201]).toContain((await u.a.post('/api/quizzes/javascript-fundamentals/attempts')).status);
  });
});
