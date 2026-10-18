import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { config } from '../config.js';
import type { User, Category, Quiz, QuizVersion, QuizAttempt, Bookmark, ModerationLog, QuizReport, Notification, QuizRating } from '../types.js';
import { MODELS } from './models.js';

type WithId = { id: string };
export interface Collection<T extends WithId> {
  all(): Promise<T[]>;
  byId(id: string): Promise<T | null>;
  find(pred: (d: T) => boolean): Promise<T[]>;
  findOne(pred: (d: T) => boolean): Promise<T | null>;
  insert(doc: T): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T | null>;
  remove(id: string): Promise<boolean>;
  count(pred?: (d: T) => boolean): Promise<number>;
}
export interface Store {
  kind: 'file' | 'memory' | 'mongo';
  users: Collection<User>; categories: Collection<Category>; quizzes: Collection<Quiz>;
  versions: Collection<QuizVersion>; attempts: Collection<QuizAttempt>; bookmarks: Collection<Bookmark>;
  moderationLogs: Collection<ModerationLog>; reports: Collection<QuizReport>;
  notifications: Collection<Notification>; ratings: Collection<QuizRating>;
  ready(): Promise<void>;
}

const NAMES = ['users', 'categories', 'quizzes', 'versions', 'attempts', 'bookmarks', 'moderationLogs', 'reports', 'notifications', 'ratings'] as const;
type Name = (typeof NAMES)[number];

/** In-memory collections persisted to a JSON file. Used for local dev / tests
 *  when MONGODB_URI is not configured. Production uses MongoStore (Atlas). */
class MemoryStore implements Store {
  kind: 'file' | 'memory';
  users!: Collection<User>; categories!: Collection<Category>; quizzes!: Collection<Quiz>;
  versions!: Collection<QuizVersion>; attempts!: Collection<QuizAttempt>; bookmarks!: Collection<Bookmark>;
  moderationLogs!: Collection<ModerationLog>; reports!: Collection<QuizReport>;
  notifications!: Collection<Notification>; ratings!: Collection<QuizRating>;
  private data: Record<Name, WithId[]> = Object.fromEntries(NAMES.map(n => [n, []])) as unknown as Record<Name, WithId[]>;
  private file: string | null;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(file: string | null) { this.file = file; this.kind = file ? 'file' : 'memory'; this.build(); }
  private persist() {
    if (!this.file) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(async () => {
      try { await fs.mkdir(path.dirname(this.file!), { recursive: true }); await fs.writeFile(this.file!, JSON.stringify(this.data, null, 2)); }
      catch (e) { console.error('[store] persist failed', e); }
    }, 30);
  }
  private build() {
    for (const name of NAMES) {
      const col: Collection<any> = {
        all: async () => structuredClone(this.data[name]),
        byId: async (docId: string) => { const d = this.data[name].find(x => x.id === docId); return d ? structuredClone(d) : null; },
        find: async (pred: any) => structuredClone(this.data[name].filter(pred)),
        findOne: async (pred: any) => { const d = this.data[name].find(pred); return d ? structuredClone(d) : null; },
        insert: async (doc: any) => { this.data[name].push(structuredClone(doc)); this.persist(); return structuredClone(doc); },
        update: async (docId: string, patch: any) => {
          const i = this.data[name].findIndex(x => x.id === docId); if (i < 0) return null;
          this.data[name][i] = { ...this.data[name][i], ...structuredClone(patch) }; this.persist();
          return structuredClone(this.data[name][i]);
        },
        remove: async (docId: string) => { const before = this.data[name].length; this.data[name] = this.data[name].filter(x => x.id !== docId); this.persist(); return this.data[name].length !== before; },
        count: async (pred?: any) => pred ? this.data[name].filter(pred).length : this.data[name].length,
      };
      (this as any)[name] = col;
    }
  }
  async ready() {
    if (!this.file) return;
    try { const raw = await fs.readFile(this.file, 'utf8'); const parsed = JSON.parse(raw); for (const n of NAMES) this.data[n] = Array.isArray(parsed[n]) ? parsed[n] : []; }
    catch { /* first boot */ }
  }
}

function clean(doc: any) { if (!doc) return null; const { _id, __v, ...rest } = doc; return rest; }
class MongoStore implements Store {
  kind = 'mongo' as const;
  users!: Collection<User>; categories!: Collection<Category>; quizzes!: Collection<Quiz>;
  versions!: Collection<QuizVersion>; attempts!: Collection<QuizAttempt>; bookmarks!: Collection<Bookmark>;
  moderationLogs!: Collection<ModerationLog>; reports!: Collection<QuizReport>;
  notifications!: Collection<Notification>; ratings!: Collection<QuizRating>;
  constructor() {
    for (const name of NAMES) {
      const Model = MODELS[name];
      const col: Collection<any> = {
        all: async () => (await Model.find().lean()).map(clean),
        byId: async (docId: string) => clean(await Model.findOne({ id: docId }).lean()),
        find: async (pred: any) => (await Model.find().lean()).map(clean).filter(pred),
        findOne: async (pred: any) => (await Model.find().lean()).map(clean).find(pred) ?? null,
        insert: async (doc: any) => clean((await Model.create(doc)).toObject()),
        update: async (docId: string, patch: any) => clean(await Model.findOneAndUpdate({ id: docId }, { $set: patch }, { new: true }).lean()),
        remove: async (docId: string) => (await Model.deleteOne({ id: docId })).deletedCount > 0,
        count: async (pred?: any) => { const all = (await Model.find().lean()).map(clean); return pred ? all.filter(pred).length : all.length; },
      };
      (this as any)[name] = col;
    }
  }
  async ready() {
    if (mongoose.connection.readyState === 0) await mongoose.connect(config.mongoUri);
    console.log('[db] connected to MongoDB');
  }
}

export function createStore(): Store {
  if (config.mongoUri) return new MongoStore();
  const envFile = config.dataFile;
  if (envFile === ':memory:') return new MemoryStore(null);
  const here = path.dirname(fileURLToPath(import.meta.url));
  const file = envFile || path.resolve(here, '../../data/dev.json');
  return new MemoryStore(file);
}
