# QuizSphere

A production-grade quiz and poll platform with a strictly **virtual QCoin economy** — no real-money payments, no cash withdrawals, no user-to-user transfers. QuizSphere is designed to run honestly on a completely empty database: the landing page stays polished, stats that would be zero are omitted entirely, and **no fabricated users, quizzes, ratings, rankings, transactions, or analytics are ever shown**.

## Features

### For participants
- Discover and search quizzes and polls (category, difficulty, status filters)
- Timed quiz attempts with server-verified scoring (5 question types: single choice, multiple choice, true/false, integer, short answer)
- Poll participation (single or multiple vote), with live results or hidden-until-end modes
- Ratings & reviews with creator replies, edit windows, and Wilson/Bayesian aggregates
- Achievements and streaks (only real unlocks are displayed)
- Leaderboards (performance, consistency, creators) with honest empty states
- QCoin wallet with an immutable transaction ledger

### For creators
- Full quiz builder (5 question types, answer keys, explanations, optional multi-category tags)
- Full poll builder (options, voting type, anonymity, results visibility, scheduling)
- Draft / pending / changes-requested / published workflow with change notes
- Optional QCoin entry fees, optional rewards (pass-based, top-percent, first-N, random draw), pool caps
- Per-quiz analytics (attempts, pass rate, question accuracy) — rendered only from real data
- Feedback page with received ratings and reviews

### For administrators
- Content moderation: approve / reject / request changes / unpublish, with permanent history and notes
- Admin quality ratings (1–5) stored **separately** from community ratings
- User management: suspend/restore, role changes, QCoin adjustments — every action requires a reason and is audited
- Report queues (content + users) with documented resolutions
- QCoin ledger inspector and suspicious-transaction review (reward velocity, large adjustments)
- Reward and entry-fee policy configuration, notification broadcast + templates
- Platform settings, audit logs, live system diagnostics

### Security & integrity
- Access JWT (~15 min, memory-only) + opaque refresh token in an HttpOnly cookie, rotated on every use, with token-family reuse detection
- CSRF double-submit (`qs_csrf` cookie + `X-CSRF-Token` header) for cookie-authenticated endpoints
- Explicit Origin allowlist for state-changing requests; CORS allowlist; Helmet headers
- Zod validation on every input; `express-mongo-sanitize` + `hpp` against NoSQL injection and parameter pollution
- Rate limiting (strict on auth endpoints)
- Role-based authorization on the **backend** for every action (hidden buttons are never the security boundary)
- Idempotent reward payouts (per attempt/vote), conditional `wallet` updates, and an immutable ledger (entries are corrected only by new adjustment entries)

## Tech stack

| Layer | Tech |
| --- | --- |
| Frontend | React 19 + TypeScript (strict), Vite, TanStack Query, React Router 7, Tailwind CSS 4, framer-motion, Recharts, lucide-react |
| Backend | Node.js (ES modules), Express 5, Mongoose 8, Zod, JWT (jose), bcrypt, Helmet, express-rate-limit |
| Database | MongoDB (MongoDB Atlas in production) |
| Storage | Cloudinary (quiz cover images) |
| Tests | Vitest (unit + HTTP-layer + DB-gated integration suite) |

## Repository layout

```
client/            React SPA (Vite + TypeScript)
  src/utils        design tokens, constants, formatting
  src/services     typed API client + endpoint wrappers
  src/components   UI system (Button, Form, Data, Feedback, Menu, Overlay)
  src/layouts      Landing / App / Auth shells
  src/pages        all feature pages (user, creator, admin)
  src/routes       single route table
server/            Express API (ESM JavaScript)
  src/config       env validation, Mongo, Cloudinary
  src/models       16 Mongoose models
  src/middleware   auth, CSRF, rate limit, validation, dbGuard, errors
  src/services     business logic (wallet, scoring, moderation, …)
  src/controllers  HTTP handlers
  src/routes       routers per domain
  src/jobs         scheduled jobs (stale-attempt expiry)
  tests/           vitest suites
```

## Quick start (local development)

Prerequisites: Node.js ≥ 20, npm ≥ 10, and a MongoDB connection (local `mongod`, Docker, or an Atlas free cluster).

```bash
# 1. Install dependencies
cd server && npm install
cd ../client && npm install

# 2. Configure the API (copy and edit; secrets are NEVER committed)
cd ../server
cp .env.example .env
#   MONGODB_URI, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET are required
#   generate secrets with:  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# 3. Run the API (port 5000)
npm run dev

# 4. Run the SPA (port 5173, proxies /api to :5000)
cd ../client
npm run dev
```

Open http://localhost:5173. The first registered account is bootstrapped as `ADMIN` when `BOOTSTRAP_FIRST_ADMIN=true` (default in development).

### Honest degraded mode (no database)

If MongoDB is unreachable, set `ALLOW_DB_DEGRADED=1` (development only) and the API still boots: `/api/v1/health` and static documents answer normally, and every persistence route returns a clear `503 DB_UNAVAILABLE` envelope. The SPA shows honest error/empty states — it never invents placeholder data.

## Testing

```bash
cd server
npm test                 # unit + HTTP-layer suites (no DB required)
MONGODB_TEST_URI=mongodb://127.0.0.1:27017/quizsphere-test npm test   # + full API lifecycle integration suite
```

