import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { I18nService } from './i18n.service';
import { ToastService } from './toast.service';
import { ThemeService } from './theme.service';
import { AuthService } from './auth.service';

type ChatMessage = { who: 'user' | 'coach'; text: string; trainerId?: string | null; isError?: boolean };

@Component({
  selector: 'app-ai-coach-widget',
  imports: [FormsModule],
  template: `
    <button type="button" class="ai-fab" [attr.aria-expanded]="opened()" (click)="toggle()"
        aria-label="Open FitSlot AI Coach" title="Ask the FitSlot coach">
      <img [src]="mascotAvatar()" alt="" width="42" height="42" />
      <span>AI Coach</span><span class="ai-fab-indicator" aria-hidden="true">✦</span>
    </button>
    @if (opened()) {
      <section class="ai-panel" aria-label="AI Fitness Coach" role="region">
        <header class="ai-header">
          <div class="ai-header-identity"><img [src]="mascotAvatar()" alt="" width="44" height="44" />
            <div><strong>{{i18n.t('AI Fitness Coach')}}</strong>
              <small>{{provider() === 'local' ? 'Offline assistant' : 'Your FitSlot training companion'}}</small>
            </div>
          </div>
          <div class="ai-header-actions">
            <button type="button" (click)="clearChat()" title="Clear conversation" aria-label="Clear conversation">↺</button>
            <button type="button" (click)="opened.set(false)" [attr.aria-label]="i18n.t('Close')">✕</button>
          </div>
        </header>
        <div class="ai-messages" #chatScroll aria-live="polite">
          @if (!messages().length) {
            <div class="ai-welcome">
              <div class="ai-mascot-preview"><img [src]="mascotAvatar()" alt="FitSlot friendly tiger coach waving hello" width="150" height="150" /></div>
              <h3>{{helloTitle()}}</h3>
              <p>{{helloSubtitle()}}</p>
              <div class="ai-suggestions">
                <button type="button" class="chip" (click)="askSuggestion('plan')">{{promptText('plan')}}</button>
                <button type="button" class="chip" (click)="askSuggestion('trainer')">{{promptText('trainer')}}</button>
                <button type="button" class="chip" (click)="askSuggestion('recovery')">{{promptText('recovery')}}</button>
              </div>
            </div>
          }
          @for (message of messages(); track $index) {
            <div class="chat-line" [class.mine]="message.who === 'user'">
              @if (message.who === 'coach') {
                <img class="chat-avatar" [src]="mascotAvatar()" alt="AI Coach" width="33" height="33" />
              }
              <div class="ai-message" [class.mine]="message.who === 'user'" [class.offline]="message.isError">
                <span>{{message.text.replace(trainerPattern, '').trim()}}</span>
                @if (message.trainerId) {
                  <button class="btn btn-primary btn-sm" type="button" (click)="book(message.trainerId)">
                    {{i18n.t('Book this trainer →')}}
                  </button>
                }
              </div>
            </div>
          }
          @if (sending()) {
            <div class="chat-line"><img class="chat-avatar" [src]="mascotAvatar()" alt="" width="33" height="33" />
              <p class="ai-typing">✦ {{i18n.t('Typing…')}}</p>
            </div>
          }
        </div>
        @if (provider() === 'local') {
          <div class="ai-status" role="status">⚠ {{i18n.t('Local mode')}} — {{providerMessage()}}</div>
        } @else if (provider()) {
          <div class="ai-status ai-online" role="status">● {{i18n.t('AI mode')}}: {{provider()}}</div>
        }
        <form class="ai-form" (ngSubmit)="send()">
          <input [(ngModel)]="input" name="message" [placeholder]="i18n.t('Ask about training…')"
                 maxlength="2000" [disabled]="sending()" autocomplete="off" aria-label="Message to AI Coach" />
          <button class="btn btn-primary" type="submit" [disabled]="sending() || !input.trim()"
                  [attr.aria-label]="i18n.t('Send')">➤</button>
        </form>
        <small class="ai-disclaimer">Training guidance only · Check with a professional for medical concerns.</small>
      </section>
    }
  `,
  styles: `
    .ai-fab { position:fixed;bottom:22px;right:22px;z-index:125;display:flex;align-items:center;gap:9px;border:1px solid var(--border);border-radius:60px;padding:6px 14px 6px 6px;background:var(--surface);color:var(--text);font-weight:850;box-shadow:var(--shadow);cursor:pointer;transition:transform .2s; }
    .ai-fab:hover { transform:translateY(-3px);border-color:var(--primary); }
    .ai-fab img { height:42px;width:42px;object-fit:cover;border-radius:50%;background:var(--surface-2); }
    .ai-fab-indicator { width:25px;height:25px;display:grid;place-items:center;border-radius:50%;color:var(--primary-ink);background:var(--primary);font-size:.9rem; }
    .ai-panel { position:fixed;right:20px;bottom:88px;z-index:130;width:min(420px,calc(100vw - 26px));height:min(625px,calc(100vh - 115px));display:flex;flex-direction:column;border:1px solid var(--border);border-radius:23px;background:var(--surface);box-shadow:var(--shadow);overflow:hidden; }
    .ai-header { padding:12px 14px;background:var(--surface-2);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:7px; }
    .ai-header-identity { display:flex;align-items:center;gap:10px;min-width:0; }
    .ai-header-identity img { width:45px;height:45px;object-fit:cover;border-radius:13px;background:var(--surface);border:1px solid var(--border); }
    .ai-header-identity strong { display:block;font-size:.98rem;color:var(--text); }
    .ai-header-identity small { display:block;font-size:.7rem;color:var(--muted); }
    .ai-header-actions { display:flex;align-items:center;gap:5px; }
    .ai-header-actions button { width:31px;height:31px;border:0;border-radius:9px;background:var(--surface);color:var(--text);font-size:17px;cursor:pointer; }
    .ai-header-actions button:hover { background:var(--surface-3); }
    .ai-messages { flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:13px;padding:18px 14px;overscroll-behavior:contain; }
    .ai-welcome { text-align:center;padding:7px 2px; }
    .ai-welcome h3 { margin:3px 0 8px; }.ai-welcome p { font-size:.85rem;line-height:1.5; }
    .ai-mascot-preview { height:138px;display:grid;place-items:center; }
    .ai-mascot-preview img { max-height:138px;width:150px;object-fit:contain; }
    .ai-suggestions { display:grid;gap:7px;margin-top:15px; }
    .ai-suggestions .chip { font-size:.82rem;text-align:left;min-height:40px; }
    .ai-suggestions .chip:hover { border-color:var(--primary); }
    .chat-line { display:flex;align-items:flex-end;gap:7px; }
    .chat-line.mine { justify-content:flex-end; }
    .chat-avatar { width:33px;height:33px;flex-shrink:0;object-fit:contain;border-radius:50%;background:var(--surface-2);border:1px solid var(--border); }
    .ai-message { display:grid;gap:9px;max-width:89%;padding:11px 13px;background:var(--surface-2);color:var(--text);border:1px solid var(--border);border-radius:15px 15px 15px 4px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:.9rem;line-height:1.55; }
    .ai-message.mine { background:var(--primary);color:var(--primary-ink);border-color:var(--primary);border-radius:15px 15px 4px 15px; }
    .ai-message.offline { border-style:dashed; }
    .ai-message .btn { max-width:fit-content;font-size:.78rem; }
    .ai-typing { font-size:.8rem;padding:8px;color:var(--muted); }
    .ai-status { border-top:1px solid var(--border);background:var(--surface-2);padding:7px 12px;color:var(--muted);font-size:.72rem; }
    .ai-online { color:var(--ok); }
    .ai-form { display:flex;gap:8px;padding:12px 12px 7px;border-top:1px solid var(--border); }
    .ai-form input { min-width:0;flex:1; }
    .ai-form .btn { min-width:44px;font-size:1.18rem; }
    .ai-disclaimer { color:var(--muted);font-size:.62rem;text-align:center;padding:0 9px 9px; }
    @media(max-width:520px) { .ai-panel { right:8px;bottom:83px;width:calc(100vw - 16px);height:min(625px,calc(100vh - 105px)); } .ai-fab { right:12px;bottom:14px; } }
  `
})
export class AICoachWidgetComponent {
  private api = inject(ApiService);
  private router = inject(Router);
  private toast = inject(ToastService);
  readonly themeSvc = inject(ThemeService);
  private auth = inject(AuthService);
  @ViewChild('chatScroll') private chatScroll?: ElementRef<HTMLDivElement>;
  i18n = inject(I18nService);
  readonly trainerPattern = /\[TRAINER:T-\d{2}\]/g;
  opened = signal(false);
  sending = signal(false);
  messages = signal<ChatMessage[]>(this.loadMessages());
  provider = signal<string | null>(null);
  providerError = signal<string | null>(null);
  input = '';

