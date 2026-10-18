# QuizSphere — Community Quiz Creation & Publishing Platform

QuizSphere is a **database-backed, moderation-first quiz platform**. Registered users build
quizzes on any subject (five question types, mixed freely, with a mandatory explanation per
question), submit them for **administrator approval**, and publish approved versions for the
community to discover, attempt, score, review, bookmark and rate. This is not a roadmap /
curriculum app — there are no learning roadmaps, enrollments or task tracking.

## Highlights

- **Quiz builder** — single choice, multiple choice (full-credit by default, opt-in partial
  credit), True/False, fill-in-the-blank (accepted variants, trim + configurable case),
  short answer (honestly labelled self-assessment / pending review — never fake auto-grading).
  Add / duplicate / reorder / delete questions, hints, images, safe code snippets, preview tab,
  live submission checklist.
- **Moderation workflow** — `DRAFT → PENDING_REVIEW → APPROVED`, plus `CHANGES_REQUESTED`,
  `REJECTED`, `UNPUBLISHED`, `ARCHIVED`. Feedback is mandatory for reject / Changes; creators
  edit and resubmit; every decision lands in an **audit log** + a creator **notification**.
- **Immutable versions** — editing a live quiz creates a new draft version; the public version
  only changes after re-approval. Attempts always review against the exact version attempted.
- **Server-side everything** — scoring, timers (auto-submit on expiry), ownership, admin
  checks, validation (Zod) all enforced on the API. Answer keys & explanations are never
  exposed pre-submission (except creator-enabled immediate mode, per checked question).
- **Discovery** — server-side multi-filter search (title/description/tags, category,
  subcategory, difficulty, language, question type, duration, question count, creator),
  4 sorts, pagination, filter values derived from actually-published quizzes.
- **Attempts** — autosave, resume, mark-for-review, question palette, optional shuffle
  (displayed order persisted), idempotent submit.
- **Dashboards** — learner analytics (average/best, score trend chart, history, bookmarks)
  and an admin console (queue, all quizzes, categories CRUD, reports, user suspension, logs).

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite + TypeScript, Tailwind CSS v4, shadcn/ui-style components (`components/ui`), Lucide, React Router, React Hook Form + Zod, Axios, Recharts |
| Backend | Node.js + Express + TypeScript, Mongoose (MongoDB Atlas), JWT in HTTP-only cookies, bcrypt, Zod, helmet, CORS allowlist, rate limiting, OpenAPI at `/api/openapi.json` (+ `/api/docs`) |
| Tests | Vitest + Supertest integration suite (13 tests) |

### Database: Atlas in production, file store for zero-config local dev

The API talks to the database through one **repository layer** (`apps/api/src/db/store.ts`):

- **`MONGODB_URI` set** → Mongoose models (`apps/api/src/db/models.ts`, with indexes/unique
  constraints) against MongoDB Atlas.
- **`MONGODB_URI` unset (local dev/tests)** → the same repositories backed by an in-memory
  store persisted to `apps/api/data/dev.json`, so the app runs with zero external services
  while exercising 100% of the same business logic. Set `QS_DATA_FILE=:memory:` for tests.

## Quick start

```bash
npm install
npm run dev        # API on :4000, web on :5173 (Vite proxies /api -> :4000)
```

Open http://localhost:5173. On first boot the API seeds categories, 5 published quizzes, a
pending submission, a changes-requested quiz, a draft, attempts and bookmarks.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Learner | `arjun@example.com` | `Learner@123` |
| Creator | `maya@example.com` | `Creator@123` |
| Admin | `admin@quizsphere.local` | `Admin@123` |

(One-click demo logins are on the login page.)

### Scripts

```bash
npm run dev          # both apps (concurrently)
npm run dev:api      # API only        npm run dev:web   # web only
npm test             # API integration tests (in-memory store)
npm run build        # type-safe production builds for both apps
npm run typecheck    # tsc --noEmit for both apps
npm run seed         # seed-if-empty (also runs automatically on API boot)
```

To reset local data, delete `apps/api/data/dev.json` and restart the API.

## Environment

Copy `.env.example` → `apps/api/.env` (and `apps/web/.env` if needed):

| Variable | Where | Purpose |
|---|---|---|
| `PORT` | API | Default `4000` (Render sets this) |
| `MONGODB_URI` | API | Atlas connection string; empty = local file store |
| `JWT_SECRET` | API | **Change in production** |
| `FRONTEND_URL` | API | CORS allowlist origin (your Vercel URL) |
| `SEED_ON_BOOT` | API | Seed demo data when the DB is empty (`true`/demo only) |
| `VITE_API_URL` | Web | Leave empty: browser calls use relative `/api` (Vite proxy / Vercel rewrite). Only set if you cannot proxy. |

No secrets are ever exposed to the frontend bundle.

## Deployment

**Database — MongoDB Atlas:** create a cluster, allow Render's egress (or `0.0.0.0/0` for the
demo), create a DB user, copy the connection string into `MONGODB_URI`.

**Backend — Render:** `render.yaml` is included (build `npm install && npm run build -w
apps/api`, start `npm run start -w apps/api`). Set `NODE_ENV=production`, `MONGODB_URI`,
`JWT_SECRET`, `FRONTEND_URL`. `GET /api/health` is the health check.

**Frontend — Vercel:** import the repo, build command `npm run build -w apps/web`, output
`apps/web/dist`. Edit `vercel.json` to point the `/api/*` rewrite at your Render URL so the
browser stays same-origin (keeps the HTTP-only cookie first-party) — no `VITE_API_URL` needed.

## Tests

`npm test` runs the integration suite (real HTTP through the Express app, in-memory store):
auth & role-escalation guards, forgot/reset, answer-key privacy, per-type validation,
ownership, the full create → Changes requested → resubmit → approve → attempt → score
lifecycle (exact expected score for every question type), duplicate-submit idempotency,
version integrity after re-approval, unpublish/restore semantics, multi-filter discovery,
bookmark uniqueness, rating gating, timer auto-submit, and user suspension.

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — data model, versioning & state machine,
  scoring policy, API map, security notes, scaling notes.
- OpenAPI: `GET /api/openapi.json` (43 documented paths).

## Repository layout

```
apps/api   Express + TS API (routes/, lib/scoring.ts, lib/validation.ts, db/models.ts, db/seed.ts, tests/)
apps/web   React + Vite SPA (pages/, components/ui = shadcn/ui-style primitives, components/, lib/, contexts/)
docs/      Architecture notes
render.yaml, vercel.json   deployment templates
```
