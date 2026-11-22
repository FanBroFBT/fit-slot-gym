FitSlot AI Coach hotfix based exactly on the 5 files supplied in ю.txt.

CHANGED (replace these exact files):
- backend/bookings/ai_coach.py
- backend/bookings/views.py
- frontend/src/app/core/ai-coach-widget.ts

UNCHANGED (included only for reference; do not need to replace):
- frontend/src/app/core/api.service.ts
- frontend/src/app/core/models.ts

YOUR backend/.env (do not share API keys):
AI_PROVIDER=groq
GROQ_API_KEY=YOUR_REAL_GROQ_KEY
GROQ_MODEL=openai/gpt-oss-120b
DEEPSEEK_API_KEY=
GEMINI_API_KEY=

Restart backend and frontend, refresh browser. Provider should show AI mode: groq.
If provider shows local, inspect its provider_error status.
422 only on malformed message/history after this fix; a long prior AI reply will no longer cause 422.
Do not copy the old ZIP onto the current GitHub main if its content has diverged.

Validation performed: Python syntax; isolated Python history/provider mocked checks; TypeScript syntax.
Full Django tests / live Groq API were NOT run in this environment.
