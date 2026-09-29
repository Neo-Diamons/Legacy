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

| Path        | Description                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------- |
| `backend/`  | Hono REST API in TypeScript (`@legacy/backend`). `tsx` in dev, bundled with `tsdown` for production. Drizzle ORM over SQLite by default, MySQL optional. Requests validated with `@hono/zod-openapi`; OpenAPI spec + Scalar UI served at runtime. |
| `frontend/` | Vite + React 19 + TypeScript single-page app (`@legacy/frontend`), styled with Bootstrap / react-bootstrap.       |

All commands below are run from the repository root unless stated otherwise.
Lint, formatting and CI are configured once at the root and cover both workspaces.

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

| Variable               | Description                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `FRONTEND_PORT`        | Vite dev (`5173`) / preview (`4173`) port. Seeds the default CORS allowlist.                                                         |
| `BACKEND_PORT`         | Hono API port. Default `3000`.                                                                                                      |
| `BACKEND_URL`          | Backend the dev/preview proxy forwards `/items*` to. Default `http://localhost:<BACKEND_PORT>`. Not baked into the frontend bundle.  |
| `CORS_ALLOWED_ORIGINS` | Comma-separated API origin allowlist (scheme + host + optional port). Default: `localhost` and `127.0.0.1` on `<FRONTEND_PORT>`. Invalid entries fail startup. |
| `SQLITE_DB_LOCATION`   | SQLite file path. Default `/etc/todos/todo.db`. Used unless MySQL is configured.                                                     |
| `MYSQL_HOST`           | MySQL host. Setting it (or `MYSQL_HOST_FILE`) switches persistence to MySQL; otherwise every `MYSQL_*` var is ignored.               |
| `MYSQL_PORT`           | MySQL port. Default `3306`.                                                                                                         |
| `MYSQL_USER`           | MySQL username.                                                                                                                     |
| `MYSQL_PASSWORD`       | MySQL password.                                                                                                                     |
| `MYSQL_DB`             | MySQL database name.                                                                                                                |

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
scripts/rgaa-audit.sh                       # 3 default routes, RGAA_4_0, level AA
scripts/rgaa-audit.sh URLS [REFERENTIAL] [LEVEL]
```

| Argument      | Default                                       | Notes                                                    |
| ------------- | --------------------------------------------- | -------------------------------------------------------- |
| `URLS`        | `/`, `/projects`, `/profile` of the local app | Comma-separated. Local app is reached via `host.docker.internal`. |
| `REFERENTIAL` | `RGAA_4_0`                                    | `RGAA_4_0`, `RGAA_3_0`, `ACCESSIWEB_2_2` or `SEO`        |
| `LEVEL`       | `AA`                                          | `A`, `AA` or `AAA`                                       |

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
*needs manual review* (keyboard navigation, focus order, contrast on dynamic
states, screen-reader behaviour, notification announcements, ...) must be
verified by hand. A passing grade is not a compliance claim.

---

## Contributing

- Work through short-lived branches and small pull requests (see the Wiki
  contribution guide).
- Every PR requires at least one approval, passing CI, see the Definition of
  Done on the Wiki.
