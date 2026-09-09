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

| Path        | Description                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------------- |
| `backend/`  | Hono REST API in TypeScript (`@legacy/backend`), run with `tsx`. SQLite by default, MySQL optional. |
| `frontend/` | Vite + React 19 + TypeScript single-page app (`@legacy/frontend`).                                  |

All commands below are run from the repository root unless stated otherwise.
Lint, formatting and CI are configured once at the root and cover both workspaces.

---

## Setup

### 1. Prerequisites

- **Node.js 22.9+** (the backend relies on `node --env-file-if-exists`)
- npm 10+ (ships with Node 22)

### 2. Install

```bash
git clone <repo-url>
cd <repo-folder>
npm install
```

`npm install` at the root installs dependencies for every workspace.

### 3. Environment variables

Copy the example file and adjust the values:

```bash
cp .env.example .env
```

The backend loads this root `.env` automatically on startup
(`node --env-file-if-exists=../.env` — no `dotenv` dependency). If the file is
missing, it falls back to the real process environment, which is the expected
mode in production and containers.

The frontend has no environment variables of its own: it calls the API using
same-origin paths (`fetch('/items')`).

| Variable             | Description                                                                                                                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SQLITE_DB_LOCATION` | Path to the SQLite database file, used when no MySQL host is configured. This is the default persistence mode; the file and its parent directory are created on startup. Defaults to the repo-local `data/todo.db` (gitignored) if unset. |
| `MYSQL_HOST`         | Hostname of the MySQL server. Setting it switches persistence from SQLite to MySQL (see `backend/service/item.service.ts`). If unset, all other `MYSQL_*` variables are ignored.                                                             |
| `MYSQL_USER`         | MySQL username. Only read when `MYSQL_HOST` is set.                                                                                                                                                                                       |
| `MYSQL_PASSWORD`     | MySQL password. Only read when `MYSQL_HOST` is set.                                                                                                                                                                                       |
| `MYSQL_DB`           | MySQL database/schema name. Only read when `MYSQL_HOST` is set.                                                                                                                                                                           |

> Each `MYSQL_*` variable also has a `_FILE` variant (e.g. `MYSQL_PASSWORD_FILE`)
> that points to a file containing the value — the pattern used for
> Docker/Kubernetes secrets. If both are set, the `_FILE` variant wins.

> Keep `.env.example` in sync whenever a new variable is introduced — it is part
> of the Definition of Done ("documentation updated").

---

## Development

```bash
npm run dev
```

Runs both workspaces together (via `concurrently`):

- **Frontend** — Vite dev server: <http://localhost:5173>
- **Backend** — Hono API: <http://localhost:3000>

The Vite dev server proxies `/items` to the backend, so no CORS configuration is
needed locally. Run the sides independently with:

```bash
npm run dev:backend
npm run dev:frontend
```

---

## Production build

```bash
npm run build   # tsc -b, then vite build -> frontend/dist
npm start       # starts the backend API only (port 3000)
```

`npm run build` produces a static bundle in `frontend/dist`. Because the client
calls the API with same-origin paths, `frontend/dist` must be served behind a
proxy or CDN that forwards `/items` and `/items/*` to the backend. The backend
enables CORS, but there is currently no build-time setting for a cross-origin
API URL — using a separate origin would require changing the client code.

---

## API

| Method   | Path         | Description                                                 |
| -------- | ------------ | ----------------------------------------------------------- |
| `GET`    | `/items`     | List all items                                              |
| `POST`   | `/items`     | Create an item (`{ "name": string }`)                       |
| `PUT`    | `/items/:id` | Update an item (`{ "name": string, "completed": boolean }`) |
| `DELETE` | `/items/:id` | Delete an item                                              |

---

## Tests

```bash
npm run test
```

Runs the backend Jest suite (`backend/spec/`), TypeScript via `ts-jest`. Tests
use SQLite against an isolated file: `backend/.env.test` sets
`SQLITE_DB_LOCATION=./test.db` and is loaded automatically
(`node --env-file-if-exists=.env.test`), so `npm run test` works with no extra
setup and never touches your dev database.

---

## Lint & formatting

```bash
npm run lint          # ESLint (flat config, both workspaces)
npm run lint:fix
npm run format        # Prettier --write
npm run format:check  # Prettier --check
```

CI (`.github/workflows/code-quality.yml`) runs format check, lint and tests on
every pull request using Node 22.

---

## Contributing

- Work through short-lived branches and small pull requests (see the Wiki
  contribution guide).
- Every PR requires at least one approval, passing CI and the required test
  coverage before merge — see the Definition of Done on the Wiki.
