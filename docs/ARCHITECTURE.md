# QuizSphere Architecture

## Layers

```
Browser (React SPA, relative /api URLs)
   │  Vite proxy in dev · Vercel rewrite in prod  (same-origin keeps cookies first-party)
Express API (TypeScript)
   ├─ routes/      auth · quizzes (discovery + builder) · attempts · admin · me
   ├─ lib/         scoring.ts (pure engine) · validation.ts (submission rules) · serializers.ts (answer-key stripping) · services.ts
   ├─ middleware/  JWT-from-cookie auth, requireAuth/requireAdmin/notSuspended
   └─ db/store.ts  Repository layer → MongoStore (Mongoose/Atlas) | Memory/FileStore (local dev & tests)
MongoDB Atlas (production) · apps/api/data/dev.json (local fallback)
```

All business rules run above the repository layer, so the Atlas path and the local path execute
identical, test-covered logic.

## Data model (`apps/api/src/db/models.ts`, `src/types.ts`)

- **User** — displayName, unique lowercase email, bcrypt passwordHash, role (`user|admin`),
  avatar, bio, isSuspended, reset-token hash+expiry.
- **Category** — name, unique slug, description, `parentCategoryId` (null = category, set =
  subcategory), isActive. Admin-managed at runtime; seeded with the 23 subjects from the spec
  plus sample subcategories. Nothing hardcodes the seed list.
- **Quiz** — unique slug, creatorId, workflow `status`, `isLive`, pointers:
  `draftVersionId`, `pendingVersionId`, `currentPublishedVersionId`, `nextVersionNumber`,
  denormalized `attemptsCount`/`ratingAvg`/`ratingCount`, `latestFeedback`, `publishedAt`.
- **QuizVersion** — immutable-ish snapshot: `metadata` (title, description, category,
  subcategory, tags, difficulty, language, durations, settings) + `questions[]` + totalPoints.
  `state`: draft | pending | published | superseded | returned.
  Questions live **inside the version** so an attempt can always be reviewed against the exact
  content shown (question ids, option ids, keys, explanations).
- **Question** — type (`single_choice|multiple_choice|True_false|fill_blank|short_answer`),
  text, options[], correctOptionIds[], acceptedAnswers[], caseInsensitive, explanation
  (required at submission), hint, imageUrl, codeSnippet `{code, language}` (rendered as text
  only), difficulty, marks, topicTag, order, allowPartialCredit.
- **QuizAttempt** — userId, quizId, **quizVersionId**, responses[], persisted
  displayedQuestionOrder / displayedOptionOrders (shuffle-safe), status, server-computed
  score/maximumScore/pendingMarks/percentage, per-question results[], evaluationStatus,
  startedAt/submittedAt/timeTaken.
- **Bookmark** (unique user+quiz), **QuizRating** (unique user+quiz, requires a submitted
  attempt), **QuizReport**, **ModerationLog** (audit: admin, action, prev→new status,
  feedback, timestamp), **Notification**.

Indexes (Atlas): unique user email, quiz slug, category slug; compound (user,quiz) on
bookmarks/ratings; quiz by creator/status/isLive/attempts; version by quizId+number and by
`metadata.categoryId/difficulty/language/tags` for discovery.

## Approval state machine & versioning

```
create ──▶ DRAFT ──submit──▶ PENDING_REVIEW ──approve──▶ APPROVED (isLive, published vN)
             ▲                    │   ├── reject ───────▶ REJECTED (or APPROVED if an older v is live)
             └──── withdraw ──────┘   └── request_changes ▶ CHANGES_REQUESTED (same fallback)
APPROVED ──admin unpublish──▶ UNPUBLISHED ──restore──▶ APPROVED
any ──creator delete with submitted attempts──▶ ARCHIVED (history preserved)
```

Rules enforced in `routes/quizzes.ts` + `routes/admin.ts`:

1. Submission validates metadata + every question (text, explanation, marks, per-type key
   rules, active category) — `lib/validation.ts#validateForSubmission`; errors return as a list.
