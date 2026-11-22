# FitSlot Week 13 — Engineering Report & Team Defense

## Important provenance and integration warning

This implementation was produced from the earlier `gym.zip` archive in the project file library, not from a successfully cloned checkout of `https://github.com/FanBroFBT/fit-slot-gym` at its current HEAD. Public GitHub code was consulted to confirm architecture and newer features. The two snapshots are not identical; the current GitHub tree already includes wallet, reviews, security, stats and additional Angular pages. The distributed ZIP includes implementations of these features but **must not overwrite the current remote branch without a real file-by-file merge and rerunning migrations/tests on that checkout**. The new `0004` and `0005` migrations are specific to the archive's existing `0001`–`0003` chain. Do not copy them unchanged over a newer migration chain.

No GitHub commit was performed. No real AI service call or live booking checkout was executed. The integrations use server-side keys configured by the deployer.

## Validation actually performed

- `python manage.py check`: zero issues.
- `python manage.py makemigrations --check --dry-run`: no pending changes.
- `python manage.py migrate`: succeeded on the archived source baseline.
- `python manage.py test`: **29 tests passed**, including 16 legacy tests, Week 13 scenarios and security/profile checks.
- `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json`: passed.
- `node node_modules/@angular/compiler-cli/bundles/src/bin/ngc.js -p tsconfig.app.json`: passed (TypeScript + Angular template compilation).
- `python manage.py seed`: succeeded on a clean migrated SQLite database.
- Full `npm run build` and external AI provider calls were **not verified** in this environment: the available historical `node_modules` bundle contains Windows-native dependencies and the execution environment lacks external network access. A clean `npm ci && npm run build` is recommended on the target machine.

## Week 13 files

**Backend added**

- `backend/bookings/ai_coach.py` — DeepSeek (`deepseek-chat`), Groq and Gemini providers; strict message validation, database context, local fallback and trainer tag parsing.
- `backend/bookings/clock.py` — consistent local clock helper.
- `backend/bookings/password_validators.py` — strong password policy.
- `backend/bookings/migrations/0004_notification_review_trainercertificate_and_more.py` — model schema and constraints.
- `backend/bookings/migrations/0005_week13_trainer_demo_certificates.py` — populate existing trainer biographies and demo qualifications.
- `backend/.env.example` — safe credential configuration template.

**Backend modified**

- `backend/bookings/models.py` — individual/group bookings, wallet, reviews, trainer profiles, certificates, notifications, unique constraints.
- `backend/bookings/services.py` — capacity locks, payments, refunds, rescheduling, loyalty rewards, reminders, statistics and reviews.
- `backend/bookings/serializers.py` — complete trainer, booking, notification and payment-related response data.
- `backend/bookings/views.py` — AI chat, notifications, trainer detail/reviews, group choice, profile/password, wallet and statistics APIs.
- `backend/bookings/urls.py` — route registration.
- `backend/bookings/tests.py` — 29 total integration and model tests.
- `backend/bookings/management/commands/seed.py` — demo trainer bios, experience and demo certificate records.
- `backend/config/settings.py` — strong password validation and login throttle scope.

**Frontend added**

- `frontend/src/app/core/ai-coach-widget.ts` — responsive chat with trainer booking navigation.
- `frontend/src/app/core/notification-bell.ts` — unread count, dropdown, mark-read, 30-second refresh.
- `frontend/src/app/core/theme.service.ts` — dark, light and neon themes.
- `frontend/src/app/core/i18n.service.ts` — English/Kazakh/Russian dictionary and text refresh.
- `frontend/src/app/pages/trainers.ts` — full trainer profile, stars/reviews/certificates and slot selector.
- `frontend/src/app/pages/wallet.ts`, `frontend/src/app/pages/stats.ts`, `frontend/src/app/pages/profile.ts` — preserved feature parity with the publicly visible newer architecture.

**Frontend modified**

- `frontend/src/app/core/models.ts`, `frontend/src/app/core/api.service.ts` — shared types and HTTP calls.
- `frontend/src/app/app.ts`, `frontend/src/app/app.html`, `frontend/src/app/app.css`, `frontend/src/app/app.routes.ts` — navigation, widgets and routes.
- `frontend/src/app/pages/book.ts` — individual/group selector, capacity chips and query param preselection.
- `frontend/src/app/pages/my-bookings.ts` — type badges, loyalty display, cancellation and rescheduling.
- `frontend/src/app/pages/admin.ts` — group/individual badges.
- `frontend/src/styles.css` — theme variable definitions.
- `.gitignore`, `README.md` — secrets/dependency exclusions and runbook.

## API validation examples

```http
POST /api/ai/chat/
Authorization: Token <token>
Content-Type: application/json

{"message":"Find yoga tomorrow","lang":"kk"}
```

```http
POST /api/bookings/
Authorization: Token <token>
Content-Type: application/json

{"trainer_id":"T-01","session_start":"2026-12-01 14:00","training_type":"group","payment_method":"Wallet"}
```

```http
POST /api/notifications/read/
Authorization: Token <token>
Content-Type: application/json

{"id": 1}
```

No `id` marks all the authenticated member's notifications as read.

## Five-student defense summary

| Student | Deliverable | Defense explanation |
|---|---|---|
| **Azamat** | AI Fitness Coach | Built server-side AI integration supporting DeepSeek, Groq, Gemini and local fallback. The chatbot gets real trainer availability, ratings, member wallet and workout history. A validated `[TRAINER:T-01]` tag exposes a booking button on the Angular chat widget. |
| **Esra** | Notifications + uniqueness | Added authenticated notification storage and bell dropdown, unread count and mark-as-read endpoints. Booking, refund and loyalty events trigger notifications. Reminder lookup generates at most one reminder per booking. Cross-trainer overlaps and loyalty progression are reflected in the UI. |
| **Aruzhan** | Trainer profile | Added trainer bios, experience and certificate records, detailed trainer API and rating breakdown, client feedback and live slots. A member can select a time directly in the trainer drawer and continue to prefilled booking. |
| **Rollan** | Group vs Individual | Added 5000-KZT individual and 2500-KZT group sessions, 6-person capacity rules, slot mode/spots information, duplicate prevention, transactional payment, and same-price refund/reschedule rules. |
| **Tomiris** | QA and cleanup | Updated route query preselection, translation entries, protected `.env`/build folders, added migration and API/model tests for the new features and checked Python and Angular compilers. |

## Demo script for defense

1. Open **Trainers**, choose a profile, inspect certifications/reviews and available time slots.
2. Select **Group (2,500 KZT)** and book a time; verify it shows `1/6` and blocks individual bookings on the slot.
3. Open **My bookings** and the **notification bell**; show the confirmed booking and reminder/read controls.
4. Open **AI Fitness Coach**, ask in Kazakh about yoga, and use **Book this trainer →**.
5. Explain the 24-hour full refund, 2–24 hour half refund, and the loyalty bonus test; run `python manage.py test`.
