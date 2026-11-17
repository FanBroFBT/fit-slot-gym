# FitSlot: Gym Booking System

Full-stack project: **Angular 20 (TypeScript)** frontend + **Django 5 / Django REST Framework** backend + **SQLite** database.
A member books a training session with a trainer; the database makes double booking impossible.

```
gym/
  backend/    Django API   (models, services = business rules, views, tests, seed command)
  frontend/   Angular app  (pages, api.service.ts, auth, guards, interceptor)
```

## 1. Run the backend (Terminal 1)
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows      (Mac/Linux: source venv/bin/activate)
pip install -r requirements.txt
python manage.py migrate
python manage.py seed          # 6 trainers, 12 members, ~26 bookings, 2 demo accounts
python manage.py runserver     # http://localhost:8000
```

## 2. Run the frontend (Terminal 2)
```bash
cd frontend
npm install
npm start                      # http://localhost:4200  (proxy.conf.json sends /api to Django)
```
Open http://localhost:4200. Requires Node 20.19+ / 22.12+.

## Demo accounts
| Role | Email | Password |
|---|---|---|
| Member | member@gym.kz | member123 |
| Admin | admin@gym.kz | admin123 |

## API (all under /api/)
| Request | Who | Success | Errors |
|---|---|---|---|
| POST login/ | everyone | 200 token + role | 401 |
| POST register/ | everyone | 201 | 409 email taken, 422 |
| GET trainers/ | logged in | 200 list | 401 |
| GET trainers/{id}/slots/?date=YYYY-MM-DD | logged in | 200 slots | 404, 422 |
| POST bookings/ | member | 201 booking + payment | 409 slot taken (+3 alternatives), 422 past/outside hours, 403 membership not active, 402 payment failed (rolled back) |
| GET bookings/my/ | member | 200 | 401 |
| POST bookings/{id}/cancel/ | owner or admin | 200 | 403 not owner / less than 2 h left |
| GET admin/bookings/?trainer=&status= | admin | 200 | 403 |
| GET admin/members/ , PATCH admin/members/{id}/status/ | admin | 200 | 403, 422 |
| GET admin/summary/ , GET admin/busiest-trainers/?year=&month= | admin | 200 | 403 |

Header for protected requests: `Authorization: Token <token>`.

## Where the rules live
- **Database** (`backend/bookings/models.py`): primary and foreign keys, `on_delete=PROTECT`, and the rule
  `uq_trainer_slot`: one trainer cannot have two active bookings at the same time (cancelled bookings are ignored).
- **Business rules** (`backend/bookings/services.py`): active membership, future time, trainer working hours,
  booking + payment in one transaction (`simulate_payment_failure` shows the rollback), cancel at least 2 hours before.
- **Roles** (`permissions.py`): a member cannot call admin endpoints (403).

## Tests
```bash
cd backend && python manage.py test
```
16 tests: login, trainers, valid booking, double booking 409, no login 401, past time 422, expired member 403,
cancel and re-book, member vs admin 403, payment rollback, cancel too late, database constraints.

## Build for production
`cd frontend && npx ng build` creates `frontend/dist/frontend`.
Before real deployment: set `SECRET_KEY`, `DEBUG=0` and the real `ALLOWED_HOSTS`.
