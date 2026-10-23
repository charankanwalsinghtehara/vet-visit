# VetCare MVP

A React/Vite client and Django REST API for a multi-clinic veterinary care workflow. Features include role-based accounts, clinic directory, pet profiles, appointment scheduling, veterinarian-authored medical records, safety-first AI intake, clinician note drafting, invoices, and Stripe-hosted checkout. Clinic-scoped and owner-scoped access is enforced by the API; the frontend is not an authorization boundary.

## Stack

- Python 3.12+, Django 5.2 LTS, Django REST Framework 3.16
- PostgreSQL 16, Redis 7, Celery 5
- Node.js 22, React 18, React Router 7, Vite 6, Tailwind CSS 4
- Axios, React Router, React Hook Form, Recharts, Lucide React
- OpenAI Python SDK for optional AI-assisted workflows; Stripe Python SDK for hosted checkout

Versions are pinned in `backend/requirements.txt` and `frontend/package.json`.

## Run locally with Docker Compose

1. Copy `.env.example` to `.env` and replace both placeholder secrets. For example, generate `DJANGO_SECRET_KEY` with `python -c "import secrets; print(secrets.token_urlsafe(64))"`.
2. Start the application with `docker compose up --build`.
3. Open the client at [http://localhost:8080](http://localhost:8080). The API is at [http://localhost:8000/api](http://localhost:8000/api).
4. Create an administrative login with `docker compose exec backend python manage.py createsuperuser`.
5. Sign in to [http://localhost:8000/admin/](http://localhost:8000/admin/). Create a clinic, then edit the superuser and assign the `admin` role and clinic. Create veterinarian accounts and assign each to that clinic. Pet owners can register from the client.

### AI and payments

Set `OPENAI_API_KEY` to enable non-emergency symptom guidance and clinician note drafting. Requests are sent to the configured OpenAI model. Emergency phrase screening runs locally before an AI call and escalates to an emergency clinic; this assistant does not diagnose or replace veterinary care. Do not send information to the AI provider unless your clinic has reviewed its privacy terms and obtained any required consent.

Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to enable Stripe-hosted card checkout. In Stripe test mode, forward `checkout.session.completed` events to `http://localhost:8000/api/billing/stripe/webhook/` (for example, with Stripe CLI), then place the webhook signing secret in `.env`. Invoice amounts are fixed server-side in USD cents; invoice status changes to paid only after a verified Stripe webhook. No card details are stored by VetCare. `APP_BASE_URL` controls checkout return links (`http://localhost:8080` for Compose, or `http://localhost:5173` for Vite).

Without provider credentials, emergency phrase escalation and invoice management remain available, while AI replies and card checkout display a not-configured state. No fake diagnoses or payment confirmations are generated.

In debug mode, `PAYMENTS_DEMO_MODE=true` enables a no-charge payment simulation for walkthroughs. It records a separate `demo_paid` status and never claims Stripe confirmed a payment. Keep it disabled outside local development. If OpenAI is not configured, routine symptom submissions receive clearly labeled conservative offline guidance; this is not an AI assessment and cannot rule out urgent illness.

In local development, email is written to the backend container log. To use SMTP, configure `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, and `EMAIL_USE_TLS` in `.env`.

## Run checks without Docker

Backend (PostgreSQL recommended):

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
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

Set `VITE_API_URL` when the API is not at `http://localhost:8000/api`.

## API outline

- `POST /api/auth/register/`, `POST /api/auth/login/`, `POST /api/auth/refresh/`, `POST /api/auth/logout/`, `GET /api/auth/me/`
- `GET /api/ai/status/`, `POST /api/ai/triage/`, `POST /api/ai/note-draft/`
- `/api/invoices/`, `/api/invoices/{id}/checkout/`, `POST /api/billing/stripe/webhook/`
- `GET /api/clinics/`, `GET /api/clinics/{id}/veterinarians/`
- `/api/pets/`, `/api/appointments/`, `/api/records/`

Responses use page-number pagination (`count`, `next`, `previous`, `results`). Login returns a short-lived access token; the refresh token is held in an HttpOnly, SameSite cookie and is not exposed to JavaScript. The API scopes owner data to the authenticated owner and staff data to the assigned clinic. Appointment conflicts are checked transactionally under a clinic-row lock.

## MVP scope and production considerations

The AI tools are decision-support only and are not a substitute for a veterinarian. Payment settlement depends on Stripe credentials and webhook delivery. Prescriptions, vaccinations, inventory, advanced audit history, password reset, notification schedules, clinic availability calendars, and retrieval-augmented veterinary references remain outside this prototype.

The Compose setup is for local development. Before production deployment, use a generated secret, `DEBUG=false`, HTTPS, restricted host/CORS settings, a managed PostgreSQL/Redis service, static asset hosting, a production WSGI command, backup/restore procedures, monitoring, migrations reviewed and committed, and a security/privacy review. Do not use real patient data until the deployment and applicable privacy requirements have been reviewed.
