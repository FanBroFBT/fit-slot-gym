# FitSlot — Week 13 Integrated Demo

Full-stack gym booking system for Almaty (KZT), built with Django REST Framework and Angular standalone components.

> **Version warning:** This deliverable was built from a previously supplied `gym.zip` source snapshot. The live GitHub `main` has additional changes and cannot be safely overwritten with this ZIP. Read `WEEK13_REPORT.md` before merging.

## Backend (Windows PowerShell)

```powershell
cd backend
py -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python manage.py makemigrations
python manage.py migrate
python manage.py seed
python manage.py test
python manage.py runserver
```

The `seed` step is only for an empty demo database. On an existing database, only run migrations and preserve your data.

## Frontend (a second terminal)

```powershell
cd frontend
npm ci
npm start
```

Open <http://localhost:4200>. The Angular proxy routes `/api` to Django at <http://127.0.0.1:8000>.

For a static production build run `npx ng build`. Before deployment, configure `SECRET_KEY`, set `DEBUG=0`, configure `ALLOWED_HOSTS`, use HTTPS and a production-grade database, and enable suitable deployment monitoring. Do not commit `.env` or real provider keys.

## Demo accounts

- Member: `member@gym.kz` / `member123`
- Admin: `admin@gym.kz` / `admin123`

Demo accounts are for local development only. In production, replace all demo credentials.

## Features

- Token-based member/admin login, password validation and 5/min login throttling
- Individual training: 5000 KZT per session (exclusive trainer slot)
- Group training: 2500 KZT per person, maximum six participants per trainer/slot
- Transactional payments and wallet/subscriptions; no double charge for rescheduling
- 100% refund at least 24 hours before, 50% from 2–24 hours, no cancellation under 2 hours
- Cross-trainer member overlap prevention, loyalty 10% cashback on fifth paid booking
- Notification bell, reminders, member-owned notifications and read/unread API
- Trainer profiles with review breakdown, bio, experience and demo certificates
- AI Coach: DeepSeek, Groq, Gemini or local database-based fallback
- Kazakh, Russian, English UI labels, dark/light/neon theme settings

## Endpoint examples

`GET /api/trainers/`, `GET /api/trainers/T-01/`, `GET /api/trainers/T-01/slots/?date=YYYY-MM-DD&training_type=group`, `POST /api/bookings/`, `GET /api/notifications/`, `POST /api/notifications/read/`, `POST /api/ai/chat/`.

```json
{
  "trainer_id": "T-01",
  "session_start": "2026-11-25 14:00",
  "training_type": "group",
  "payment_method": "Card",
  "simulate_payment_failure": false
}
```

AI Chat request: `{ "message": "Recommend a yoga trainer", "lang": "en" }`. Requires `Authorization: Token <token>`. The fallback works without any provider key; to use DeepSeek put `DEEPSEEK_API_KEY=...` in `backend/.env`. Keys must never be placed in Angular code. The configured AI provider receives contextual information about the signed-in user, including wallet and workout statistics, so obtain the appropriate user consent before enabling a provider in a real deployment.

See `WEEK13_REPORT.md` for modified paths, migration warnings, test results and 5-student defense summaries.
