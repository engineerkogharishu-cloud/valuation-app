# Mulyanka — Nepal Property Valuation Reports

Production deployment package. Multi-tenant web application for producing
property, land, building and bank valuation reports in Nepal, from mobile field
data collection through to the final signed report.

---

## 1. Technology stack

| Layer    | Technology                                                        |
|----------|-------------------------------------------------------------------|
| Frontend | React 18 (18.3.x on the `^18.2` line), Vite 6, DOMPurify           |
| Backend  | Node.js 20+ (22 recommended), Express 4.18                         |
| Database | Turso / libSQL (cloud SQLite) via `@libsql/client`                 |
| Auth     | JWT in an HttpOnly cookie, bcrypt password hashing                 |
| Email    | Nodemailer over Resend SMTP (or any custom SMTP)                   |
| Security | Helmet, CORS allowlist, express-rate-limit, server-side sanitising |
| Hosting  | Netlify (static frontend) + Railway / Fly.io / Docker (backend)    |

There is **no router library**. The app switches views with React state and
reads `window.location.pathname` for one deep link (`/collect/:code`), which is
why the SPA fallback below matters.

There is **no CSS framework**: all styling is inline, with Google Fonts
(Poppins, IBM Plex Mono) loaded from `index.html`.

---

## 2. Folder structure

```
FINAL_DEPLOYMENT/
├── backend/                  Express API — deploy to Railway / Fly.io / Docker
│   ├── server.js             All routes and logic (single module, ~3250 lines)
│   ├── package.json
│   ├── package-lock.json
│   ├── .env.example          Copy to .env and fill in
│   ├── .node-version         22
│   ├── Dockerfile            Production image (non-root, npm ci --omit=dev)
│   ├── .dockerignore
│   └── fly.toml              Fly.io service definition
│
├── frontend/                 React + Vite SPA — deploy to Netlify
│   ├── src/
│   ├── index.html            Main entry
│   ├── index.standalone.html Offline/no-backend variant entry
│   ├── vite.config.js
│   ├── vite.standalone.config.js
│   ├── package.json
│   ├── package-lock.json
│   └── .env.example
│
├── mobile/                   Static field-collection page (no build step)
│   ├── index.html            Edit window.FIELD_API_BASE before deploying
│   └── netlify.toml
│
├── database/
│   └── schema.sql            Reference schema — the server creates tables itself
│
├── netlify.toml              Frontend site config (build, SPA fallback, headers)
├── railway.json              Backend service config
├── package.json              Convenience scripts for the whole package
├── .env.example              Map of the two real env files
├── .gitignore
└── README.md
```

---

## 3. Requirements

```
Node.js : >= 20.0.0  (22 LTS recommended — matches .node-version and Dockerfile)
npm     : >= 9.0.0
Database: a Turso / libSQL database (free tier is enough) — https://turso.tech
Email   : a Resend account, or any SMTP server (optional)
```

---

## 4. Installation

```bash
cd backend && npm ci
```

```bash
cd frontend && npm ci
```

Or from the package root:

```bash
npm run install:all
```

Use `npm ci` rather than `npm install` — it installs exactly what the lock file
pins, which is what you want for a reproducible deployment.

---

## 5. Environment setup

Two separate `.env` files. **Never commit either one.**

### `backend/.env`

Copy `backend/.env.example` and fill it in. The server **refuses to start**
without `JWT_SECRET` (min 32 chars) and `TURSO_DATABASE_URL`.

| Variable                          | Required | Notes                                                                                            |
|-----------------------------------|----------|--------------------------------------------------------------------------------------------------|
| `NODE_ENV`                        | yes      | `production` in production                                                                       |
| `PORT`                            | no       | default `3001`                                                                                   |
| `TURSO_DATABASE_URL`              | **yes**  | `libsql://...` — server exits without it                                                          |
| `TURSO_AUTH_TOKEN`                | yes      | for any non-local database                                                                       |
| `JWT_SECRET`                      | **yes**  | 32+ chars — server exits if missing or too short                                                  |
| `SUPER_ADMIN_INITIAL_PASSWORD`    | **yes**  | seeds `superadmin`; 10+ chars, mixed case, digit, symbol                                          |
| `CORS_ORIGIN`                     | yes      | comma-separated frontend origins, no trailing slash                                               |
| `TRUST_PROXY`                     | no       | set `false` only when NOT behind a proxy/CDN                                                      |
| `PUBLIC_URL`                      | no       | backend's own public URL, for field links (Railway injects `RAILWAY_PUBLIC_DOMAIN` automatically) |
| `RESEND_API_KEY`                  | no       | leave blank to disable email                                                                     |
| `EMAIL_FROM` / `EMAIL_FROM_NAME`  | no       | sender identity                                                                                  |
| `SMTP_HOST/PORT/SECURE/USER/PASS` | no       | alternative to Resend                                                                            |

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### `frontend/.env`

