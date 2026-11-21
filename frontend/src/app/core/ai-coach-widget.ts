
import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { I18nService } from './i18n.service';
import { ToastService } from './toast.service';

type ChatMessage = {
  who: 'user' | 'coach';
  text: string;
  trainerId?: string | null;
  isError?: boolean;
};

@Component({
  selector: 'app-ai-coach-widget',
  imports: [FormsModule],
  template: `
    <button
      type="button"
      class="ai-fab"
      [attr.aria-expanded]="opened()"
      (click)="toggle()"
      aria-label="AI Fitness Coach"
    >
      ✦ AI
    </button>

    @if (opened()) {
      <section class="ai-panel" aria-label="AI Fitness Coach">
        <header class="ai-header">
          <strong>✦ {{ i18n.t('AI Fitness Coach') }}</strong>
          <button
            type="button"
            (click)="opened.set(false)"
            [attr.aria-label]="i18n.t('Close')"
          >
            ✕
          </button>
        </header>

        <div class="ai-messages" aria-live="polite">
          @for (message of messages(); track $index) {
            <div
              class="ai-message"
              [class.mine]="message.who === 'user'"
            >
              <span>
                {{ message.text.replace(trainerPattern, '').trim() }}
              </span>

              @if (message.trainerId) {
                <button
                  class="btn btn-primary"
                  type="button"
                  (click)="book(message.trainerId)"
                >
                  {{ i18n.t('Book this trainer →') }}
                </button>
              }
            </div>
          } @empty {
            <p class="muted" style="padding:12px">
              {{ i18n.t('Ask about training…') }}
            </p>
          }

          @if (sending()) {
            <p class="muted ai-typing">
              {{ i18n.t('Typing…') }}
            </p>
          }
        </div>

        @if (provider() === 'local') {
          <div class="ai-status" role="status">
            ⚠ {{ i18n.t('Local mode') }} —
            {{ providerMessage() }}
          </div>
        } @else if (provider()) {
          <div class="ai-status ai-online" role="status">
            ● {{ i18n.t('AI mode') }}: {{ provider() }}
          </div>
        }

        <form class="ai-form" (ngSubmit)="send()">
          <input
            [(ngModel)]="input"
            name="message"
            [placeholder]="i18n.t('Ask about training…')"
            maxlength="2000"
            [disabled]="sending()"
            autocomplete="off"
          />

          <button
            class="btn btn-primary"
            type="submit"
            [disabled]="sending() || !input.trim()"
          >
            {{ i18n.t('Send') }}
          </button>
        </form>
      </section>
    }
  `,
  styles: `
    .ai-fab {
      position: fixed;
      bottom: 24px;
      right: 25px;
      z-index: 130;
      border: 1px solid var(--border);
      border-radius: 50px;
      padding: 16px 21px;
      background: var(--primary);
      color: var(--primary-ink);
      font-weight: 800;
      box-shadow: 0 8px 26px #0008;
      cursor: pointer;
    }

    .ai-panel {
      position: fixed;
      right: 24px;
      bottom: 87px;
      z-index: 130;
      width: min(390px, calc(100vw - 32px));
      height: min(530px, calc(100vh - 130px));
      display: flex;
      flex-direction: column;
      border: 1px solid var(--border);
      border-radius: 18px;
      background: var(--surface);
      box-shadow: 0 20px 50px #0008;
      overflow: hidden;
    }

    .ai-header {
      padding: 15px 18px;
      background: var(--surface-2);
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: var(--text);
    }

    .ai-header button {
      border: 0;
      background: transparent;
      color: var(--text);
      cursor: pointer;
      font-size: 18px;
    }

    .ai-messages {
      flex: 1;
      overflow: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 18px;
    }

    .ai-message {
      max-width: 92%;
      align-self: flex-start;
      display: grid;
      gap: 10px;
      padding: 12px;
      border-radius: 13px;
      background: var(--surface-2);
      color: var(--text);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .ai-message.mine {
      background: var(--primary);
      color: var(--primary-ink);
      align-self: flex-end;
    }

    .ai-message .btn {
      font-size: 13px;
    }

    .ai-typing {
      padding: 4px 12px;
      font-size: .85rem;
    }

    .ai-status {
      border-top: 1px solid var(--border);
      background: var(--surface-2);
      padding: 8px 12px;
      color: var(--text);
      font-size: .76rem;
      line-height: 1.4;
    }

    .ai-online {
      color: var(--primary);
    }

    .ai-form {
      display: flex;
      gap: 8px;
      padding: 12px;
      border-top: 1px solid var(--border);
    }

    .ai-form input {
      min-width: 0;
      flex: 1;
    }
  `
})
export class AICoachWidgetComponent {
  private api = inject(ApiService);
  private router = inject(Router);
  private toast = inject(ToastService);

