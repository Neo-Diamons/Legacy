# TodoList

A small Todo application, originally based on
[`docker/getting-started-app`](https://github.com/docker/getting-started-app),
being modernised and extended as an Epitech group project.

Planned capabilities (tracked on the
[project Wiki](https://github.com/EpitechPGE45-2026/G-ING-900-PAR-9-1-legacy-9/wiki)):

- Secure, GDPR-compatible user authentication
- Project and task CRUD
- Kanban-style board (columns / workflow)
- Task priorities and deadlines
- User notifications
- At least one full event-driven workflow between components
- Code-quality gate and a complete CI/CD pipeline with Docker image publication

The team works in Scrum with a MoSCoW-prioritised backlog across three sprints:
**Foundation & Architecture → Core Features → Stabilisation & Quality**.

---

## Repository layout

This is an npm **workspaces** monorepo:

| Path        | Description                                                                                                                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/`  | Hono REST API in TypeScript (`@legacy/backend`). `tsx` in dev, bundled with `tsdown` for production. Drizzle ORM over SQLite by default, MySQL optional. Requests validated with `@hono/zod-openapi`; OpenAPI spec + Scalar UI served at runtime. |
| `frontend/` | Vite + React 19 + TypeScript single-page app (`@legacy/frontend`), styled with Bootstrap / react-bootstrap.                                                                                                                                       |

All commands below are run from the repository root unless stated otherwise.
Lint, formatting and CI are configured once at the root and cover both workspaces.password_hash

---

## Setup

### 1. Prerequisites

- **Node.js 24.13+ (`<25`)** — pinned in `.nvmrc` (`nvm use`). The backend relies
  on `node --env-file-if-exists`.
- **npm 11+ (`<12`)** — ships with Node 24. The repo pins `packageManager` to
  `npm@11.19.0`.

### 2. Install

```bash
git clone git@github.com:Neo-Diamons/Legacy.git
cd Legacy
npm install
```

`npm install` at the root installs dependencies for every workspace.

### 3. Environment variables

Copy the example file and adjust the values:

```bash
cp .env.example .env
```

The backend loads this root `.env` automatically on startup
(`node --env-file-if-exists=../.env`). If the file is
missing, it falls back to the real process environment.

| Variable               | Description                                                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FRONTEND_PORT`        | Vite dev (`5173`) / preview (`4173`) port. Seeds the default CORS allowlist.                                                                                   |
| `BACKEND_PORT`         | Hono API port. Default `3000`.                                                                                                                                 |
| `BACKEND_URL`          | Backend the dev/preview proxy forwards `/items*` to. Default `http://localhost:<BACKEND_PORT>`. Not baked into the frontend bundle.                            |
| `CORS_ALLOWED_ORIGINS` | Comma-separated API origin allowlist (scheme + host + optional port). Default: `localhost` and `127.0.0.1` on `<FRONTEND_PORT>`. Invalid entries fail startup. |
| `JWT_SECRET`           | Signing secret for JWTs (32+ random characters, never commit it). Required unless `JWT_SECRET_FILE` is set.                                                    |
| `JWT_SECRET_FILE`      | Path to a file holding the secret (docker secret, `/run/secrets/jwt_secret` in `compose.yml`). Takes precedence over `JWT_SECRET`.                             |
| `SQLITE_DB_LOCATION`   | SQLite file path. Default `/etc/todos/todo.db`. Used unless MySQL is configured.                                                                               |
| `MYSQL_HOST`           | MySQL host. Setting it (or `MYSQL_HOST_FILE`) switches persistence to MySQL; otherwise every `MYSQL_*` var is ignored.                                         |
| `MYSQL_PORT`           | MySQL port. Default `3306`.                                                                                                                                    |
| `MYSQL_USER`           | MySQL username.                                                                                                                                                |
| `MYSQL_PASSWORD`       | MySQL password.                                                                                                                                                |
| `MYSQL_DB`             | MySQL database name.                                                                                                                                           |

> Each `MYSQL_*` variable also has a `_FILE` variant (e.g. `MYSQL_PASSWORD_FILE`)
> that points to a file containing the value.
> If both are set, the `_FILE` variant wins.

---

## Database migrations

Schema lives in `backend/src/model/` (separate SQLite and MySQL models). The
backend applies pending migrations on startup; you only regenerate SQL after
changing a model:

```bash
npm run db:generate --workspace backend   # write migration SQL from the models
npm run db:migrate  --workspace backend   # apply now, without starting the server
```

Configs: `backend/drizzle.config.sqlite.ts`, `backend/drizzle.config.mysql.ts`.

---

## Development

```bash
npm run dev
```

Runs both workspaces together (via `concurrently`):

- **Frontend** — Vite dev server: <http://localhost:5173>
- **Backend** — Hono API: <http://localhost:3000>

The Vite dev server proxies `/items` and `/items/*` to the backend (so does
`vite preview`), so CORS is not exercised locally. Run the sides independently
with:

```bash
npm run dev:backend
npm run dev:frontend
```

---

## Production build

```bash
npm run build   # backend: tsdown -> dist/index.mjs   frontend: tsc -b + vite build -> dist
npm start       # prestart builds, then runs backend + vite preview
```

`prestart` builds both workspaces, so `npm start` needs no prior build. It runs
the backend bundle and `vite preview` together; `vite preview` serves
`frontend/dist` on `FRONTEND_PORT` (default `4173`) and proxies `/items*` to
`BACKEND_URL`.

Any other host for `frontend/dist` (nginx, CDN) must forward `/items*` to the
backend — the client uses same-origin paths. A cross-origin API needs its origin
in `CORS_ALLOWED_ORIGINS` plus a client-code change (no build-time API URL).

---

## API

The backend serves its own reference docs, generated from the zod schemas:

- **Scalar UI** — <http://localhost:3000/scalar>
- **OpenAPI 3.0 spec** — <http://localhost:3000/doc>

Authentication is provided by `POST /auth/register` and `POST /auth/login`, both of
which return a JWT and a sanitized user object. Registration requires
`acceptPrivacyPolicy: true` (see [Privacy](#privacy)). Send it as
`Authorization: Bearer <token>` when calling `/users`, `/items` or `/projects`.
The OpenAPI document (`/doc`) and Scalar UI (`/scalar`) are public so they can be
opened in a browser; they expose no credentials or user data.
Items, projects and realtime item events are scoped to the authenticated user.

The user API supports `GET/PUT/DELETE /users/:id` for the authenticated owner and
`GET /users/:id/export` for a JSON export of that user's account, projects and
items. Deleting the account deletes its owned projects and items first. Passwords
are stored only as scrypt hashes and are excluded from exports and API responses.

Users are stored in the `users` table and projects in `projects`. Existing todo
items are assigned to the seeded `legacy@local.invalid` account by migration, so
adding ownership does not discard existing data. The legacy account is has a new
default password as a result of the migration which is: `LegacyUser123!`.

The application implements technical support for access, rectification, export
and deletion requests. Retention periods, the legal basis, and the controller's
operational GDPR procedures must still be defined for the deployment; code alone
cannot establish legal compliance.

### Privacy

- **Consent at signup.** The registration form has a required, unticked checkbox
  linking to the privacy policy. The API rejects registration with `422` unless
  the body contains `acceptPrivacyPolicy: true`.
- **What is stored.** The consent time (`users.privacy_consent_at`) and the policy
  version accepted (`users.privacy_policy_version`). Both are returned on the user
  object and in the export. Accounts created before consent capture have `null`.
- **Privacy policy.** Public page at `/privacy` (`frontend/src/pages/PrivacyPage.tsx`),
  linked from the signup form and the footer. After a material change, bump
  `PRIVACY_POLICY_VERSION` in both `backend/src/utils/privacy.ts` and that page.
- **Retention is not documented.** The policy page states that data is kept until
  the account is deleted and that no other period is defined. The controller must
  set real retention periods before production use. Existing accounts are not
  re-prompted when the policy version changes.

---

## Tests

```bash
npm run test            # vitest run (backend)
npm run test:coverage   # vitest run --coverage (v8), all workspaces if present
```

Backend specs are colocated as `backend/src/**/*.test.ts` and run on **Vitest**.
Tests use SQLite against an isolated file: `backend/.env.test` sets
`SQLITE_DB_LOCATION=./test.db` and is picked up by `vitest.config.ts`
(`loadEnv`), so `npm run test` works with no extra setup and never touches your
dev database. Coverage uses the `@vitest/coverage-v8` provider.

---

## Lint & formatting

```bash
npm run lint          # ESLint (flat config, both workspaces)
npm run lint:fix
npm run format        # Prettier --write
npm run format:check  # Prettier --check
npm run typecheck     # tsc --noEmit / tsc -b per workspace
```

CI (`.github/workflows/code-quality.yml`) runs on every pull request with the
Node version from `.nvmrc`: format check, lint, typecheck, `test:coverage` (with
a PR coverage report), production build, and `npm audit --audit-level=high`.

---

## Monitoring

Metrics stack: backend (`prom-client`) → Prometheus → Grafana, plus cAdvisor
for container metrics. All services are defined in `compose.yml`.

```bash
docker compose up -d
```

| Service    | URL                     | Role                                                                            |
| ---------- | ----------------------- | ------------------------------------------------------------------------------- |
| Prometheus | <http://localhost:9090> | Scrapes every 15 s: itself, `cadvisor:8080` and `backend:3000/metrics`.         |
| Grafana    | <http://localhost:3001> | Dashboards. Default login `admin` / `admin` (change it). Prometheus datasource. |
| cAdvisor   | internal only           | Per-container CPU, memory and network. Port 8080 is not published on the host.  |

### Backend metrics

`GET /metrics` serves the Prometheus text format, prefixed `legacy_`:

| Metric                                                         | Description                                      |
| -------------------------------------------------------------- | ------------------------------------------------ |
| `legacy_http_requests_total`, `legacy_http_request_duration_seconds` | HTTP request count and latency (route, status). |
| `legacy_ws_connections_total`, `legacy_ws_disconnections_total` | WebSocket connections opened / closed.           |
| `legacy_ws_tickets_total`                                      | WebSocket tickets issued, by result.             |
| `legacy_events_produced_total`, `legacy_events_delivered_total` | Item events produced vs delivered to clients.    |
| `legacy_process_*`, `legacy_nodejs_*`                          | Node.js defaults (CPU, memory, event loop, GC).  |

Set `METRICS_TOKEN` (see `.env.example`) to require
`Authorization: Bearer <token>` on `/metrics`. Prometheus must then send it:
mount the token as a secret and uncomment the `authorization` block of the
`legacy-backend` job in `monitoring/prometheus/prometheus.yml`.

### Dashboards

Provisioned automatically from `monitoring/grafana/dashboards/`
(`monitoring/grafana/provisioning/` holds the datasource and dashboard provider):

- **Legacy backend** — HTTP (requests/s, 5xx ratio, p95 latency, by route and
  status), WebSocket & events, Node.js runtime (CPU, memory, event loop lag),
  containers.
- **cAdvisor** — detailed per-container resource usage.

To add a dashboard, drop its JSON export in `monitoring/grafana/dashboards/`;
Grafana picks it up without a restart.

## Accessibility audit (RGAA)

The frontend is audited against the
[RGAA 4](https://accessibilite.numerique.gouv.fr/) (French accessibility
referential, based on WCAG 2.1) with [Asqatasun](https://asqatasun.org/),
an open-source automated checker. The stack is defined in
`compose.asqatasun.yaml` (server, webapp, MariaDB, headless Firefox via
Selenium, MailHog) and driven by `scripts/rgaa-audit.sh`.

### Run the audit

Requirements: Docker (with Compose), `curl`, `jq`. The script calls
`sudo docker`, so it may ask for your password.

```bash
scripts/rgaa-audit.sh                       # signed-out + signed-in scenario, RGAA_4_0, level AA
scripts/rgaa-audit.sh URLS [REFERENTIAL] [LEVEL]
```

| Argument      | Default                                       | Notes                                                             |
| ------------- | --------------------------------------------- | ----------------------------------------------------------------- |
| `URLS`        | _empty_: scenario audit of the local app      | Comma-separated public URLs → plain page audit (no login).        |
| `REFERENTIAL` | `RGAA_4_0`                                    | `RGAA_4_0`, `RGAA_3_0`, `ACCESSIWEB_2_2` or `SEO`                 |
| `LEVEL`       | `AA`                                          | `A`, `AA` or `AAA`                                                |

With no `URLS`, the script runs a Selenium IDE **scenario** audit of the local
app, because every page except the login and privacy ones needs a session. It
registers (or reuses) the `rgaa-audit@example.test` account through the API,
seeds a project and a task, then audits signed out (login, register form,
`/privacy`) and signed in (`/`, `/projects`, `/projects/<id>`, `/profile`).
To cover a new page, add a step block to `scripts/rgaa-scenario.side.json`
(`open`, wait for the heading, `echo audit`). Each `echo audit` must capture a
**unique URL** (append `?audit=<name>` if needed): Asqatasun crashes with
`Duplicate entry` when an audit captures the same URL twice.

The script, in order: rebuilds/starts the app (`compose.yml`) when targeting
the local app, starts the Asqatasun stack, provisions a `Legacy` contract if
missing, checks each URL is reachable from the audit browser, launches the page
audit, polls until completion, then prints pages audited, grade, mark
(/100), failed criteria and criteria needing manual review.

The detailed report is in the Asqatasun webapp at <http://localhost:8080>
(login `admin@asqatasun.org` / `myAsqaPassword`, the image's seed account —
local use only) under **My audits**.

### Limits

Automated checks cover only a part of the RGAA criteria. Criteria reported as
_needs manual review_ (keyboard navigation, focus order, contrast on dynamic
states, screen-reader behaviour, notification announcements, ...) must be
verified by hand. A passing grade is not a compliance claim.

---

## Contributing

- Work through short-lived branches and small pull requests (see the Wiki
  contribution guide).
- Every PR requires at least one approval, passing CI, see the Definition of
  Done on the Wiki.