```env
VITE_API_URL=https://your-backend.up.railway.app
```

**Every `VITE_*` value is compiled into the public JavaScript bundle and is
readable by anyone.** Never put a secret, token or database credential here.

`VITE_API_URL` is read at **build time**, not run time. Changing it means
rebuilding and redeploying the frontend. Leave it empty only when the backend is
served from the same domain; the build prints a warning to remind you.

---

## 6. Development

Two terminals.

```bash
cd backend && npm run dev
```

```bash
cd frontend && npm start
```

Backend comes up on `http://localhost:3001`, frontend on `http://localhost:3000`.

Leave `VITE_API_URL` empty for local work: Vite proxies `/api` to
`localhost:3001` and strips the `Secure` flag off the auth cookie so it survives
plain HTTP. With `NODE_ENV` unset the backend also issues the cookie as
`SameSite=Lax` rather than `None`, which is what a local setup needs.

First login: company code `SYSTEM`, username `superadmin`, password
`SUPER_ADMIN_INITIAL_PASSWORD`. A password change is forced immediately.

---

## 7. Production build and start

### Frontend

```bash
cd frontend && VITE_API_URL=https://your-backend.up.railway.app npm run build
```

Output goes to `frontend/build/`. Nothing is pre-built in this package on
purpose: the API URL is baked into the bundle, so a build made elsewhere would
point at the wrong backend.

To preview the production bundle locally on `http://localhost:4173`:

```bash
cd frontend && npm run preview
```

### Backend

```bash
cd backend && npm ci --omit=dev && npm start
```

`npm start` runs `node server.js`.

### Offline / no-backend variant (optional)

```bash
cd frontend && npm run build:standalone
```

Writes `FINAL_DEPLOYMENT/standalone-build/`. It stores everything in the
browser's localStorage and never calls the API; drag the folder to
netlify.com/drop.

---

## 8. Deployment architecture

**Option A — frontend and backend deployed separately.** This is what the
package is configured for, and it matches how the application already runs.

```
  Netlify (static)            Railway / Fly.io (Node)          Turso
  frontend/build        -->   backend/server.js          -->   libSQL
  VITE_API_URL                CORS_ORIGIN                      cloud SQLite

  Netlify (static)
  mobile/index.html     -->   same backend
  window.FIELD_API_BASE
```

Express serves JSON only — it never serves the React bundle. Keeping them split
means the SPA sits on a CDN, the API scales on its own, and neither redeploy
blocks the other. It also means **CORS and cookies must be configured
correctly**, because the browser treats the two as cross-origin (see §11).

Option B (Express serving the built SPA) was considered and **not** adopted: it
would need new static-file and SPA-fallback routes in `server.js`, and the
backend's Helmet CSP does not allow the third-party scripts the report tooling
loads (Leaflet from unpkg, html2canvas and pdf.js from cdnjs).

### Deploying the frontend (Netlify)

Connect the repository, then make sure Netlify builds **this package** and not
the older top-level `frontend/` copy. Netlify reads the `netlify.toml` at the
repository root, so either:

- push `FINAL_DEPLOYMENT` as its own repository root — this file then applies; or
- connect the monorepo and rely on the repo-root `netlify.toml`, which is
  already pointed at `FINAL_DEPLOYMENT/frontend`; or
- set **Base directory** to `FINAL_DEPLOYMENT` in Site settings → Build & deploy.

`netlify.toml` already sets:

- base `frontend`, command `npm ci && npm run build`, publish `build`
- Node 22
- the SPA fallback `/*` to `/index.html` with status 200
- security headers, plus a commented-out CSP to enable once you fill in your
  backend origin
- immutable caching for `/assets/*`, no-cache for `index.html`

Set `VITE_API_URL` in **Site settings → Environment variables** before the first
build.

### Deploying the backend

**Railway** — `railway.json` builds with `npm ci --omit=dev`, starts with
`npm start` and health-checks `/api/ping`. Set every `backend/.env` variable in
the Railway dashboard.

**Fly.io** — `fly.toml` targets region `sin`, 256 MB, internal port 3001, HTTPS
forced, health-checking `/api/ping`. No volume is declared: the database is
Turso over the network, so there is nothing on local disk to persist. Set
secrets with `fly secrets set ...` and set `PUBLIC_URL` to the app hostname
(Railway injects its equivalent automatically, Fly does not).

**Docker**:

```bash
cd backend && docker build -t valuation-backend .
```

```bash
docker run -p 3001:3001 --env-file backend/.env valuation-backend
```