  mascotAvatar(): string {
    return this.themeSvc.current() === 'neon'
      ? '/mascot/fitslot-coach-neon.webp'
      : '/mascot/fitslot-coach.webp';
  }

  helloTitle(): string {
    const lang = this.i18n.lang();
    return lang === 'kk' ? 'Сәлем! Мен FitSlot көмекшісімін.'
      : lang === 'ru' ? 'Привет! Я твой FitSlot Coach.'
      : 'Hey there! I am your FitSlot Coach.';
  }

  helloSubtitle(): string {
    const lang = this.i18n.lang();
    return lang === 'kk' ? 'Жаттығу жоспарын құрамын, жаттықтырушы таңдауға көмектесемін.'
      : lang === 'ru' ? 'Помогу с планом тренировок, восстановлением и подбором тренера.'
      : 'Ask about workouts, recovery or choosing a real trainer.';
  }

  promptText(which: 'plan'|'trainer'|'recovery'): string {
    const lang = this.i18n.lang();
    const options = {
      plan: {kk:'🏋️ Маған 3 күндік жаттығу жоспарын құрастыр',ru:'🏋️ Составь план тренировок на 3 дня',en:'🏋️ Create a 3-day workout plan'},
      trainer: {kk:'🐯 Маған жаттықтырушы таңдауға көмектес',ru:'🐯 Помоги выбрать тренера',en:'🐯 Recommend a trainer'},
      recovery: {kk:'💤 Жаттығудан кейін қалай қалпына келемін?',ru:'💤 Как восстанавливаться после тренировки?',en:'💤 How should I recover after training?'}
    };
    return options[which][lang];
  }

