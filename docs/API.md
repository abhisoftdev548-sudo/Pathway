# PathForge API

Base URL: `/api`. The server also answers `GET /health` and `GET /` with a short JSON identity payload.

All JSON errors look like:

```json
{
  "error": { "code": "VALIDATION_ERROR", "message": "Some fields are invalid.", "details": [] },
  "requestId": "…"
}
```

Common codes: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `RATE_LIMITED` (429).

## Authentication

Sessions are JWT cookies, not `Authorization` headers.

| Cookie | Path | Notes |
| --- | --- | --- |
| `pf_access` | `/` | HttpOnly access token (default 15 minutes) |
| `pf_refresh` | `/api/auth` | HttpOnly refresh token (default 7 days) |
| `pf_csrf` | `/` | Readable double-submit token |

State-changing requests outside `/api/auth/*` must send `x-csrf-token` matching `pf_csrf`. `GET /api/auth/csrf` issues a fresh token. Browsers must send an allowlisted `Origin` (`CLIENT_ORIGIN`). Requests with no `Origin` (curl, tests, server-to-server) pass the origin check.

Roles are `user` and `admin`. Registration always creates a `user`. Admin routes require `requireAdmin`.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/auth/csrf` | no | Issue CSRF cookie and token |
| POST | `/api/auth/register` | no | `{ name, email, password, timezone?, dailyGoalMinutes? }` |
| POST | `/api/auth/login` | no | `{ email, password }` |
| POST | `/api/auth/logout` | cookie | Revoke refresh token version and clear cookies |
| POST | `/api/auth/refresh` | refresh cookie | Rotate the session |
| GET | `/api/auth/me` | access | Current user |
| POST | `/api/auth/forgot-password` | no | Always 200. In development the response may include `devResetToken` |
| POST | `/api/auth/reset-password` | no | `{ token, password }` |
| PATCH | `/api/auth/password` | access | `{ currentPassword, newPassword }` |

Password policy: at least 10 characters, one lowercase, one uppercase, one digit. Passwords are hashed with bcrypt (12 rounds).

## Public catalog

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/roadmaps` | Published roadmaps. Query: `search`, `category`, `difficulty`, `page`, `limit` |
| GET | `/api/roadmaps/facets` | Category and difficulty counts |
| GET | `/api/roadmaps/:slug` | Detail, modules, topics, task counts, related roadmaps |
| GET | `/api/roadmaps/:id/modules` | Modules for a roadmap id |
| GET | `/api/modules/:id/topics` | Topics in a module |
| GET | `/api/topics/:id/tasks` | Published tasks in a topic (no quiz answers) |
| GET | `/api/stats` | `{ roadmaps, tasks, topics, learners, completions }` |
| POST | `/api/roadmaps/:id/enroll` | Auth. `:id` may be an ObjectId or a slug. Body `{ learningPace, customDailyGoal? }` |

`learningPace` is `relaxed` (20), `standard` (45), `intensive` (90), or `custom` (requires `customDailyGoal` 5–300). Enrolling an archived enrollment restores it. A second active enrollment returns 409 with the existing `enrollmentId`.

## Learner

