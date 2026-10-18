import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Express } from 'express';
import request from 'supertest';
import { configureDb, closeDb, getDb } from '../server/src/db/index.js';

/**
 * Every test file gets its own throwaway database, so the suite never touches
 * the development database and never depends on seeded data.
 */
export function useTestDatabase(label: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `quizsphere-${label}-`));
  const file = path.join(dir, 'test.db');
  configureDb(file);
  return file;
}

export function closeTestDatabase(): void {
  closeDb();
}

let appInstance: Express | null = null;

export async function app(): Promise<Express> {
  if (!appInstance) {
    const mod = await import('../server/src/index.js');
    appInstance = mod.createApp();
  }
  return appInstance;
}

export interface Session {
  cookie: string;
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string;
    role: string;
    isAdmin: boolean;
    isCreator: boolean;
  };
}

export function agent() {
  return request.agent(appInstance as Express);
}

export async function register(
  handle: string,
  overrides: Partial<{ displayName: string; password: string }> = {},
): Promise<{ api: ReturnType<typeof agent>; session: Session }> {
  const express = await app();
  const api = request.agent(express);
  const res = await api.post('/api/auth/register').send({
    email: `${handle}@example.test`,
    username: handle,
    displayName: overrides.displayName ?? handle,
    password: overrides.password ?? 'Str0ngPassphrase',
  });
  if (res.status !== 201) {
    throw new Error(`register(${handle}) failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const raw = res.headers['set-cookie'] ?? [];
  const cookies = Array.isArray(raw) ? raw : [raw];
  const cookie = cookies.map((value: string) => value.split(';')[0]).join('; ');
  return { api, session: { cookie, user: res.body.user } };
}

/** Promote an account straight in the database (the CLI path is tested elsewhere). */
export async function makeAdmin(userId: string): Promise<void> {
  const { run } = await import('../server/src/db/index.js');
  run("UPDATE users SET role = 'admin', updated_at = datetime('now') WHERE id = ?", userId);
}

export async function setSetting(key: string, value: Record<string, unknown>): Promise<void> {
  const { setSetting: write } = await import('../server/src/lib/settings.js');
  write(key, value, null);
}

export function db() {
  return getDb();
}

/** Convenience: run a SQL query against the test database. */
export function query<T = Record<string, any>>(sql: string, ...params: any[]): T[] {
  return getDb().prepare(sql).all(...params) as unknown as T[];
}

export function one<T = Record<string, any>>(sql: string, ...params: any[]): T | undefined {
  return getDb().prepare(sql).get(...params) as unknown as T | undefined;
}

// ------------------------------------------------------------------ payloads

export function quizPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Capitals of Europe — a short quiz',
    summary: 'A three question test on European capital cities.',
    entryFee: 0,
    rewardCoins: 10,
    passingScore: 60,
    maxAttempts: 3,
    tags: [],
    questions: [
      {
        prompt: 'What is the capital of France?',
        type: 'single',
        points: 1,
        options: [
          { body: 'Paris', isCorrect: true },
          { body: 'Lyon', isCorrect: false },
          { body: 'Nice', isCorrect: false },
        ],
      },
      {
        prompt: 'What is the capital of Spain?',
        type: 'single',
        points: 1,
        options: [
          { body: 'Madrid', isCorrect: true },
          { body: 'Barcelona', isCorrect: false },
          { body: 'Seville', isCorrect: false },
        ],
      },
      {
        prompt: 'What is the capital of Italy?',
        type: 'single',
        points: 1,
        options: [
          { body: 'Rome', isCorrect: true },
          { body: 'Milan', isCorrect: false },
          { body: 'Turin', isCorrect: false },
        ],
      },
    ],
    ...overrides,
  };
}

export function pollPayload(overrides: Record<string, unknown> = {}) {
  return {
    question: 'Which city should host the next meetup?',
    options: ['Lisbon', 'Krakow', 'Tallinn'],
    closesInDays: 7,
    ...overrides,
  };
}
