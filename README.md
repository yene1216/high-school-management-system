# School Management System (Django REST + React)

Implements the MVP scope of the project spec. Architecture, ERD, API list and phase status are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

> **Important — read before first run.** This code was written without access to Django or npm, so it has **not been executed**. The backend has been syntax-checked and the frontend parsed, but no test, migration or build has run. Expect to fix errors on first run. Migrations are not committed; the first run generates them, and you must commit the result. **Going live: follow [`docs/PRODUCTION.md`](docs/PRODUCTION.md)** — its section 1 is a blocking gate.

## Quick start (Docker)

```bash
cp .env.example .env        # set DJANGO_SECRET_KEY and POSTGRES_PASSWORD
docker compose up --build   # generates migrations (AUTO_MAKEMIGRATIONS=1), migrates, starts API, worker, beat, frontend
make seed                   # demo school, users for each role, students, fees, attendance, grades
```

* App: http://localhost:5173 · API docs: http://localhost:8000/api/docs/
* `seed_demo` prints the demo accounts (`admin@demo.school`, `teacher1@…`, `parent1@…`, `accountant@…`, …) and a random password unless you set `DEMO_PASSWORD`.
* Commit the generated `backend/apps/*/migrations/0001_initial.py` files.

## Without Docker (SQLite, no Redis)

```bash
cd backend && python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
cd .. && make init                     # makemigrations + migrate + seed_demo
cd backend && DJANGO_DEBUG=1 python manage.py runserver
cd ../frontend && npm install && npm run dev
```
With `DJANGO_DEBUG=1` Celery runs tasks inline, so notifications appear without a worker.

## Tests

```bash
make test        # backend: permissions, attendance, grades, billing, webhook
cd frontend && npm install && npm run typecheck
```

## Try the core workflows

1. Sign in as `teacher1@demo.school` → Attendance → mark a student absent → save.
2. Sign in as `parent1@demo.school` → the child's card shows today's status; Notifications shows the alert (email prints to the backend console).
3. Sign in as `accountant@demo.school` → Fees → Record payment (partial, then the rest).
4. Sign in as `admin@demo.school` → **Setup** (classes, fees, users), **Corrections** (approve attendance changes).
5. Toggle **አማርኛ** in the header.

## Before production

* Follow `docs/PRODUCTION.md` (configuration, deploy, backups, checklist). Production stack: `docker-compose.prod.yml`.
* Have a native Amharic speaker review `notifications/templates_default.py`.
* Add a real payment-gateway adapter in `payments/providers.py`; run a security review and load test.
