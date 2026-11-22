# FitSlot AI Coach — Groq Free (KK)

Бұл патч бұрынғы FitSlot Week13 нұсқасына арналған; GitHub main-ге толық кодты көшіруге болмайды.

## Не өзгерді?
- Groq AI провайдері бірінші шақырылады; модель әдепкіде `openai/gpt-oss-120b`.
- `GROQ_MODEL` және `AI_PROVIDER` опциялары backend/.env ішінен оқылады.
- GPT-OSS reasoning жауабы жасырылған (`reasoning_format=hidden`).
- Chat тарихы, KK/RU/EN жауаптары, trainer button және database context сақталған.
- Жалпы әңгімеде бос слоттардың үлкен контексті жіберілмейді (Groq free лимитін үнемдеу).
- 401/403/429 қателері түсінікті көрсетіледі.

## Қай файлдарды ауыстыру керек?
1. `backend/bookings/ai_coach.py` — міндетті
2. `frontend/src/app/core/ai-coach-widget.ts` — міндетті
3. `backend/.env.example` — үлгі, міндетті емес
4. `backend/bookings/tests.py` — қосымша тесттер, міндетті емес

## Groq API кілтін алу
1. https://console.groq.com/keys сайтына кіріп, GroqCloud аккаунтын аш/кір.
2. Жаңа API Key жаса, оны тек өзіңде сақта.
3. `backend/.env` ішіне мынаны енгіз:

```dotenv
AI_PROVIDER=groq
GROQ_API_KEY=PASTE_YOUR_NEW_GROQ_KEY_HERE
GROQ_MODEL=openai/gpt-oss-120b
DEEPSEEK_API_KEY=
GEMINI_API_KEY=
```

`DEEPSEEK_API_KEY` жолын бос қалдыру маңызды: баланс жетпейтін DeepSeek шақырылмайды.
`backend/.env` **жеке файл**, оны ZIP-ке де, GitHub-қа да қоспа.

## Django + Angular іске қосу (Windows / PowerShell)

Terminal 1:
```powershell
cd backend
python manage.py runserver
```

Terminal 2:
```powershell
cd frontend
npm start
```

Сынау: AI Coach-қа "Привет, кто ты?" деп сұра. Төменде `AI mode: groq` көрінсе, Groq нақты жауап берген.
`Local mode — groq_http_429` — лимит; `groq_http_401` — кілт қате; `groq_http_403` — осы модельге рұқсат жоқ.

## Тест
```powershell
cd backend
python manage.py test
```

Дайындаған ортадағы нәтиже: Django 36/36 тест өтті; TypeScript және Angular compiler тексерісі өтті.
Нақты Groq API аккаунтымен live-тест жасалмады (API Key бұл ортада жоқ).

## Маңызды
- Бұрын жіберген DeepSeek кілтің скриншотта көрініп қалған. Сол кілтті міндетті түрде revoke/rotate жаса.
- Groq free tier шектеулері өзгеруі мүмкін; ағымдағы лимиттер: https://console.groq.com/docs/rate-limits
- GitHub-тағы main бұдан басқа нұсқа, ағымдағы Week 13 ZIP бойынша патч дайындалды.
