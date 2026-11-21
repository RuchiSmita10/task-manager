# Task 1 — Application Planning & Structure

## 1. Technology stack and why

| Layer | Choice | Why |
|---|---|---|
| Frontend | HTML, CSS, vanilla JavaScript (ES6+) | No build step, easy to explain line by line; a small hash-router SPA is enough for four screens. |
| Backend | Python 3 + **FastAPI** | Automatic request validation (Pydantic), built-in interactive docs at `/docs`, clean status-code handling, fast. |
| ORM / driver | SQLAlchemy 2 + PyMySQL | Parameterised queries (prevents SQL injection), models map cleanly to the table. |
| Database | **MySQL 8** | Task data is structured and relational; ENUM/DATE types enforce valid values; indexes on filter columns; mature and widely deployed. |
| Tests | pytest + FastAPI TestClient | Fast API tests, run against in-memory SQLite so no MySQL is needed. |

## 2. Features and user journey

**Features:** dashboard summary (total / pending / in progress / completed / overdue), task list with search, status & priority filters and sorting, create and edit task, task details page, quick status change, delete with confirmation, toast feedback, loading / empty / error states.

**User journey**
1. User opens the app → **Dashboard** shows counts and the 5 most recent tasks.
2. Clicks **+ New Task** → fills the form → client-side validation → saved → lands on **Task Details**.
3. Opens **Tasks** → searches or filters ("High priority, In Progress") → changes a task's status from the dropdown as work progresses.
4. Clicks a title → **Task Details** → **Edit** or **Delete**.
5. Dashboard stat cards link to the list pre-filtered by status.

## 3. Data model

Single table `tasks` (full DDL in `database/schema.sql`):

| Column | Type | Notes |
|---|---|---|
| id | INT, PK, auto-increment | |
| title | VARCHAR(150), NOT NULL | required |
| description | TEXT, NULL | optional, ≤ 2000 chars (validated) |
| status | ENUM('Pending','In Progress','Completed') | default `Pending` |
| priority | ENUM('Low','Medium','High') | default `Medium` |
| due_date | DATE, NULL | optional |
| created_at | DATETIME | default `CURRENT_TIMESTAMP` |
| updated_at | DATETIME | auto-updated on every change |

Indexes: `status`, `priority`, `due_date` (used by filters, sorting and the overdue count).

*Why one table:* the brief has no users/teams in the core scope. Extension path: add `users` and `tasks.user_id` (FK) for ownership.

## 4. Architecture overview

```
Browser (HTML/CSS/JS)  --fetch JSON-->  FastAPI  --SQLAlchemy-->  MySQL
```

**Backend (`backend/app`)** — layered so each file has one job:
- `routers/tasks.py` – HTTP layer: routes, status codes, 404 handling
- `schemas.py` – Pydantic validation + response shapes
- `crud.py` – all database queries (filters, search, stats)
- `models.py` – SQLAlchemy table definition
- `database.py` / `config.py` – engine, session dependency, `.env` settings
- `main.py` – app wiring, CORS, global error handlers, serves the frontend

**Frontend (`frontend/js`)**
- `api.js` – only place that calls `fetch`; normalises errors
- `ui.js` – reusable helpers (escape HTML, badges, toasts, state views, task card)
- `views.js` – one render function per screen
- `app.js` – hash router (`#/`, `#/tasks`, `#/tasks/new`, `#/tasks/:id`, `#/tasks/:id/edit`)

FastAPI serves the frontend files itself, so the whole app runs from one command and there are no CORS issues.
