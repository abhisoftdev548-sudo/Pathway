import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app, closeTestDatabase, makeAdmin, pollPayload, quizPayload, register, setSetting, useTestDatabase } from './helpers';

useTestDatabase('content');

let admin: Awaited<ReturnType<typeof register>>;
let creator: Awaited<ReturnType<typeof register>>;
let player: Awaited<ReturnType<typeof register>>;

beforeAll(async () => {
  await app();
  admin = await register('content_admin');
  await makeAdmin(admin.session.user.id);
  creator = await register('content_creator');
  player = await register('content_player');
});

afterAll(() => closeTestDatabase());

describe('quiz creation rules', () => {
  it('rejects a quiz with fewer questions than the configured minimum', async () => {
    await setSetting('quiz_rules', {
      min_questions: 3,
      max_questions: 50,
      min_options_per_question: 2,
      max_options_per_question: 6,
      max_title_length: 120,
      max_entry_fee: 100,
      max_reward_coins: 500,
      default_passing_score: 60,
      max_time_limit_minutes: 120,
      max_attempts_per_quiz: 5,
      require_approval: true,
    });

    const res = await creator.api.post('/api/quizzes').send(
      quizPayload({ questions: quizPayload().questions.slice(0, 2) }),
    );
    expect(res.status).toBe(422);
    expect(res.body.details?.questions).toBeTruthy();
  });

  it('rejects an entry fee above the configured maximum', async () => {
    const res = await creator.api.post('/api/quizzes').send(quizPayload({ entryFee: 5000 }));
    expect(res.status).toBe(422);
    expect(res.body.details?.entryFee).toBeTruthy();
  });

  it('validates on the server even when the client is bypassed', async () => {
    const res = await creator.api.post('/api/quizzes').send({ title: 'x' });
    expect(res.status).toBe(422);
  });
});

describe('quiz approval workflow', () => {
  let quizId: string;

  it('keeps a new quiz out of the public list until it is approved', async () => {
    const created = await creator.api.post('/api/quizzes').send(quizPayload({ title: 'Workflow approval quiz' }));
    expect(created.status).toBe(201);
    quizId = created.body.id as string;
    expect(created.body.quiz.status).toBe('draft');

    const browse = await player.api.get('/api/quizzes?q=Workflow%20approval');
    expect(browse.body.items.map((item: { id: string }) => item.id)).not.toContain(quizId);
  });

  it('places a submitted quiz in the moderation queue', async () => {
    const submitted = await creator.api.post(`/api/quizzes/${quizId}/submit`);
    expect(submitted.status).toBe(200);

    const queue = await admin.api.get('/api/admin/content/queue');
    const ids = queue.body.items.map((item: { id: string }) => item.id);
    expect(ids).toContain(quizId);
  });

  it('requires a reason to reject and records it in the moderation history', async () => {
    const tooShort = await admin.api.post(`/api/admin/content/quizzes/${quizId}/reject`).send({ reason: 'no' });
    expect(tooShort.status).toBe(422);

    const rejected = await admin.api
      .post(`/api/admin/content/quizzes/${quizId}/reject`)
      .send({ reason: 'Questions 2 and 3 duplicate an existing quiz.' });
    expect(rejected.status).toBe(200);

    const history = await admin.api.get('/api/admin/moderation/history?contentType=quiz');
    const decision = history.body.items.find((item: { content_id: string }) => item.content_id === quizId);
    expect(decision.decision).toBe('rejected');
    expect(decision.reason).toContain('duplicate');
  });

  it('lets a creator resubmit and tracks the new version', async () => {
    const resubmitted = await creator.api.post(`/api/quizzes/${quizId}/submit`);
    expect(resubmitted.status).toBe(200);

    const full = await admin.api.get(`/api/admin/content/quizzes/${quizId}`);
    expect(full.body.item.status).toBe('pending_review');
    expect(full.body.item.history.length).toBeGreaterThan(1);
  });

  it('publishes the quiz on approval and records the quality rating', async () => {
    const approved = await admin.api
      .post(`/api/admin/content/quizzes/${quizId}/approve`)
      .send({ qualityRating: 4, notes: 'Clean formatting and unambiguous answers.' });
    expect(approved.status).toBe(200);

    const browse = await player.api.get('/api/quizzes?q=Workflow%20approval');
    expect(browse.body.items.map((item: { id: string }) => item.id)).toContain(quizId);

    const detail = await admin.api.get(`/api/admin/content/quizzes/${quizId}`);
    expect(detail.body.item.quality_rating).toBe(4);
  });

  it('rejects a second approval of already published content', async () => {
    const res = await admin.api.post(`/api/admin/content/quizzes/${quizId}/approve`).send({});
    expect(res.status).toBe(409);
  });

  it('writes an audit record for every decision', async () => {
    const logs = await admin.api.get(`/api/admin/audit/logs?targetType=quiz&action=moderation.approved`);
    expect(logs.body.items.length).toBeGreaterThan(0);
  });
});

describe('poll lifecycle', () => {
  it('runs a poll through submission, approval and voting', async () => {
    const created = await creator.api.post('/api/polls').send(pollPayload());
    expect(created.status).toBe(201);
    const pollId = created.body.id as string;

    const submitted = await creator.api.post(`/api/polls/${pollId}/submit`);
    expect(submitted.status).toBe(200);

    const approved = await admin.api.post(`/api/admin/content/polls/${pollId}/approve`).send({});
    expect(approved.status).toBe(200);

    const before = await player.api.get(`/api/polls/${pollId}`);
    const optionId = before.body.poll.options[0].id as string;

    const voted = await player.api.put(`/api/polls/${pollId}/vote`).send({ optionIds: [optionId] });
    expect(voted.status).toBe(200);

    const after = await player.api.get(`/api/polls/${pollId}`);
    const total = after.body.poll.options.reduce(
      (sum: number, option: { votes: number }) => sum + option.votes,
      0,
    );
    expect(total).toBe(1);
  });

  it('rejects a poll with duplicate options', async () => {
    const res = await creator.api.post('/api/polls').send(pollPayload({ options: ['Same', 'Same'] }));
    expect(res.status).toBe(422);
  });
});
