# PathForge

PathForge is a roadmap learning platform. Guests browse published roadmaps. Learners enroll, follow a daily plan, and keep progress that survives curriculum edits. Admins edit the curriculum, watch enrollments, and run a validation report.

Roles are enforced on the server. The browser never chooses its own role.

## Stack

- React, Vite, TypeScript, Tailwind, Radix UI, React Router, TanStack Query, Recharts
- Node.js, Express, TypeScript, Zod, Pino
- MongoDB and Mongoose
- JWT access and refresh tokens in HttpOnly cookies, plus a double-submit CSRF token

## Repository

```
client/     React app
server/     API, models, seed curriculum, tests
docs/       API reference, progress rules, deployment checklist
```

## Local setup

Requirements: Node.js 20 or newer.

```bash
npm install
cp server/.env.example server/.env
npm run dev
```

`npm run dev` starts three processes:

| Process | Address | Role |
| --- | --- | --- |
| Dev database | `127.0.0.1:27017` | MongoDB-compatible engine. Data lives in `server/.local-data` |
| API | `http://localhost:4000` | Express |
| Web | `http://localhost:5173` | Vite. Proxies `/api` to the API |

If you already have MongoDB, skip `dev:db` and set `MONGODB_URI`. Production should use MongoDB Atlas. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

### Seed

```bash
npm run seed                 # curriculum, admin, and a demo learner
npm run seed -- --no-demo    # curriculum and admin only
npm run seed -- --force      # rewrite seeded curriculum fields from source
```

The seeder upserts by stable keys and archives content that disappeared from the seed. It does not delete learner progress. Running it twice is safe.

After a normal seed you can sign in with:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@pathforge.local` | `Admin_PathForge_123!` |
| Learner | `demo@pathforge.dev` | `Demo_PathForge_123!` |

Change both passwords before any shared deployment. The values come from `SEED_ADMIN_*` and `SEED_DEMO_*` in `server/.env`.

The seed includes 11 roadmaps (programming fundamentals, computer fundamentals, problem solving and algorithms, JavaScript, Java, C++, frontend, backend, networking, software engineering, AI and machine learning). Every topic has at least three tasks.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Database, API, and web together |
| `npm run build` | Compile the API and the client |
| `npm start` | Run the compiled API (`node server/dist/index.js`) |
| `npm test` | Server and client test suites |
| `npm run typecheck` | `tsc --noEmit` in both workspaces |
| `npm run seed` | Idempotent curriculum and demo seed |

## Product map

Public: landing, explorer, roadmap detail, about, login, register, forgot password, reset password.

Learner: dashboard, my roadmaps, workspace, module view, task view, today, all tasks, calendar, history, analytics, achievements, notifications, profile.

Admin: overview, roadmap management, curriculum editor, preview, enrollment analytics, validation report.

Progress math, locking, paces, and the daily-plan algorithm are documented in [docs/PROGRESS_RULES.md](docs/PROGRESS_RULES.md). The HTTP API is documented in [docs/API.md](docs/API.md).

## Tests

The API tests use the dev database on port 27017 and a separate database name (`pathforge_test`). Start the database first (`npm run dev:db`), then:

```bash
npm test
```

## Docker

```bash
export JWT_ACCESS_SECRET=$(openssl rand -hex 48)
export JWT_REFRESH_SECRET=$(openssl rand -hex 48)
docker compose up --build
```

The image serves the API and the built client on port 4000. Deployment steps for Render, Vercel, and Atlas are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