### Deploying the mobile field page

Its own Netlify site, publish directory `mobile`, empty build command. **Edit
`window.FIELD_API_BASE` at the bottom of `mobile/index.html` first** — it has no
build step and cannot read an environment variable.

---

## 9. Database

No migration step and no seed script to run. On first request the server:

1. creates every table and index if missing (`CREATE TABLE IF NOT EXISTS`),
2. seeds company `SYSTEM` and the `superadmin` user from
   `SUPER_ADMIN_INITIAL_PASSWORD`, with a forced password change,
3. purges expired revoked tokens and security events older than 90 days,
4. prunes report version history to the last 10 versions per report.

`database/schema.sql` is documentation only — do not run it. `server.js` is the
source of truth. The file was generated from a real `initDb()` run, so it lists
all 14 tables and 20 indexes with the columns that the in-code `ALTER TABLE`
migrations add; regenerate it if the schema changes.

Turso handles backups. There is no local database file in production; any
`valuation.db` in an older copy of the project is a leftover and is not read by
this code.

---

## 10. Security notes

Already enforced by the application:

- JWT in an **HttpOnly, Secure, SameSite=None** cookie in production — the token
  is never exposed to JavaScript and is never written to localStorage
- server-side revocation list, so logout and password change invalidate sessions
- bcrypt (cost 12) with a constant-time dummy hash on unknown users
- per-IP rate limits (10 logins / 15 min, 300 API calls / min) plus per-account
  lockout after 10 failed attempts
- role checks (`super_user` / `admin` / `user`) and per-tenant ownership checks
  on every report route
- recursive server-side sanitising of stored report state (script tags, event
  handlers, `javascript:` and `data:text/html` are stripped; base64 images kept)
- DOMPurify on every rendered HTML preview in the browser
- Helmet: CSP, HSTS, `nosniff`, referrer policy, frameguard
- parameterised SQL everywhere — no user input reaches a query string
- generic client-facing error messages; details go to the server log only

Your responsibilities:

- keep `backend/.env` out of version control (`.gitignore` covers it)
- rotate `JWT_SECRET` if it is ever exposed — this logs everyone out
- set `CORS_ORIGIN` to your exact frontend origins in production
- change the seeded `superadmin` password immediately (the app forces this)
- run `npm audit` periodically in both folders (`npm run audit:all`)

---

## 11. Troubleshooting

**Every API call fails, or the dashboard comes up empty**
`VITE_API_URL` was empty or wrong at build time, so the bundle is calling a
relative `/api` on the Netlify domain. Set it and rebuild — it is not read at
run time. The build prints a warning when it is missing.

**CORS errors in the browser console**
The frontend origin is not in `CORS_ORIGIN`. Use the exact origin with no
trailing slash, comma-separated for several. `https://<name>.netlify.app` is
allowed by default; custom domains are not. Restart the backend after changing
it.

**Login succeeds but the next request is 401**
The cookie is not being stored. In production the backend sets
`Secure; SameSite=None`, which requires **HTTPS on both** the frontend and the
backend. Mixing `http://` and `https://`, or an origin missing from
`CORS_ORIGIN`, will drop the cookie.

**`FATAL: JWT_SECRET must be set to at least 32 random characters`**
Missing or too short. Generate one with the command in §5.

**`FATAL: TURSO_DATABASE_URL must be set`**
The variable is missing in the deployment environment. `.env` files are not
uploaded to Railway or Fly — set the variables in the platform dashboard.

**Refreshing `/collect/ABC123` gives a 404**
The SPA fallback is not configured. `netlify.toml` includes it; on any other
host you must rewrite unknown paths to `/index.html`.

**Port already in use**
Backend defaults to 3001, frontend dev to 3000, preview to 4173. Override with
`PORT=...` for the backend, or `npm start -- --port 3005` for Vite.

**`413 Payload too large` when saving a report**
Reports carrying many photos can be large. Report and field-submission
endpoints accept up to 50 MB; everything else is capped at 12 MB. Shrink the
images, or raise `jsonLarge` in `server.js` — and remember that a 256 MB Fly
machine cannot hold many concurrent 50 MB bodies.

**Emails are not sending**
`RESEND_API_KEY` (or the `SMTP_*` set) is not configured. The backend logs
`Email not configured` at startup and the admin email endpoints return 503. The
rest of the application works without it.

**Backend is slow on the first request after idling**
Cold start: the platform spins the machine up and the app initialises the
database. `index.jsx` fires a warm-up ping at `${VITE_API_URL}/api/ping` on page
load to overlap that with the user typing their credentials. On Fly.io, set
`min_machines_running = 1` (already in `fly.toml`).