  askSuggestion(which: 'plan'|'trainer'|'recovery'): void {
    this.input = this.promptText(which).replace(/^[^\p{L}]+/u, '');
    this.send();
  }

  private conversationKey(): string {
    return `fitslot_ai_session_v1_${this.auth.user()?.member_id ?? 'guest'}`;
  }

  private loadMessages(): ChatMessage[] {
    try {
      const raw = sessionStorage.getItem(this.conversationKey());
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.slice(-20).filter((item): item is ChatMessage =>
        !!item && typeof item === 'object' &&
        (item.who === 'user' || item.who === 'coach') &&
        typeof item.text === 'string' && item.text.length <= 6000
      );
    } catch { return []; }
  }

  private saveMessages(): void {
    try { sessionStorage.setItem(this.conversationKey(), JSON.stringify(this.messages().slice(-20))); }
    catch { /* storage disabled */ }
    setTimeout(() => {
      const pane = this.chatScroll?.nativeElement;
      if (pane) pane.scrollTop = pane.scrollHeight;
    }, 0);
  }

  clearChat(): void {
    this.messages.set([]);
    this.provider.set(null);
    this.providerError.set(null);
    try { sessionStorage.removeItem(this.conversationKey()); } catch { /* disabled */ }
  }

  providerMessage(): string {
    const code = this.providerError();
    const lang = this.i18n.lang();
    const options: Record<string, { kk: string; ru: string; en: string }> = {
      not_configured: {
        kk: 'API кілті табылмады', ru: 'API-ключ не найден', en: 'API key not configured'
      },
      groq_http_400: {
        kk: 'Groq сұранысында қате (400). Модельді тексеріңіз', ru: 'Ошибка запроса Groq (400). Проверьте модель', en: 'Groq request error (400). Check the model'
      },
      groq_http_401: {
        kk: 'Groq API кілті жарамсыз (401)', ru: 'Неверный ключ Groq (401)', en: 'Invalid Groq API key (401)'
      },
      groq_http_403: {
        kk: 'Groq моделіне рұқсат жоқ (403)', ru: 'Нет доступа к модели Groq (403)', en: 'Groq model unavailable for your plan (403)'
      },
      groq_http_429: {
        kk: 'Groq тегін лимиті бітті (429)', ru: 'Лимит бесплатных запросов Groq исчерпан (429)', en: 'Groq free rate limit exceeded (429)'
      },
      groq_connection_error: {
        kk: 'Groq серверіне қосылу мүмкін емес', ru: 'Нет соединения с Groq', en: 'Cannot connect to Groq'
      },
      groq_invalid_response: {
        kk: 'Groq күтпеген жауап қайтарды', ru: 'Неожиданный ответ Groq', en: 'Unexpected response from Groq'
      },
      deepseek_http_401: {
        kk: 'DeepSeek кілті жарамсыз (401)', ru: 'Неверный ключ DeepSeek (401)', en: 'Invalid DeepSeek API key (401)'
      },
      deepseek_http_402: {
        kk: 'DeepSeek балансын толтырыңыз (402)', ru: 'Пополните баланс DeepSeek (402)', en: 'Insufficient DeepSeek balance (402)'
      },
      deepseek_http_429: {
        kk: 'Сұраныс шегі асырылды (429)', ru: 'Превышен лимит запросов (429)', en: 'DeepSeek rate limit (429)'
      },
      deepseek_connection_error: {
        kk: 'DeepSeek-ке қосылу мүмкін болмады', ru: 'Нет соединения с DeepSeek', en: 'Cannot connect to DeepSeek'
      },
    };
    if (code && options[code]) return options[code][lang];
    return code ? `${this.i18n.t('AI connection problem')}: ${code}` : this.i18n.t('Check backend terminal for details');
  }

