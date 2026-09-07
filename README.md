# TodoList → Kanban Rework
 
## Project Summary
 
This project takes the existing [`docker/getting-started-app`](https://github.com/docker/getting-started-app) TodoList application and reworks it into a maintainable, scalable, production-ready **Kanban-style task management app**.
 
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
 
- **Node.js** / **npm**

---
 
## Setup
 
### 1. Prerequisites
 
- Node.js
- npm
### 2. Install
 
```bash
git clone <repo-url>
cd <repo-folder>
 
# install dependencies
npm install
```
