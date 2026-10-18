import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type Row = Record<string, any>;

const here = path.dirname(fileURLToPath(import.meta.url));

let dbInstance: DatabaseSync | null = null;
let dbPathOverride: string | null = null;

export function configureDb(p: string): void {
  dbPathOverride = p;
}

/** Resolve the database file location. */
export function resolveDbPath(): string {
  if (dbPathOverride) return dbPathOverride;
  const fromEnv = process.env.QUIZSPHERE_DB;
  if (fromEnv) return path.resolve(process.cwd(), fromEnv);
  return path.resolve(process.cwd(), 'data/quizsphere.db');
}

function openDb(): DatabaseSync {
  const file = resolveDbPath();
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec('PRAGMA synchronous = NORMAL;');
  return db;
}

export function getDb(): DatabaseSync {
  if (!dbInstance) dbInstance = openDb();
  return dbInstance;
}

/** Close and forget the current connection (used by tests). */
export function closeDb(): void {
  try {
    dbInstance?.close();
  } catch {
    /* already closed */
  }
  dbInstance = null;
}

// ------------------------------------------------------------------ params

type Param = string | number | bigint | null | boolean | undefined;

function normalizeParams(params: readonly Param[]): (string | number | bigint | null)[] {
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p;
  });
}

// ------------------------------------------------------------------ queries

export function all<T = Row>(sql: string, ...params: Param[]): T[] {
  return getDb().prepare(sql).all(...normalizeParams(params)) as unknown as T[];
}

export function get<T = Row>(sql: string, ...params: Param[]): T | undefined {
  return getDb().prepare(sql).get(...normalizeParams(params)) as unknown as T | undefined;
}

export function run(sql: string, ...params: Param[]): { changes: number; lastInsertRowid: number } {
  return getDb().prepare(sql).run(...normalizeParams(params)) as unknown as {
    changes: number;
    lastInsertRowid: number;
  };
}

export function value<T = number>(sql: string, ...params: Param[]): T | undefined {
  const row = get<Record<string, T>>(sql, ...params);
  if (!row) return undefined;
  return row[Object.keys(row)[0]] as T;
}

/** Count helper. Returns 0 (not undefined) when the table is empty. */
export function count(sql: string, ...params: Param[]): number {
  const v = value<number>(sql, ...params);
  return typeof v === 'number' ? v : 0;
}

export function exec(sql: string): void {
  getDb().exec(sql);
}

// ------------------------------------------------------------------ transactions

const depth = { value: 0 };

/**
 * Run `fn` inside a transaction. Nested calls reuse the outer transaction
 * (SQLite has no real nested transactions).
 */
export function tx<T>(fn: () => T): T {
  const db = getDb();
  if (depth.value > 0) return fn();
  depth.value += 1;
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    depth.value -= 1;
  }
}

// ------------------------------------------------------------------ helpers

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return crypto.randomUUID();
}

export function schemaSql(): string {
  return fs.readFileSync(path.join(here, 'schema.sql'), 'utf8');
}
