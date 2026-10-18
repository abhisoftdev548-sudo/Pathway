# Deployment checklist

PathForge is a React client and an Express API that share cookies. The simplest production shape is **one origin**: the API serves `client/dist` and the browser calls relative `/api`. Split hosting (Vercel + Render) works only if `/api` is proxied onto the frontend origin, or cookies are switched to `SameSite=None; Secure` and the client is rebuilt to call the API host.

## 1. MongoDB Atlas

1. Create an M0 (or larger) cluster and a database user.
2. Network access: allow the Render/host egress IPs, or `0.0.0.0/0` only for a first smoke test.
3. Connection string:

   ```
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/pathforge?retryWrites=true&w=majority
   ```

4. Put that string in `MONGODB_URI`. Do not commit it.

Local development does not need Atlas. `npm run dev:db` starts a MongoDB-compatible engine on `127.0.0.1:27017` and stores data in `server/.local-data` (git-ignored).

## 2. Secrets

Generate two different secrets:

```bash
openssl rand -hex 48
openssl rand -hex 48
```

Set `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`. Production refuses secrets shorter than 32 characters, placeholder values, or identical access and refresh secrets.

Set `SEED_ADMIN_PASSWORD` and `SEED_DEMO_PASSWORD` before the first seed, then change the admin password in the app.

## 3. Render (API, or API + client)

`render.yaml` is a blueprint for a Node web service.

- Build: `npm ci && npm --workspace @pathforge/server run build && npm --workspace @pathforge/client run build`
- Start: `node server/dist/index.js`
- Health check: `/api/health`
- `NODE_ENV=production`
- `CLIENT_DIST=client/dist` so the service also serves the SPA
- `TRUST_PROXY=1`
- `COOKIE_SECURE=true`
- `CLIENT_ORIGIN` and `APP_URL` = the public https origin (no trailing slash)
- `COOKIE_SAMESITE=lax` when the app and API share that origin

After the first deploy:

```bash
# from a shell with the production env vars loaded
npm run seed
```

Confirm `GET /api/health` returns `"database": "connected"` and `GET /` serves the app (or the API identity JSON if `client/dist` was not built).

## 4. Vercel (client only)

Root directory: `client`. Framework: Vite. `client/vercel.json` rewrites every path to `index.html`.

The client calls relative `/api`. Add a rewrite **above** the SPA fallback so the browser stays on the Vercel origin:

```json
{ "source": "/api/:path*", "destination": "https://<your-render-service>.onrender.com/api/:path*" }
```

If you do not proxy, cookies will not be sent to a different site unless you also set `COOKIE_SAMESITE=none` and `COOKIE_SECURE=true` and change the client base URL. Prefer the proxy.

Set `CLIENT_ORIGIN` on the API to the Vercel URL.

## 5. Docker

From the repository root, with secrets exported:

```bash
export JWT_ACCESS_SECRET=$(openssl rand -hex 48)
export JWT_REFRESH_SECRET=$(openssl rand -hex 48)
docker compose up --build
```

Compose starts MongoDB 7 and the production image on port 4000. Seed once the API is healthy:

```bash
docker compose exec api node server/dist/scripts/seed.js
```

The image does not include the TypeScript seed runner. If that path is missing, run `npm run seed` against `MONGODB_URI=mongodb://127.0.0.1:27017/pathforge` from a workstation, or shell into the container and use `npx tsx` from a dev image. The supported path for a first production seed is `npm run seed` with the Atlas URI, from CI or a trusted machine.

## 6. Go-live checks

- [ ] `NODE_ENV=production`
- [ ] Distinct 32+ character JWT secrets, not the `.env.example` placeholders
- [ ] `MONGODB_URI` points at Atlas, not `127.0.0.1`
- [ ] `CLIENT_ORIGIN` is the real https origin, no trailing slash
- [ ] `COOKIE_SECURE=true` on https
- [ ] `TRUST_PROXY=1` behind Render, Vercel, or another proxy
- [ ] `GET /api/health` is 200 and `database` is `connected`
- [ ] `npm run seed` has been run once; repeating it is safe
- [ ] Admin can sign in, open `/admin/validation`, and see zero errors
- [ ] A learner can register, enroll, complete a task, reopen it, and see the percentage move
- [ ] Password reset is wired to a mailer before launch (development returns the token in the API response; production must not)
- [ ] Logs are JSON on stdout (pino). Cookie, password, and token fields are redacted
- [ ] Atlas backups are enabled

## Logging

The API logs one JSON line per request (`requestId`, method, path, status, duration, user id). `/api/health` is not logged. Set `LOG_LEVEL=info` in production and `warn` if the host charges for log volume.
