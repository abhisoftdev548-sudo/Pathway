import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/db/connect.js';
import { Enrollment } from '../src/models/Enrollment.js';
import { ModuleModel } from '../src/models/Module.js';
import { Roadmap } from '../src/models/Roadmap.js';
import { Task } from '../src/models/Task.js';
import { TaskProgress } from '../src/models/TaskProgress.js';
import { Topic } from '../src/models/Topic.js';
import { User } from '../src/models/User.js';

const app = createApp();
const password = 'Learner_Pass_123!';

async function resetDatabase() {
  if (!mongoose.connection.name.includes('test')) {
    throw new Error(`Refusing to wipe database "${mongoose.connection.name}"`);
  }
  await Promise.all([
    User.deleteMany({}),
    Roadmap.deleteMany({}),
    ModuleModel.deleteMany({}),
    Topic.deleteMany({}),
    Task.deleteMany({}),
    Enrollment.deleteMany({}),
    TaskProgress.deleteMany({}),
  ]);
}

async function session(email = `learner-${Date.now()}@example.com`) {
  const agent = request.agent(app);
  const csrf = await agent.get('/api/auth/csrf').expect(200);
  const registered = await agent
    .post('/api/auth/register')
    .send({ name: 'Test Learner', email, password, timezone: 'UTC', dailyGoalMinutes: 45 })
    .expect(201);
  return { agent, email, csrf: csrf.body.csrfToken as string, user: registered.body.user };
}

async function publishMiniRoadmap(slug: string) {
  const roadmap = await Roadmap.create({
    title: 'Mini roadmap',
    slug,
    tagline: 'A tiny curriculum for tests',
    description: 'Two published tasks used to verify enrollment, locking and progress math.',
    category: 'Testing',
    difficulty: 'beginner',
    published: true,
    publishedAt: new Date(),
    estimatedDuration: { minWeeks: 1, maxWeeks: 1, totalHours: 1 },
  });
  const module = await ModuleModel.create({
    roadmapId: roadmap._id,
    key: 'm1',
    title: 'Foundations',
    description: 'The first module.',
    order: 1,
    published: true,
  });
  const topic = await Topic.create({
    roadmapId: roadmap._id,
    moduleId: module._id,
    key: 'm1-t1',
    title: 'First topic',
    description: 'One short topic.',
    order: 1,
    estimatedDuration: 40,
    published: true,
  });
  const first = await Task.create({
    roadmapId: roadmap._id,
    moduleId: module._id,
    topicId: topic._id,
    key: 'm1-t1-learn',
    title: 'Read the overview',
    description: 'Read the short overview and note the vocabulary you will use later.',
    type: 'learn',
    difficulty: 'beginner',
    estimatedDuration: 10,
    instructions: 'Read the overview once, slowly.',
    acceptanceCriteria: ['You can explain the idea in one sentence.'],
    order: 1,
    published: true,
  });
  const quiz = await Task.create({
    roadmapId: roadmap._id,
    moduleId: module._id,
    topicId: topic._id,
    key: 'm1-t1-quiz',
    title: 'Check the vocabulary',
    description: 'Answer the two questions before the topic is considered finished.',
    type: 'quiz',
    difficulty: 'beginner',
    estimatedDuration: 30,
    instructions: 'Choose the best answer for each question.',
    acceptanceCriteria: ['Both answers submitted.'],
    prerequisites: [first._id],
    quizQuestions: [
      { question: 'Which of these is software?', options: ['A keyboard', 'A compiler'], correctOptionIndex: 1, explanation: 'A compiler is software.' },
      { question: 'What is firmware?', options: ['Software stored on a device', 'A type of cable'], correctOptionIndex: 0, explanation: 'Firmware lives on the device.' },
    ],
    order: 2,
    published: true,
  });
  return { roadmap, module, topic, first, quiz };
}

