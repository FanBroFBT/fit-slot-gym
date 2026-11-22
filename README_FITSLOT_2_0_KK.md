# FitSlot 2.0 — Frontend Design Upgrade

Бұл нұсқа **FitSlot_Theme_Mascot_AI_Full_Source.zip** ішіндегі ағымдағы код негізінде дайындалды.

## Не жаңарды?

- **Home / Dashboard** (`/home`) — жаңа responsive animated hero, FitSlot Tiger mascot, нақты `/api/stats/my/`, `/api/bookings/my/`, `/api/trainers/` деректері, upcoming booking, loyalty progress және featured trainers. Кездейсоқ жасалған статистика жоқ.
- **Trainer Profiles** — іздеу, specialty filter, sort by rating/experience, әдемі карточкалар, сертификат/пікірлер бар profile drawer, бос уақыттарды таңдау.
- **Interactive Booking Calendar** — 14 күндік кезең екі аптаға бөлінген, күндер бойынша тақталар, morning/afternoon/evening нақты API-дан алынған slots, group remaining spots, confirmation экранда success mascot.
- **AI Coach UI** — dashboard-тан бір батырмамен ашу, quick prompts, Copy reply, Retry after failure, бұрынғы sessionStorage history және booking link сақталады.
- **Micro-animations + skeletons** — трансформация/opacities негізіндегі hover және entrance анимациялары, reduced motion қолдау.
- **Performance** — fixed background gradient алынды, `i18n.service.ts` енді әр DOM өзгерісінде *бүкіл* құжатты қайта сканерлемейді, ал бос уақыттардың ескірген HTTP сұранысы cancellation арқылы тоқтатылады.

## Өзгертілген файлдар

```
frontend/src/styles.css
frontend/src/app/app.html
frontend/src/app/app.css
frontend/src/app/app.routes.ts
frontend/src/app/core/auth.service.ts
frontend/src/app/core/i18n.service.ts
frontend/src/app/core/ai-coach-widget.ts
frontend/src/app/core/coach-panel.service.ts          # new
frontend/src/app/pages/home.ts                       # new
frontend/src/app/pages/trainers.ts
frontend/src/app/pages/book.ts
frontend/src/app/pages/login.ts
frontend/public/mascot/*.webp                        # existing assets
```

**Backend файлдары өзгерген жоқ.** Wallet/Booking/Payments/Notifications/Reviews, Gemini/Groq және authentication API келісімдері бұрынғыдай.

## Егер тек Patch ZIP қолдансаң

1. VS Code-та соңғы **FitSlot-Theme-Mascot-AI** жоба папкасын аш. Бұл папкада `frontend`, `backend` бар.
2. Patch ZIP-ті осы папканың **түбіріне** аш (overwrite рұқсат ет):

```powershell
Expand-Archive -Path "$env:USERPROFILE\Downloads\FitSlot_2_0_Frontend_Patch.zip" -DestinationPath . -Force
```

3. Frontend build:

```powershell
cd frontend
npm ci
npm run build
npm start
```

Жаңа бөлек терминалда backend:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python manage.py migrate
python manage.py runserver
```

Егер жаңа Python venv жоқ болса: `py -m venv .venv; .\.venv\Scripts\python.exe -m pip install -r requirements.txt`.

Сайтты `http://localhost:4200` адресінен аш. Member аккаунтпен кіргенде енді `/home` бетіне өтеді.

## Қолмен тексеру

1. Member login → `/home`: статистика, броньдар, trainer recommendations backend дерегінен алына ма?
2. Home → "AI Fitness Coach": бұрынғы чат popup ашыла ма? Prompt, Copy және Retry жұмыс істей ме?
3. Trainers: іздеу, specialization filter, rating sort; profile drawer, күн мен уақыт, booking CTA.
4. Book: individual / group, date week arrows, бос және толған slots, төлем, success mascot. Бронь серверде расымен жасалуы тиіс.
5. Dark → Light → Neon: беттер мен AI чат стилі сәйкес келе ме?
6. Mobile viewport: навигация, calendar, AI popup, modal орналасуы.
7. Browser DevTools → Network: жаңа `/api/...` жолдары пайда болмаған, тек бұрыннан бар API қолданылған.

## Тест туралы шынайы шектеу

TypeScript parser арқылы барлық `.ts` файлдарының синтаксисі тексерілді. Бұл ортада `npm ci` npm қатесіне байланысты аяқталмады; сондықтан Angular `ng build` және браузердегі UI smoke test осында **толық орындалмады**. VS Code-та `npm ci` және `npm run build` міндетті түрде орындалсын. Django backend өзгертілмеген.

## GitHub-қа қауіпсіз енгізу

Егер жоба ZIP-тен ашылған болса, онда `.git` болмайды. GitHub репозиторийін бөлек clone жасап, Patch ZIP-ті соның түбіріне аш.

```powershell
git clone https://github.com/FanBroFBT/fit-slot-gym.git FitSlot_GitHub
cd FitSlot_GitHub
git switch -c feat/fitslot-2-ui
# Patch ZIP-ті осы жерге аш: Expand-Archive ... -DestinationPath . -Force
git add frontend/src/styles.css frontend/src/app frontend/public/mascot
git diff --cached --name-only
git commit -m "FitSlot 2.0: dashboard, trainers, calendar and AI coach UI"
git push -u origin feat/fitslot-2-ui
```

`backend/.env`, API кілттері, `.venv` және `node_modules` ешқашан GitHub-қа push жасалмасын. **`git push --force` қолданба.**
