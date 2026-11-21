# Task Manager

A full-stack task management web app.

- **Frontend:** HTML, CSS, JavaScript (no framework)
- **Backend:** Python, FastAPI
- **Database:** MySQL (via SQLAlchemy + PyMySQL)

Features: dashboard summary, task list with search / filter / sort, create & edit form, task details, quick status change, delete, validation on both sides, loading / empty / error states, responsive layout.

```
task-manager/
├── backend/
│   ├── app/
│   │   ├── main.py          # app wiring, CORS, error handlers, serves frontend
│   │   ├── config.py        # reads .env
│   │   ├── database.py      # engine + session dependency
│   │   ├── models.py        # SQLAlchemy Task model
│   │   ├── schemas.py       # Pydantic validation / response models
│   │   ├── crud.py          # database queries
│   │   └── routers/tasks.py # REST endpoints
│   ├── tests/test_tasks.py  # API tests (SQLite in memory)
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── index.html
│   ├── css/styles.css
│   └── js/ (config, api, ui, views, app)
├── database/schema.sql
└── docs/PLANNING.md         # Task 1 answers
```

## 1. What to install

| Software | Version | Check |
|---|---|---|
| Python | 3.10+ | `python --version` |
| MySQL Server | 8.0+ | `mysql --version` |
| Git | any | `git --version` |

Python packages (installed in step 3): fastapi, uvicorn, SQLAlchemy, PyMySQL, cryptography, python-dotenv, pydantic, pytest, httpx.

## 2. Set up the database

```bash
mysql -u root -p < database/schema.sql
```

This creates the `task_manager` database and the `tasks` table. (The app also creates the table automatically on startup if it is missing, but the database itself must exist.)

Recommended: create a dedicated user instead of using root:

```sql
CREATE USER 'task_user'@'localhost' IDENTIFIED BY 'choose_a_password';
GRANT ALL PRIVILEGES ON task_manager.* TO 'task_user'@'localhost';
FLUSH PRIVILEGES;
```

## 3. Set up the backend

```bash
cd backend
python -m venv venv
# Windows:  venv\Scripts\activate
# macOS/Linux:  source venv/bin/activate
pip install -r requirements.txt
```

### Environment configuration

```bash
cp .env.example .env        # Windows: copy .env.example .env
```

Edit `.env`:

| Variable | Meaning | Example |
|---|---|---|
| `DB_HOST` | MySQL host | `localhost` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_USER` | MySQL user | `task_user` |
| `DB_PASSWORD` | MySQL password | *your password* |
| `DB_NAME` | database name | `task_manager` |
| `DATABASE_URL` | *(optional)* full URL, overrides the DB_* values | `mysql+pymysql://user:pass@localhost:3306/task_manager` |
| `CORS_ORIGINS` | *(optional)* allowed origins if the frontend is hosted separately | `http://localhost:5500` |

`.env` is git-ignored — never commit real credentials. Only `.env.example` (placeholders) is committed.

## 4. Run the app

```bash
cd backend
uvicorn app.main:app --reload
```

- App (frontend): http://localhost:8000
- Interactive API docs (Swagger): http://localhost:8000/docs

FastAPI serves the frontend, so one command runs everything. To host the frontend separately (e.g. VS Code Live Server), set `API_BASE` in `frontend/js/config.js` to `http://localhost:8000/api` and add the frontend's origin to `CORS_ORIGINS`.

## 5. Run the tests

```bash
cd backend
pytest -v
```

Tests use in-memory SQLite, so MySQL does not need to be running.

## Data model

Table `tasks`:

| Column | Type | Notes |
|---|---|---|
| id | INT PK AUTO_INCREMENT | |
| title | VARCHAR(150) NOT NULL | |
| description | TEXT NULL | max 2000 chars |
| status | ENUM('Pending','In Progress','Completed') | default Pending |
| priority | ENUM('Low','Medium','High') | default Medium |
| due_date | DATE NULL | |
| created_at | DATETIME | default now |
| updated_at | DATETIME | auto-updates on change |

