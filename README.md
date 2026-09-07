# TodoList
 
## Project Summary
 
This project is based on the existing [`docker/getting-started-app`](https://github.com/docker/getting-started-app) TodoList application.
 
Core capabilities being built:
 
- Secure user authentication (GDPR-compatible)
- Project and task CRUD
- Kanban-style workflow (columns / board)
- Task priorities and deadlines
- User notifications
- Event-driven communication between components (at least one full event-driven workflow)
- Automated quality checks (code-quality gate) and a complete CI/CD pipeline, with Docker image publication
The team works in Scrum, with a prioritised backlog (MoSCoW) split across three sprints: **Foundation & Architecture → Core Features → Stabilisation & Quality**.
 
---
 
## Tech Stack
 
- See project Wiki [`here`](https://github.com/EpitechPGE45-2026/G-ING-900-PAR-9-1-legacy-9/wiki)

---

## Setup
 
### 1. Prerequisites
 
- Node.js
- npm 22
### 2. Install
 
```bash
git clone <repo-url>
cd <repo-folder>
 
# install dependencies
npm install
```
 
### 3. Environment Variables
 
Copy the example env file and fill in the values:
 
```bash
cp .env.example .env
```
 
| Variable | Description | Required? |
|---|---|---|
| `MYSQL_HOST` | MySQL host | Optional — if unset, the app falls back to a local SQLite database |
| `MYSQL_USER` | MySQL user | Required only if `MYSQL_HOST` is set |
| `MYSQL_PASSWORD` | MySQL password | Required only if `MYSQL_HOST` is set |
| `MYSQL_DB` | MySQL database name | Required only if `MYSQL_HOST` is set |
 
> Keep `.env.example` in sync whenever a new variable is introduced — this is part of the Definition of Done ("documentation updated").

---

## Run (Development)
 
```bash
npm run dev
```

- App available at: `http://localhost:3000`

### Running tests

```bash
npm run test
```

---

## Contributing
 
- Work happens through short-lived branches and small Pull Requests (see contribution guide on the Wiki).
- Every PR requires at least one approval, passing CI, and required test coverage before merge — see the Definition of Done on the Wiki.