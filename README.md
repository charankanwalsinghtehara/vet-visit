# VetCare MVP

A React/Vite client and Django REST API for a multi-clinic veterinary care workflow. Features include role-based accounts, clinic directory, pet profiles, appointment scheduling, veterinarian-authored medical records, safety-first AI intake, clinician note drafting, invoices, and Stripe-hosted checkout. Clinic-scoped and owner-scoped access is enforced by the API; the frontend is not an authorization boundary.

## Stack

- Python 3.12+, Django 5.2 LTS, Django REST Framework 3.16
- SQLite for the small-scale database, Redis 7 and Celery 5 for optional background jobs
- Node.js 22, React 18, React Router 7, Vite 6, Tailwind CSS 4
- Axios, React Router, React Hook Form, Recharts, Lucide React
- OpenAI Python SDK for optional AI-assisted workflows; Stripe Python SDK for hosted checkout

Versions are pinned in `backend/requirements.txt` and `frontend/package.json`.

## Run locally

Backend:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:DJANGO_SECRET_KEY = "local-only-change-me"
$env:DJANGO_DEBUG = "true"
python manage.py migrate
python manage.py runserver
```

Frontend, in a separate terminal:

```powershell
cd frontend
npm ci
$env:VITE_API_URL = "http://localhost:8000/api"
npm run dev
```

Open the frontend at [http://localhost:5173](http://localhost:5173). The API is at [http://localhost:8000/api](http://localhost:8000/api). The backend stores data in a local SQLite database at `backend/db.sqlite3` by default. Set `SQLITE_PATH` to choose another database file location.

Create an administrative login with `python manage.py createsuperuser` from the backend directory. Sign in to [http://localhost:8000/admin/](http://localhost:8000/admin/). Create a clinic, then edit the superuser and assign the `admin` role and clinic. Create veterinarian accounts and assign each to that clinic. Pet owners can register from the client.

### Demo accounts and sample data

After migrations, run `python manage.py seed_demo` from the backend directory. The command creates fictional clinics in Bengaluru and Pune, demo users, pets, appointments, medical records, and INR invoices. It is idempotent and only runs when Django debug mode is enabled. All clinical details are fictional examples, not veterinary advice.

The demo accounts share this local-only password: `VetCareDemo2026!`

| Role | Username |
| --- | --- |
| Pet owner | `demo-owner` |
| Veterinarian | `demo-vet` |
| Clinic administrator | `demo-admin` |
| Receptionist | `demo-receptionist` |

Change or remove these accounts before exposing a development environment to others. The seed command refuses to run when `DEBUG` is disabled.

### AI and payments

Set `OPENAI_API_KEY` to enable non-emergency symptom guidance and clinician note drafting. Requests are sent to the configured OpenAI model. Emergency phrase screening runs locally before an AI call and escalates to an emergency clinic; this assistant does not diagnose or replace veterinary care. Do not send information to the AI provider unless your clinic has reviewed its privacy terms and obtained any required consent.

Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to enable Stripe-hosted card checkout. In Stripe test mode, forward `checkout.session.completed` events to `http://localhost:8000/api/billing/stripe/webhook/` (for example, with Stripe CLI), then configure the webhook signing secret in the backend environment. New invoice amounts are denominated in Indian rupees (INR) and stored in paise; invoice status changes to paid only after a verified Stripe webhook. Existing invoices retain their originally recorded currency. No card details are stored by VetCare. `APP_BASE_URL` controls checkout return links (use `http://localhost:5173` for the local Vite frontend).

Without provider credentials, emergency phrase escalation and invoice management remain available, while AI replies and card checkout display a not-configured state. No fake diagnoses or payment confirmations are generated.

In debug mode, `PAYMENTS_DEMO_MODE=true` enables a no-charge payment simulation for walkthroughs. It records a separate `demo_paid` status and never claims Stripe confirmed a payment. Keep it disabled outside local development. If OpenAI is not configured, routine symptom submissions receive clearly labeled conservative offline guidance; this is not an AI assessment and cannot rule out urgent illness.

In local development, email is written to the backend terminal. To use SMTP, configure `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, and `EMAIL_USE_TLS` in the backend environment.

## Run checks

Backend (uses SQLite):

```powershell
cd backend
$env:DJANGO_SECRET_KEY = "local-only-change-me"
$env:DJANGO_DEBUG = "true"
python manage.py migrate
python manage.py test
```

Frontend:

```powershell
cd frontend
npm install
npm run build
```

Set `VITE_API_URL` when the API is not at `http://localhost:8000/api`. The value may be the backend origin or the full `/api` URL.

## API outline

- `POST /api/auth/register/`, `POST /api/auth/login/`, `POST /api/auth/refresh/`, `POST /api/auth/logout/`, `GET /api/auth/me/`
- `GET /api/ai/status/`, `POST /api/ai/triage/`, `POST /api/ai/note-draft/`
- `/api/invoices/`, `/api/invoices/{id}/checkout/`, `POST /api/billing/stripe/webhook/`
- `GET /api/clinics/`, `GET /api/clinics/{id}/veterinarians/`
- `/api/pets/`, `/api/appointments/`, `/api/records/`

Responses use page-number pagination (`count`, `next`, `previous`, `results`). Login returns a short-lived access token; the refresh token is held in an HttpOnly, SameSite cookie and is not exposed to JavaScript. The API scopes owner data to the authenticated owner and staff data to the assigned clinic. Appointment conflicts are checked transactionally under a clinic-row lock.

## MVP scope and production considerations

The AI tools are decision-support only and are not a substitute for a veterinarian. Payment settlement depends on Stripe credentials and webhook delivery. Prescriptions, vaccinations, inventory, advanced audit history, password reset, notification schedules, clinic availability calendars, and retrieval-augmented veterinary references remain outside this prototype.

### Deploy to Render

The repository includes a Render Blueprint in `render.yaml` for a native Python API and static frontend. In Render, create a Blueprint Instance from this repository and apply the configuration. The backend start command runs migrations before Gunicorn, and the Blueprint generates a Django secret. If Render reports existing services with the same names, update those services to match `render.yaml` rather than creating duplicate services.

Remove `DATABASE_URL` from the backend service environment; this setup uses SQLite and does not need a managed database service. SQLite starts as a separate, empty database and does not copy data from an existing PostgreSQL service, so export any data you need before removing that service.

SQLite is intended here for temporary, small-scale use. Render's local filesystem is ephemeral by default, so the database file can be lost when the service restarts or is redeployed. To retain it, attach a persistent disk mounted at `/var/data` and set `SQLITE_PATH=/var/data/db.sqlite3`. SQLite also serializes writes and does not provide the row-locking guarantees needed for concurrent appointment booking; move to a managed production database before relying on concurrent use or important data.

Deploy the frontend as a Render Static Site with the repository root directory set to `frontend`, build command `npm ci && npm run build`, and publish directory `dist`. Set `VITE_API_URL` to the backend URL, for example `https://vet-visit-api.onrender.com/api`. Rebuild the static site after changing this variable.

Before production deployment, use a generated secret, HTTPS, restricted host/CORS settings, managed production database and Redis services, backup/restore procedures, monitoring, migrations reviewed and committed, and a security/privacy review. Do not use real patient data until the deployment and applicable privacy requirements have been reviewed.