Indexes on `status`, `priority`, `due_date`.

## API reference

Base URL: `http://localhost:8000/api`

| Method | Endpoint | Purpose | Success |
|---|---|---|---|
| GET | `/tasks` | List tasks (filters below) | 200 |
| GET | `/tasks/stats` | Counts for the dashboard | 200 |
| GET | `/tasks/{id}` | One task | 200 |
| POST | `/tasks` | Create | 201 |
| PUT | `/tasks/{id}` | Replace all fields | 200 |
| PATCH | `/tasks/{id}` | Partial update (e.g. status) | 200 |
| DELETE | `/tasks/{id}` | Delete | 204 |
| GET | `/health` | Health check | 200 |

**List query params:** `status` (Pending / In Progress / Completed), `priority` (Low / Medium / High), `search` (title or description), `sort` (newest / oldest / due_date / title), `skip`, `limit`.

**Error codes:** `404` not found · `422` validation failed · `503` database unavailable · `500` unexpected error. All errors return JSON with a `detail` message; validation errors also include `errors: [{field, message}]`.

### Sample requests

Create:
```bash
curl -X POST http://localhost:8000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Prepare demo","description":"Slides + screen recording","priority":"High","status":"Pending","due_date":"2026-12-01"}'
```
Response `201`:
```json
{"id":1,"title":"Prepare demo","description":"Slides + screen recording","status":"Pending","priority":"High","due_date":"2026-12-01","created_at":"2026-11-21T19:50:00","updated_at":"2026-11-21T19:50:00"}
```

Filter and search:
```bash
curl "http://localhost:8000/api/tasks?status=In%20Progress&priority=High&search=demo"
```

Change status only:
```bash
curl -X PATCH http://localhost:8000/api/tasks/1 -H "Content-Type: application/json" -d '{"status":"Completed"}'
```

Delete:
```bash
curl -X DELETE http://localhost:8000/api/tasks/1      # 204 No Content
```

Validation error (`422`):
```json
{"detail":"Validation failed.","errors":[{"field":"title","message":"Title cannot be empty or only spaces."}]}
```

## How the pieces work together

- **Frontend → backend:** `frontend/js/api.js` calls the REST API with `fetch` and JSON. Errors become an `ApiError` carrying the message and per-field errors, which the form shows next to the inputs.
- **Storing data:** the router passes validated Pydantic objects to `crud.py`, which uses SQLAlchemy to write to MySQL. Data is stored in MySQL, so it survives app restarts.
- **Retrieving data:** filters/search/sort are translated to a SQL `WHERE ... ORDER BY ... LIMIT` query; rows are serialised through `TaskOut`.
- **Validation:** browser checks first (fast feedback), backend re-checks everything (never trust the client), and MySQL ENUM/NOT NULL is the last safety net.

## Testing

Automated: `pytest -v` covers create, list, get, full/partial update, delete, 404s, validation failures, filters, search, sort, and stats.

Manual checklist:
1. Create a task with an empty title → inline error, nothing saved.
2. Create a valid task → toast + details page.
3. Change status from the list dropdown → dashboard counts update.
4. Filter by status/priority and search by keyword → list updates; no matches shows the empty state.
5. Edit a task, delete a task (confirm dialog).
6. Stop MySQL / backend → error state with "Try again".
7. Restart the backend → tasks are still there (persistence).
8. Resize to phone width → hamburger menu, stacked cards.

## Limitations and future improvements

- No user accounts: all tasks are shared (next: login + `user_id` ownership).
- No pagination controls in the UI (API already supports `skip`/`limit`).
- No database migrations (Alembic would be the next step); the table is created with `create_all` / `schema.sql`.
- Search uses `LIKE`; a MySQL FULLTEXT index would scale better.
- Tasks with no due date sort first when sorting by due date in MySQL.
- No frontend automated tests (would add Playwright for the main flows).
- Deployment (Docker + managed MySQL) not included.