Current result: **85 passing tests** (wallet rules 20, scoring 19, validators 17, rating math 13, HTTP layer 15, integration 1 placeholder) with **11 integration tests skipped** unless `MONGODB_TEST_URI` is provided. The integration suite covers registration/login/refresh/logout, quiz draft→review→publish, server-verified attempts, duplicate-submission protection, self-rating prevention, ledger and audit-log integrity.

## Deployment

Never commit `.env`. Configure the variables below in your hosting dashboards.

### 1. MongoDB Atlas (database)

1. Create a free M0 cluster → database `quizsphere`.
2. Database Access → create a user with read/write on that database.
3. Network Access → allow your API host IPs (or `0.0.0.0/0` with a strong user + TLS).
4. Copy the connection string: `mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/quizsphere?retryWrites=true&w=majority`.

### 2. Render (API backend)

1. New → Web Service → connect this repo → root directory `server`.
2. Build command `npm install`; start command `npm start`.
3. Environment variables:

| Variable | Value |
| --- | --- |
| `MONGODB_URI` | Atlas connection string (above) |
| `ACCESS_TOKEN_SECRET` | long random string (≥ 32 chars) |
| `REFRESH_TOKEN_SECRET` | different long random string |
| `CLIENT_ORIGIN` | `https://your-app.vercel.app` |
| `VERCEL_ORIGINS` | same as `CLIENT_ORIGIN` |
| `RENDER_ORIGINS` | `https://your-api.onrender.com` |
| `CLOUDINARY_URL` | `cloudinary://API_KEY:API_SECRET:CLOUD_NAME` (or the discrete vars) |
| `NODE_ENV` | `production` |
| `BOOTSTRAP_FIRST_ADMIN` | `true` only for the very first deploy, then `false` |

4. Health check path: `/api/v1/health`.

### 3. Vercel (frontend)

1. Import the repo → framework **Vite** → root directory `client`.
2. Build `npm run build`, output `dist`.
3. Environment variables:

| Variable | Value |
| --- | --- |
| `VITE_API_BASE_URL` | `https://your-api.onrender.com/api/v1` |

4. The SPA uses relative URLs for the API by default (same-origin proxying works out of the box). In production set `VITE_API_BASE_URL` to the absolute Render URL; CORS on the API already allows the configured origins.

### 4. Cloudinary (cover images)

1. Create a free Cloudinary account → copy Cloud name, API key, API secret.
2. Set `CLOUDINARY_URL` (or `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`) on the API service.
3. Quiz covers are uploaded via `/api/v1/quizzes/:id/cover`; Cloudinary transformations keep payloads small.

### 5. First-run checklist

- [ ] `/api/v1/health` returns `{ success: true, data: { status: 'ok' } }`
- [ ] Register the first account → it receives the `ADMIN` role and the signup bonus
- [ ] Set `BOOTSTRAP_FIRST_ADMIN=false` afterwards
- [ ] Create categories on the admin page
- [ ] Configure reward/entry-fee limits (or accept the documented defaults)
- [ ] Submit a test quiz through the full review flow, then a test attempt
- [ ] Verify the wallet ledger and audit log entries appear
- [ ] Point a status monitor at `/api/v1/health`

## Environment variables (server)

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `MONGODB_URI` | yes | — | Mongo connection string |
| `ACCESS_TOKEN_SECRET` | yes | — | JWT signing secret (access) |
| `REFRESH_TOKEN_SECRET` | yes | — | JWT signing secret (refresh family) |
| `PORT` | no | `5000` | API port |
| `NODE_ENV` | no | `development` | `production` hardens error messages/cookies |
| `CLIENT_ORIGIN` | no | `http://localhost:5173` | comma-separated allowed origins |
| `VERCEL_ORIGINS` / `RENDER_ORIGINS` | no | — | extra allowed origins |
| `BOOTSTRAP_FIRST_ADMIN` | no | `false` | first registered user becomes admin |
| `ACCESS_TOKEN_TTL_MIN` | no | `15` | access-token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | no | `30` | refresh-session lifetime |
| `RATE_LIMIT_MAX_REQUESTS` | no | `300` | per-15-minute general limit |
| `AUTH_RATE_LIMIT_MAX` | no | `20` | per-15-minute auth limit |
| `CLOUDINARY_URL` | for covers | — | Cloudinary credentials |
| `ALLOW_DB_DEGRADED` | no | — | `1` = boot without DB (development only) |
| `MONGODB_TEST_URI` | for integration tests | — | DB used by the full API lifecycle suite |

## QCoin economy rules (documented and enforced)

- QCoins are **internal credits**: never withdrawable, never transferable between users, never redeemable for cash.
- Entry fees are optional per quiz/poll and capped by platform limits.
- Rewards are optional and paid only after server-verified completion (quiz: verified pass/top-percent and not pending review; poll: participation-based — an opinion poll has no correct answer).
- Payouts are idempotent per attempt/vote; `wallet` balances update conditionally; every change is an immutable ledger entry.
- Refunds: abandoned attempts, platform-cancelled content, and admin-approved requests.
- Admin adjustments always require a written reason and are permanently audited.

## Design principles

1. **No fake data, ever.** Empty means empty: sections are hidden or replaced with honest empty states, never with placeholder numbers.
2. **Honest failure.** Degraded systems report themselves as degraded (`503 DB_UNAVAILABLE`), and the UI explains it.
3. **Server-side authority.** Every action is authorized and priced on the backend; the UI is a convenience layer.
4. **Auditable economy.** The ledger is append-only; corrections are new entries.
5. **Accessible, responsive UI.** Keyboard navigation, ARIA labels, reduced-motion support, mobile-first layouts.