  i18n = inject(I18nService);

  readonly trainerPattern = /\[TRAINER:T-\d{2}\]/g;

  opened = signal(false);
  sending = signal(false);
  messages = signal<ChatMessage[]>([]);

  provider = signal<string | null>(null);
  providerError = signal<string | null>(null);

  input = '';

  providerMessage(): string {
    const code = this.providerError();
    const lang = this.i18n.lang();

    const options: Record<
      string,
      { kk: string; ru: string; en: string }
    > = {
      not_configured: {
        kk: 'API кілті табылмады',
        ru: 'API-ключ не найден',
        en: 'API key not configured'
      },
      groq_http_400: {
        kk: 'Groq сұранысында қате (400)',
        ru: 'Ошибка запроса Groq (400)',
        en: 'Groq request error (400)'
      },
      groq_http_401: {
        kk: 'Groq API кілті жарамсыз (401)',
        ru: 'Неверный ключ Groq (401)',
        en: 'Invalid Groq API key (401)'
      },
      groq_http_403: {
        kk: 'Groq моделіне рұқсат жоқ (403)',
        ru: 'Нет доступа к модели Groq (403)',
        en: 'Groq model not available (403)'
      },
      groq_http_429: {
        kk: 'Groq сұраныс лимиті бітті (429)',
        ru: 'Лимит Groq исчерпан (429)',
        en: 'Groq rate limit exceeded (429)'
      },
      groq_connection_error: {
        kk: 'Groq серверіне қосылу мүмкін емес',
        ru: 'Нет соединения с Groq',
        en: 'Cannot connect to Groq'
      },
      groq_invalid_response: {
        kk: 'Groq күтпеген жауап қайтарды',
        ru: 'Неожиданный ответ Groq',
        en: 'Unexpected response from Groq'
      },
      deepseek_http_402: {
        kk: 'DeepSeek балансын толтырыңыз (402)',
        ru: 'Недостаточно средств DeepSeek (402)',
        en: 'Insufficient DeepSeek balance (402)'
      },
      backend_http_422: {
        kk: 'Чат деректерінде қате (422)',
        ru: 'Ошибка данных чата (422)',
        en: 'Invalid chat request (422)'
      },
      backend_connection_error: {
        kk: 'Backend серверіне қосылу мүмкін емес',
        ru: 'Нет соединения с backend',
        en: 'Cannot connect to backend'
      }
    };

    if (code && options[code]) {
      return options[code][lang];
    }

    return code
      ? `${this.i18n.t('AI connection problem')}: ${code}`
      : this.i18n.t('Check backend terminal for details');
  }

  send() {
    const text = this.input.trim();

    if (!text || this.sending()) {
      return;
    }

    const history = this.messages()
      .filter(message =>
        !message.isError &&
        message.text.trim().length > 0
      )
      .slice(-12)
      .map(message => ({
        role: message.who === 'user'
          ? 'user' as const
          : 'assistant' as const,
        content: message.text
          .replace(this.trainerPattern, '')
          .trim()
          .slice(0, 2000)
      }));

    this.messages.update(items => [
      ...items,
      { who: 'user', text }
    ]);

    this.input = '';
    this.sending.set(true);

    this.api.aiChat(
      text,
      this.i18n.lang(),
      history
    ).subscribe({
      next: response => {
        this.messages.update(items => [
          ...items,
          {
            who: 'coach',
            text: response.reply,
            trainerId: response.trainer_id,
            isError: response.provider === 'local'
          }
        ]);

        this.provider.set(response.provider);
        this.providerError.set(response.provider_error);
        this.sending.set(false);
      },

      error: (err: HttpErrorResponse) => {
        this.sending.set(false);

        const body = err.error as {
          message?: unknown;
          detail?: unknown;
        } | null;

        const serverMessage =
          body && typeof body.message === 'string'
            ? body.message
            : body && typeof body.detail === 'string'
              ? body.detail
              : '';

        const fallback =
          `${this.i18n.t('AI connection problem')} ` +
          `(HTTP ${err.status || 'network'})`;

        const message = serverMessage || fallback;

        this.messages.update(items => [
          ...items,
          {
            who: 'coach',
            text: message,
            isError: true
          }
        ]);

        this.provider.set('local');
        this.providerError.set(
          err.status
            ? `backend_http_${err.status}`
            : 'backend_connection_error'
        );

        console.error(
          'FitSlot AI request failed:',
          err.status,
          err.error
        );

        this.toast.show(message, 'error');
      }
    });
  }

  toggle() {
    this.opened.update(value => !value);
  }

  book(id: string) {
    this.opened.set(false);

    this.router.navigate(['/book'], {
      queryParams: { trainer: id }
    });
  }
}
