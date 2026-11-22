# FitSlot — Theme + Mascot + AI Coach upgrade (22 November 2026)

## What was changed

1. **Entire website theme:** dark, light, and cyan neon theme palettes are now declared in `frontend/src/styles.css` using `:root[data-theme]`. `ThemeService` writes the theme to the HTML root and persists the selection to localStorage. Component-scoped theme declarations and competing old aliases were removed. The switch is available on the login page, too.
2. **Visual design:** responsive landing page, better navigation and booking welcome banner, consistent cards/buttons/input colors, theme-aware news/bookings appearance, semantic focus styles and reduced-motion support.
3. **FitSlot mascot:** four compressed transparent WebP assets in `frontend/public/mascot/`. The mascot changes lime/cyan outfit with the theme. Full-body version appears in login and booking banners; friendly coach portrait appears in AI chat header and message avatars.
4. **AI Coach:** context-aware response instructions and better fitness plan detail, Groq medium reasoning (configurable), longer completion token budget, recent conversation stored **per member and per browser tab** in sessionStorage, clear-chat action, prompt suggestions, better error/offline distinction, recovery example for local mode. Does not bypass Groq account rate limits.
5. **Safety and Git:** `.gitignore` excludes local envs, `.venv`, database and build/cache folders; `.env.example` contains placeholders only.

## Applying patch to an existing clone (recommended)

**Back up local work first.** Use a fresh clone or a clean working tree. Existing GitHub migration and other source files are not intentionally modified by the patch.

```powershell
cd "D:\Path\To\FitSlot_GitHub"
git status
git pull --ff-only origin main
git switch -c theme-mascot-ai-20261122
```

Extract `FitSlot_Theme_Mascot_AI_Patch.zip` to the **repository root** (the folder containing `backend` and `frontend`), using `Expand-Archive`:

```powershell
Expand-Archive -Path "D:\Downloads\FitSlot_Theme_Mascot_AI_Patch.zip" -DestinationPath . -Force
```

If the ZIP contains `UPDATE_GUIDE_KK.md`, it's informational; you need not stage it.

If an old `.venv` is tracked in Git, untrack without deleting local copies:

```powershell
git rm -r --cached --ignore-unmatch .venv
```

Make sure `backend/.env` is **not** added. Real API secrets must never be committed. If any Groq key was exposed before, revoke it and generate a new one.

```powershell
cd backend
python manage.py check
python manage.py test bookings
cd ..\frontend
npm ci
npm run build
cd ..
git status
```

After tests pass, stage ONLY the patch files:

```powershell
git add .gitignore backend/.env.example backend/bookings/ai_coach.py frontend/src/styles.css frontend/src/app/app.css frontend/src/app/app.html frontend/src/app/core/theme.service.ts frontend/src/app/core/ai-coach-widget.ts frontend/src/app/pages/login.ts frontend/src/app/pages/book.ts frontend/src/app/pages/my-bookings.ts frontend/src/app/pages/news.ts frontend/public/mascot/
git --no-pager diff --cached --stat
git --no-pager diff --cached --name-only
```

If no secrets, DBs, or virtual environment files appear in staging, commit and push:

```powershell
git commit -m "Redesign FitSlot themes, mascot and AI Coach"
git push -u origin theme-mascot-ai-20261122
```

Review a pull request at `https://github.com/FanBroFBT/fit-slot-gym/compare/main...theme-mascot-ai-20261122`. **Do not force-push main**.

## Environment (backend/.env)

```dotenv
AI_PROVIDER=groq
GROQ_API_KEY=YOUR_ACTUAL_SECRET_KEY
GROQ_MODEL=openai/gpt-oss-120b
GROQ_REASONING_EFFORT=medium
GEMINI_API_KEY=
DEEPSEEK_API_KEY=
AI_ALLOW_DEEPSEEK_FALLBACK=0
```

A valid Groq key and available quota are necessary for real model-generated replies. `429` means rate limit; `401` means unauthorized key; `400` may indicate invalid model/options. With no external AI, the local mode is deliberately limited and explicitly labeled offline.

## QA performed in authoring environment

- Python syntax compilation for backend (pass)
- TypeScript syntactic transpilation for six touched files (pass)
- 10+ standalone assertions about history limits, prompt, Groq payload and fallback (pass)
- WebP transparency and file size verified, ~350 KB total

Full Angular build and Django integration tests were **not** run here because the environment has no Angular node_modules/Django. Perform the commands above on your machine.

## Smoke tests

- Toggle Dark → Light → Neon from login, booking, trainers, news, wallet, profile and AI widget. All backgrounds/text/cards should switch, and the choice should persist on page refresh.
- Check mascot appearance at desktop (~1440 px) and mobile (~390 px).
- AI: ask 3-day workout plan → reply should detail exercises/sets/reps when Groq online, and say Local mode when not.
- Ask follow-up "А если моя цель похудение?" — reply should incorporate earlier context.
- Refresh page in same tab: chat returns. Press ↺ to clear. Log out / switch accounts: conversation is isolated by member ID.
- Booking/payment/wallet and permissions remain unchanged by this patch; run the full test suite to verify.