  send() {
    const text = this.input.trim();
    if (!text || this.sending()) return;

    // Use previous turns only: the new message is sent separately in `message`.
    // Groq responses may exceed 2000 characters, so trim history safely.
    const history = this.messages()
      .filter(message => !message.isError && message.text.trim())
      .slice(-12)
      .map(message => ({
        role: message.who === 'user' ? 'user' as const : 'assistant' as const,
        content: message.text.replace(this.trainerPattern, '').trim().slice(0, 2000),
      }));

    this.messages.update(items => [...items, { who: 'user', text }]);
    this.input = '';
    this.saveMessages();
    this.sending.set(true);

    this.api.aiChat(text, this.i18n.lang(), history).subscribe({
      next: response => {
        this.messages.update(items => [...items, {
          who: 'coach', text: response.reply, trainerId: response.trainer_id,
          isError: response.provider === 'local',
        }]);
        this.provider.set(response.provider);
        this.providerError.set(response.provider_error);
        this.sending.set(false);
        this.saveMessages();
      },
      error: (err: HttpErrorResponse) => {
        this.sending.set(false);
        const body = err.error as { message?: unknown; detail?: unknown } | null;
        const serverMessage = body && typeof body.message === 'string'
          ? body.message
          : body && typeof body.detail === 'string' ? body.detail : '';
        const fallback = `${this.i18n.t('AI connection problem')} (HTTP ${err.status || 'network'})`;
        const message = serverMessage || fallback;
        this.messages.update(items => [...items, { who: 'coach', text: message, isError: true }]);
        this.provider.set('local');
        this.providerError.set(err.status ? `backend_http_${err.status}` : 'backend_connection_error');
        console.error('FitSlot AI request failed:', err.status, err.error);
        this.toast.show(message, 'error');
        this.saveMessages();
      },
    });
  }

  toggle() { this.opened.update(value => !value); }
  book(id: string) {
    this.opened.set(false);
    this.router.navigate(['/book'], { queryParams: { trainer: id } });
  }
}
