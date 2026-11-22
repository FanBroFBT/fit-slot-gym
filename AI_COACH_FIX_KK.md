# FitSlot AI Fitness Coach — DeepSeek API fix (21.11.2026)

## Неліктен бір ғана жауап көрсетілді?

Алдыңғы `backend/bookings/ai_coach.py` файлы `deepseek-chat` моделін қолданды. DeepSeek-тің ресми API құжаттамасы бойынша бұл атау 2026-07-24 күні тоқтатылды. Қазіргі модель: `deepseek-flash` (немесе `deepseek-v4-pro`). Бұрынғы код HTTP қатесін көрсетпей, әр сұраныста бірдей trainer fallback қайтарды. Сонымен қатар frontend чат тарихын жібермеді.

Ресми деректер:
- https://api-docs.deepseek.com/news/news260424/
- https://api-docs.deepseek.com/en/
- https://api-docs.deepseek.com/quick_start/error_codes/
- https://api-docs.deepseek.com/guides/multi_round_chat/

## Өзгерген файлдар

1. `backend/bookings/ai_coach.py` — жаңа `deepseek-flash` моделі, көп кезекті chat history, API қатесінің диагностикалық коды, UK/RU/EN қолдау, табиғи сөйлесу, тренер ұсынуды сұрағанда ғана DB контексті.
2. `backend/bookings/views.py` — тарихты POST-тан AI service-ке жеткізеді.
3. `backend/bookings/tests.py` — AI endpoint тесттері, DeepSeek HTTP 402 және history.
4. `backend/.env.example` — модель атауы үлгісі.
5. `frontend/src/app/core/ai-coach-widget.ts` — тарихты жібереді, жіберу күйі, DeepSeek/Local көрсеткіші және себептің түсіндірмесі.
6. `frontend/src/app/core/api.service.ts` — history API payload.
7. `frontend/src/app/core/models.ts` — provider_error жауап түрі.
8. `frontend/src/app/core/i18n.service.ts` — UI аудармалары.

## Қауіпсіздік: API кілтті жаңарту

Скриншотқа түскен бұрынғы DeepSeek кілтін *revoke* етіп, жаңасын жасаңыз.

`backend/.env` ішінде:

```dotenv
DEEPSEEK_API_KEY=YOUR_NEW_SECRET_KEY
DEEPSEEK_MODEL=deepseek-flash
GROQ_API_KEY=
GEMINI_API_KEY=
```

Ешқашан `.env` файлын GitHub-қа жүктемеңіз. API кілтін frontend-ке қоспаңыз. Бұл ZIP ішінде нақты API кілт жоқ.

## Windows PowerShell арқылы тексеру

Backend:

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python manage.py shell -c "from bookings.ai_coach import _api_keys; print('Key configured:', bool(_api_keys()['DEEPSEEK_API_KEY']))"
python manage.py shell -c "from bookings.ai_coach import _provider_reply; print('Provider/error:', _provider_reply('Hello', {'trainers': []}, 'en')[1:])"
python manage.py test
python manage.py runserver
```

Екінші команда сыртқы API-ға **нақты сұраныс** жасайды, сондықтан сәтті орындалса API қолдану құны алынуы мүмкін.

Жауаптың мысалдары:
- `('deepseek', None)` — DeepSeek жұмыс істейді.
- `(None, 'deepseek_http_401')` — кілт дұрыс емес/жарамсыз.
- `(None, 'deepseek_http_402')` — DeepSeek API балансын тексеріңіз.
- `(None, 'deepseek_http_400')` — сұраныс форматын тексеріңіз.
- `(None, 'deepseek_http_429')` — rate limit.
- `(None, 'deepseek_connection_error')` — Интернет, firewall, proxy немесе timeout мәселесі.
- `(None, 'not_configured')` — API кілт табылмады (файл жолын тексеріңіз).

Frontend:

```powershell
cd frontend
npm ci
npm start
```

Браузерді жаңартып, `Сәлем`, `Сен кімсің?`, `Маған бүгін йога тренерін ұсын`, `Ал ертең қай уақыты бос?` сияқты сұрақтарды жіберіңіз. Widget астындағы `AI mode: deepseek` — нақты модель жауабы; `Local mode` — fallback, жанында себеп коды шығады.

`backend/.env` өзгерсе, `runserver` тоқтатып қайта іске қосыңыз. Егер машинада `DEEPSEEK_API_KEY` орта айнымалысы бұрыннан бар болса, ол `.env` мәнінен басым болады.

## Тексеру шекарасы

- Django тесттері: 33/33 сәтті, ішінде AI-ға mocked жауап беретін тесттер бар.
- TypeScript compile және Angular template compile: сәтті.
- Толық Angular build бұл Linux ортасында іске аспады: ескі `node_modules` Windows esbuild binary-імен орнатылған. Өз Windows ортаңызда `npm ci` кейін `npm run build` тексеріңіз.
- Бұл ортада нақты жаңа DeepSeek API кілтін қолданып live connection жасалмады, сондықтан аккаунт балансын/кілтті растау қажет.
- Бұл патч **алдыңғы FitSlot Week 13 ZIP негізіндегі жобаға** арналған. GitHub `main` басқа нұсқа болғандықтан, оны толықтай ауыстырмаңыз.