All routes require a signed-in user.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/me/dashboard` | Welcome, streak, daily plan, stats, continue card |
| GET | `/api/me/roadmaps` | Enrollments, overall progress, status counts |
| GET | `/api/me/roadmaps/:enrollmentId` | Workspace: modules, topics, tasks, progress |
| GET | `/api/me/roadmaps/:enrollmentId/tasks` | Tasks for one enrollment |
| PATCH | `/api/me/roadmaps/:enrollmentId` | `{ status?, learningPace?, customDailyGoal? }`. Completed roadmaps can only be archived, not reverted by hand |
| DELETE | `/api/me/roadmaps/:enrollmentId` | Archive. Progress rows are kept |
| GET | `/api/me/tasks/today` | Daily plan |
| GET | `/api/me/tasks` | Filterable task list (`search`, `type`, `status`, `difficulty`, `enrollmentId`, `roadmapId`, `moduleId`, `topicId`, `sort`, `page`, `limit`) |
| GET | `/api/me/tasks/history` | Activity log |
| GET | `/api/me/tasks/:taskId` | Task detail. Quiz answers and the solution explanation are omitted |
| POST | `/api/me/tasks/:taskId/complete` | `{ actualDuration?, quizAnswers? }`. Locked tasks return 409 |
| POST | `/api/me/tasks/:taskId/reopen` | Clears completion, keeps `firstCompletedAt` |
| PATCH | `/api/me/tasks/:taskId/progress` | `{ privateNotes?, actualDuration?, selfVerified? }` |
| GET | `/api/me/tasks/:taskId/solution` | Coding solution, after a self-verified submission |
| GET/POST | `/api/me/tasks/:taskId/submissions` | Submission history / `{ content, language, notes, selfVerified }` |
| POST | `/api/me/tasks/:taskId/quiz-attempt` | `{ answers }`. 409 if locked. Does not complete the task |
| GET | `/api/me/analytics` | `?days=` range, streaks, by type, by difficulty |
| GET | `/api/me/streaks` | Current and longest streak |
| GET | `/api/me/activity` | Heatmap-style activity |
| GET | `/api/me/achievements` | Definitions plus earned state |
| GET | `/api/me/certificates` | Certificates for completed roadmaps |
| GET | `/api/me/notifications` | Paginated notifications |
| PATCH | `/api/me/notifications/:id/read` | Mark one read |
| POST | `/api/me/notifications/read-all` | Mark all read |
| DELETE | `/api/me/notifications/:id` | Delete one |
| GET/PATCH | `/api/me/profile` | Profile and preferences |
| POST | `/api/me/logout-all` | Increment token version and sign this browser out |

Progress math is specified in [PROGRESS_RULES.md](./PROGRESS_RULES.md).

## Admin

Requires role `admin`. Deletes archive content; they do not hard-delete curriculum that learners may still reference.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/admin/overview` | Metrics, completion trend, top roadmaps, recent enrollments |
| GET | `/api/admin/roadmaps` | Paginated management list (`search`, `published`, `includeArchived`) |
| POST | `/api/admin/roadmaps` | Create an unpublished roadmap |
| PATCH | `/api/admin/roadmaps/:id` | Update. Bumps `version` |
| POST | `/api/admin/roadmaps/:id/publish` | Requires at least one published module, topic, and task |
| POST | `/api/admin/roadmaps/:id/unpublish` | Hide from the explorer |
| POST | `/api/admin/roadmaps/:id/archive` | Archive and unpublish |
| POST | `/api/admin/roadmaps/:id/restore` | Restore as a draft |
| DELETE | `/api/admin/roadmaps/:id` | Archive. Response includes `preservedEnrollments` |
| GET | `/api/admin/roadmaps/:roadmapId/curriculum` | Full editor tree plus validation |
| GET | `/api/admin/roadmaps/:roadmapId/preview` | Read-only curriculum |
| POST | `/api/admin/roadmaps/:roadmapId/slug-preview` | Preview a slug before saving |
| POST | `/api/admin/roadmaps/:roadmapId/modules` | Create a module |
| PATCH | `/api/admin/modules/:moduleId` | Update, including `published` |
| POST | `/api/admin/modules/:moduleId/move` | Reorder |
| DELETE | `/api/admin/modules/:moduleId` | Archive |
| POST | `/api/admin/modules/:moduleId/restore` | Restore |
| POST | `/api/admin/modules/:moduleId/topics` | Create a topic |
| PATCH/DELETE/POST `move`/`restore` | `/api/admin/topics/:topicId` | Topic lifecycle |
| POST | `/api/admin/topics/:topicId/tasks` | Create a task |
| GET/PATCH | `/api/admin/tasks/:taskId` | Read or update a task |
| POST | `/api/admin/tasks/:taskId/publish` | Publish. Needs description, instructions, and an acceptance criterion. Quizzes need a question |
| POST | `/api/admin/tasks/:taskId/unpublish` | Hide from learners |
| POST | `/api/admin/tasks/:taskId/restore` | Restore an archived task |
| POST | `/api/admin/tasks/:taskId/move` | Reorder |
| DELETE | `/api/admin/tasks/:taskId` | Archive |
| GET | `/api/admin/analytics/enrollments` | Totals, per-roadmap completion rate and average progress |
| GET | `/api/admin/users` | Paginated users |
| GET | `/api/admin/enrollments` | Paginated enrollments |
| GET | `/api/admin/validation` | Content integrity report. `?roadmapId=&includeInfo=true` |

Task types: `learn`, `practice`, `code`, `quiz`, `project`, `revision`, `assessment`. Difficulties: `beginner`, `intermediate`, `advanced`.