2. While a version is pending it is locked (creator must withdraw to edit).
3. Editing an approved quiz snapshots a **new draft version**; discovery/attempts keep using
   `currentPublishedVersionId` until the revision is approved (old version → `superseded`).
4. Double-decide is a `409` (no pending version). Duplicate attempt submit returns the stored
   result and never double-counts.
5. Unpublish flips `isLive=false`: discovery 404s and new attempts are blocked instantly;
   historical attempts/reviews are untouched. Restore requires a published version.
6. Every transition writes a ModerationLog; approve/reject/request-changes/unpublish/restore
   also notify the creator. Feedback is mandatory for reject + request-changes.

## Scoring policy (`lib/scoring.ts`, server-only)

| Type | Rule |
|---|---|
| Single choice / True-False | Exact correct option → full marks |
| Multiple choice | Default **full-credit-only** (exact correct set). Optional per-question partial credit: `marks × max(0, hits − wrongPicks) / correctCount`, disclosed on the detail page before starting |
| Fill in the blank | Trim + collapse whitespace; case per question flag; match any accepted variant |
| Short answer | **Not auto-graded** → `pending_review`; its marks go to `pendingMarks` and are excluded from `maximumScore`/percentage; learner self-assesses against the model explanation |

Timed quizzes: `deadline = startedAt + timeLimit` (+30s grace). Any read/write after that
auto-finalizes with saved responses (`maybeExpire`). The client also counts down and submits,
but the server is the source of truth. Clients never send scores or keys.

## Answer-key privacy

`serializers.sanitizeQuestion` is the only shape served pre-submit (public detail serves no
questions at all) — it strips `correctOptionIds`, `acceptedAnswers`, `explanation`.
Keys appear in exactly three places: the owner's builder/revisions, the admin submission
view, and the submitted-attempt review. Immediate-explanation mode reveals one checked
question at a time via `POST /attempts/:id/check`, only when the creator opted in.

## API map

Full contract: `GET /api/openapi.json`. Groups: `/api/auth/*`, discovery
(`GET /api/quizzes`, `/filters`, `/:slug`, `/api/categories`, `/api/users/:id[/quizzes]`,
`/api/stats`), builder (`POST /api/quizzes`, `/api/me/quizzes/:id` GET/PATCH/DELETE,
`/submit`, `/resubmit`, `/withdraw`, `/revisions`), attempts
(`POST /api/quizzes/:slug/attempts`, `GET/PATCH /api/attempts/:id[/responses]`, `/check`,
`/submit`, `/api/me/attempts[/:id/review]`), social (`bookmark`, `report`, `rating`,
`/api/me/{dashboard,bookmarks,notifications}`), admin (`/api/admin/{dashboard,submissions,
quizzes,moderation-logs,categories,reports,users}`).

**Popularity sort** = `attemptsCount×2 + ratingAvg×10 + bookmarkCount×3`.

## Security

bcrypt hashing · JWT in HTTP-only cookie (+ Bearer for API clients) · CORS allowlist
(`FRONTEND_URL`, localhost, sandbox previews) · helmet headers · Zod on every payload ·
rate limits (general/auth/write) · explicit field allow-lists (profile PATCH cannot set
role/email) · ownership + role checks in every handler · suspended accounts blocked from
writes and login · reset tokens stored as SHA-256 hashes with 1h expiry · generic error
envelope `{ error: { code, message, details } }` · no secrets in the frontend bundle.

## Scaling notes

Discovery currently filters scored card projections in the service layer (single code path
for both stores). With Atlas, the indexed fields above let you push the same predicates into
Mongo queries/aggregations without changing the API contract; the repository `find(predicate)`
seam is where that happens. `attemptsCount`/rating denormalization avoids hot aggregations
for cards. Short-answer manual grading, email delivery for reset tokens, and image uploads
(S3/Cloudinary — URLs are already supported) are the natural next increments.