describe('API', () => {
  beforeAll(async () => {
    await connectDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('reports a healthy database and rejects unknown routes', async () => {
    const health = await request(app).get('/api/health').expect(200);
    expect(health.body).toMatchObject({ status: 'ok', database: 'connected' });
    const missing = await request(app).get('/api/does-not-exist').expect(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
  });

  it('never accepts a role from the client and keeps sessions in cookies', async () => {
    const agent = request.agent(app);
    const created = await agent
      .post('/api/auth/register')
      .send({ name: 'Ada Learner', email: 'ada@example.com', password, role: 'admin' })
      .expect(201);
    expect(created.body.user.role).toBe('user');
    expect(created.headers['set-cookie']?.join(';')).toMatch(/pf_access/);
    expect(created.body.user.passwordHash).toBeUndefined();

    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.user.email).toBe('ada@example.com');
    await request(app).get('/api/me/dashboard').expect(401);
    await agent.get('/api/admin/overview').expect(403);

    const weak = await request(app).post('/api/auth/register').send({ name: 'Weak User', email: 'weak@example.com', password: 'password' });
    expect(weak.status).toBe(400);
  });

  it('initializes progress, locks quizzes, and recalculates after reopen', async () => {
    const { agent } = await session('progress@example.com');
    const csrf = (await agent.get('/api/auth/csrf')).body.csrfToken as string;
    const { roadmap, first, quiz } = await publishMiniRoadmap('mini-progress');

    await agent.post(`/api/roadmaps/${roadmap.slug}/enroll`).send({ learningPace: 'standard' }).expect(403);

    const enrolled = await agent
      .post(`/api/roadmaps/${roadmap.slug}/enroll`)
      .set('x-csrf-token', csrf)
      .send({ learningPace: 'relaxed' })
      .expect(201);
    expect(enrolled.body.curriculumTaskCount).toBe(2);
    expect(enrolled.body.dailyPlanMinutes).toBe(20);
    expect(await TaskProgress.countDocuments({ taskId: { $in: [first._id, quiz._id] } })).toBe(2);

    const locked = await agent.post(`/api/me/tasks/${quiz._id}/quiz-attempt`).set('x-csrf-token', csrf).send({ answers: [1, 0] });
    expect(locked.status).toBe(409);

    const completed = await agent
      .post(`/api/me/tasks/${first._id}/complete`)
      .set('x-csrf-token', csrf)
      .send({ actualDuration: 12 })
      .expect(200);
    expect(completed.body.summary.roadmapPercent).toBe(50);
    expect(completed.body.summary.completedTasks).toBe(1);

    const attempt = await agent
      .post(`/api/me/tasks/${quiz._id}/quiz-attempt`)
      .set('x-csrf-token', csrf)
      .send({ answers: [1, 0] })
      .expect(200);
    expect(attempt.body.score).toBe(2);

    const finished = await agent.post(`/api/me/tasks/${quiz._id}/complete`).set('x-csrf-token', csrf).send({ quizAnswers: [1, 0] }).expect(200);
    expect(finished.body.summary.roadmapPercent).toBe(100);
    expect(finished.body.roadmapCompleted).toBe(true);

    const mine = await agent.get('/api/me/roadmaps').expect(200);
    expect(mine.body.overall.percent).toBe(100);
    expect(mine.body.counts.completed).toBe(1);

    const reopened = await agent.post(`/api/me/tasks/${quiz._id}/reopen`).set('x-csrf-token', csrf).expect(200);
    expect(reopened.body.summary.roadmapPercent).toBe(50);
    expect(reopened.body.task.status).toBe('in_progress');
    const record = await TaskProgress.findOne({ taskId: quiz._id });
    expect(record?.completedAt).toBeNull();
    expect(record?.firstCompletedAt).toBeTruthy();

    const after = await agent.get('/api/me/roadmaps').expect(200);
    expect(after.body.overall.percent).toBe(25);
    expect(after.body.counts.completed).toBe(0);
  });

  it('shows a task published after enrollment without losing earlier progress', async () => {
    const { agent } = await session('curriculum@example.com');
    const csrf = (await agent.get('/api/auth/csrf')).body.csrfToken as string;
    const { roadmap, module, topic, first } = await publishMiniRoadmap('mini-update');
    await agent.post(`/api/roadmaps/${roadmap.id}/enroll`).set('x-csrf-token', csrf).send({ learningPace: 'standard' }).expect(201);
    await agent.post(`/api/me/tasks/${first._id}/complete`).set('x-csrf-token', csrf).send({}).expect(200);

    const added = await Task.create({
      roadmapId: roadmap._id,
      moduleId: module._id,
      topicId: topic._id,
      key: 'm1-t1-practice',
      title: 'Try it yourself',
      description: 'A task published after the learner had already enrolled.',
      type: 'practice',
      difficulty: 'beginner',
      estimatedDuration: 20,
      instructions: 'Apply the idea to a new example.',
      acceptanceCriteria: ['The example is finished.'],
      order: 3,
      published: true,
    });

    const list = await agent.get('/api/me/tasks').expect(200);
    const ids = list.body.items.map((item: { id: string }) => item.id);
    expect(ids).toContain(String(added._id));
    expect(ids).toContain(String(first._id));
    expect(await TaskProgress.exists({ taskId: added._id })).toBeTruthy();

    const mine = await agent.get('/api/me/roadmaps').expect(200);
    expect(mine.body.items[0].completedTasks).toBe(1);
    expect(mine.body.items[0].totalTasks).toBe(3);
    expect(mine.body.overall.percent).toBeCloseTo(16.7, 1);
  });

  it('excludes archived enrollments from the overall percentage', async () => {
    const { agent, user } = await session('archive@example.com');
    const csrf = (await agent.get('/api/auth/csrf')).body.csrfToken as string;
    const { roadmap, first } = await publishMiniRoadmap('mini-archive');
    const enrolled = await agent
      .post(`/api/roadmaps/${roadmap.slug}/enroll`)
      .set('x-csrf-token', csrf)
      .send({ learningPace: 'standard' })
      .expect(201);
    await agent.post(`/api/me/tasks/${first._id}/complete`).set('x-csrf-token', csrf).send({}).expect(200);

    await agent.delete(`/api/me/roadmaps/${enrolled.body.enrollmentId}`).set('x-csrf-token', csrf).expect(200);
    const mine = await agent.get('/api/me/roadmaps').expect(200);
    expect(mine.body.counts.archived).toBe(1);
    expect(mine.body.overall.totalTasks).toBe(0);
    expect(mine.body.overall.percent).toBe(0);
    expect(await TaskProgress.countDocuments({ userId: user.id, taskId: first._id })).toBe(1);
  });
});
