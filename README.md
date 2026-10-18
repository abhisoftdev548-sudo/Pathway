# QuizSphere

A quiz and poll platform with a transparent QCoin wallet, an approval workflow for
user-created content, and a genuinely functional administration panel.

Everything you see in the interface comes from the database. There is no seeded
content, no demo accounts and no placeholder statistics: a fresh installation
shows zeroes and honest empty states.

## Running it

```bash
npm install
npm run db:migrate        # create the SQLite database
npm run dev               # API on :3001, client dev server on :5173
```

The first account must be promoted from the command line — no administrator
credentials are shipped with the code:

```bash
npm run admin:create -- --email=ops@example.com --password='...' --name='Ops Admin'
# or, for an account that already registered:
npm run admin:promote -- --email=someone@example.com
```

Other scripts:

| Script | Purpose |
| --- | --- |
| `npm run build` | Build the client and type-check the server |
| `npm run typecheck` | Type-check the client and the server |
| `npm test` | Run the automated suite (permissions, business rules, transaction flows) |
| `npm run db:reset` | Delete and recreate the database |
| `npm run db:seed:dev` | Local development fixtures only — refused in production |

## How it is put together

- **API** — Express + Zod, SQLite via `node:sqlite`. `server/src/routes` holds the
  HTTP layer; `server/src/lib` holds the rules (wallet, moderation, notifications,
  achievements, settings). Every admin route is behind server-side authorization.
- **Client** — React + Vite + TanStack Query. Data access goes through
  `src/lib/api.ts`; every list is paged and filtered on the server, so the browser
  never fabricates rows.
- **Shared types** live in `shared/`.

### Rules that are enforced on the server

- Balances only ever change through a posted ledger entry (`server/src/lib/wallet.ts`).
  A negative balance is rejected by the database constraint; rewards are idempotent
  per attempt; refunds are idempotent per request.
- Manual adjustments and balance repairs need a written reason and are recorded in
  the audit log. The ledger is the source of truth: reconciliation compares each
  stored balance against the sum of its entries.
- Correct answers and explanations are hidden from players until they have finished
  an attempt of their own.
- Quiz and poll rules (question counts, entry fee and reward ceilings, attempt
  limits) are configurable and enforced on both the client and the server.
- Administrators cannot suspend or re-role themselves, and the last active
  administrator cannot be demoted.

## Tests

`npm test` runs four suites against a throwaway database:

- `tests/permissions.test.ts` — admin route protection, self-service guards,
  ownership rules, answer hiding.
- `tests/content.test.ts` — quiz/poll rules, the full approval workflow, resubmission
  and version history, voting.
- `tests/transactions.test.ts` — entry fees, rewards, idempotency, refunds,
  adjustments, reconciliation and anomaly detection.
- `tests/fresh-install.test.ts` — a new database shows zeroes and empty lists, with
  no sample content, and registration persists real records.

## Configuration

Database location defaults to `data/quizsphere.db` and can be overridden with the
`QUIZSPHERE_DB` environment variable. Platform rules live in the `platform_settings`
table and are edited from **Admin → Platform configuration**.
