import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { StarsComponent } from '../core/stars';
import { ApiService } from '../core/api.service';
import { ApiError, Booking, Slot } from '../core/models';
import { ToastService } from '../core/toast.service';
import { AuthService } from '../core/auth.service';
import { I18nService } from '../core/i18n.service';

type Tab = 'upcoming' | 'past' | 'cancelled';
type CancelModalStep = 'choice' | 'reschedule' | 'confirm_cancel';

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

@Component({
  selector: 'app-my-bookings',
  imports: [DatePipe, RouterLink, FormsModule, StarsComponent],
  template: `
  <div class="row between">
    <h2>{{ i18n.t('MY_BOOKINGS_TITLE') }}</h2>
    <a class="btn btn-primary" routerLink="/book">+ {{ i18n.t('NEW_BOOKING') }}</a>
  </div>

  <!-- Uniqueness: Loyalty Streak прогресс индикаторы -->
  <div class="card mt-s streak-banner">
    <div class="row between" style="flex-wrap: wrap; gap: 8px;">
      <div>
        <strong>🔥 {{ i18n.t('STREAK_TITLE') }} {{ completedCount() % 5 }} / 5 {{ i18n.t('STREAK_SESSIONS') }}</strong>
        <p class="muted" style="margin: 2px 0 0; font-size: .85rem;">
          {{ i18n.t('STREAK_DESC_1') }} <strong>{{ i18n.t('STREAK_CASHBACK') }}</strong> {{ i18n.t('STREAK_DESC_2') }}
        </p>
      </div>
      <span class="chip on">{{ 5 - (completedCount() % 5) }} {{ i18n.t('STREAK_LEFT') }}</span>
    </div>
  </div>

  <div class="row mt-s" style="margin-top: 20px;">
    @for (t of tabs; track t) {
      <button class="chip" [class.on]="tab() === t" (click)="tab.set(t)">{{ tabLabel(t) }} ({{ count(t) }})</button>
    }
  </div>

  <div class="grid mt">
    @for (b of shown(); track b.booking_id) {
      <div class="card" style="display: flex; flex-direction: column; gap: 12px;">
        <div class="row between" style="align-items: flex-start;">
          <div>
            <h3>{{ b.trainer_name }} <span class="badge b-{{ b.status }}">{{ statusLabel(b.status) }}</span></h3>
            <p>{{ b.session_start | date: 'EEEE d MMMM, HH:mm' }} · {{ i18n.tSpec(b.specialization) }}</p>
            <p style="font-size:.85rem; color: #94a3b8;">
              {{ i18n.t('BOOKING_ID') }}: {{ b.booking_id }} · {{ b.amount_kzt }} KZT
              <span class="badge b-{{ b.payment_status }}">{{ payStatusLabel(b.payment_status) }}</span>
            </p>
          </div>
          @if (b.status === 'Confirmed') {
            <button
              class="btn btn-danger"
              [disabled]="!b.can_cancel"
              (click)="openManageModal(b)"
              [title]="b.can_cancel ? '' : i18n.t('CANCEL_TOOLTIP')"
            >
              {{ i18n.t('BTN_CANCEL') }}
            </button>
          }
        </div>

        @if (b.review; as r) {
          <div class="my-review"><app-stars [value]="r.rating" /> <span class="muted">{{ i18n.t('YOUR_REVIEW') }}</span>
            @if (r.comment) { <p style="margin:4px 0 0">{{ r.comment }}</p> }</div>
        } @else if (b.can_review) {
          <div class="row between my-review"><span>{{ i18n.t('HOW_WAS_SESSION') }}</span>
            <button class="btn btn-primary btn-sm" (click)="openReview(b)">{{ i18n.t('RATE_TRAINER_BTN') }}</button></div>
        }

        @if (b.status === 'Confirmed') {
          <div style="background: rgba(15, 23, 42, 0.4); padding: 12px; border-radius: 8px; display: flex; align-items: center; gap: 16px; border: 1px dashed var(--border-color);">
            <div style="background: white; padding: 6px; border-radius: 6px;">
              <img
                [src]="'https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=SessionPass-' + b.booking_id"
                alt="Session QR Pass"
                style="display: block; width: 90px; height: 90px;"
              />
            </div>
            <div>
              <p style="font-weight: 600; font-size: 0.95rem; margin-bottom: 4px;">{{ i18n.t('QR_TITLE') }}</p>
              <p style="font-size: 0.85rem; color: #94a3b8; line-height: 1.4;">{{ i18n.t('QR_DESC') }}</p>
            </div>
          </div>
        }
      </div>
    } @empty { <div class="card muted">{{ loaded() ? i18n.t('NOTHING_HERE') : i18n.t('LOADING_TEXT') }}</div> }
  </div>

  <!-- Cancel vs Reschedule таңдау модалы -->
  @if (managing(); as mb) {
    <div class="backdrop" (click)="managing.set(null)">
      <div class="card dialog" style="width: 480px;" (click)="$event.stopPropagation()">
        <div class="row between">
          <h3 style="margin: 0;">{{ i18n.t('MANAGE_BOOKING_TITLE') }}{{ mb.booking_id }}</h3>
          <button class="btn btn-sm" (click)="managing.set(null)">✕</button>
        </div>
        <p class="muted" style="margin-top: 6px;">
          {{ mb.trainer_name }} · {{ mb.session_start | date: 'EEEE d MMMM, HH:mm' }}
        </p>

        @if (modalStep() === 'choice') {
          <p class="mt-s">{{ i18n.t('MANAGE_CHOICE_PROMPT') }}</p>

          <div class="choice-box mt-s" (click)="startReschedule(mb)">
            <strong>{{ i18n.t('RESCHEDULE_TITLE') }}</strong>
            <p class="muted" style="margin: 4px 0 0; font-size: .85rem;">
              {{ i18n.t('RESCHEDULE_DESC_1') }} {{ mb.trainer_name }}. <b>{{ i18n.t('RESCHEDULE_NO_EXTRA') }}</b> {{ i18n.t('RESCHEDULE_DESC_2') }}
            </p>
          </div>

          <div class="choice-box danger mt-s" (click)="modalStep.set('confirm_cancel')">
            <strong>{{ i18n.t('CANCEL_CHOICE_TITLE') }}</strong>
            <p class="muted" style="margin: 4px 0 0; font-size: .85rem;">
              {{ i18n.t('CANCEL_CHOICE_DESC') }}
            </p>
          </div>
        }

        @if (modalStep() === 'reschedule') {
          <h4 class="mt-s">{{ i18n.t('STEP_NEW_DATE') }}</h4>
          <div class="row" style="flex-wrap: wrap;">
            @for (d of days(); track d.value) {
              <button class="chip" [class.on]="newDate() === d.value" (click)="selectRescheduleDate(mb, d.value)">
                {{ d.label }}
              </button>
            }
          </div>

          <h4 class="mt-s">{{ i18n.t('STEP_NEW_TIME') }}</h4>
          @if (loadingSlots()) {
            <p class="muted">{{ i18n.t('LOADING_SLOTS') }}</p>
          } @else {
            <div class="row" style="flex-wrap: wrap;">
              @for (s of availableSlots(); track s.time) {
                <button
                  class="chip"
                  [class.on]="newTime() === s.time"
                  [disabled]="!s.available"
                  (click)="newTime.set(s.time)"
                >
                  {{ s.time }}
                </button>
              } @empty { <p class="muted">{{ i18n.t('NO_SLOTS') }}</p> }
            </div>
          }

          <div class="row mt" style="justify-content: space-between;">
            <button class="btn" (click)="modalStep.set('choice')">{{ i18n.t('BTN_BACK') }}</button>
            <button class="btn btn-primary" [disabled]="!newTime() || actionBusy()" (click)="confirmReschedule(mb)">
              {{ actionBusy() ? i18n.t('UPDATING_BUSY') : i18n.t('CONFIRM_NEW_TIME') }}
            </button>
          </div>
        }

        @if (modalStep() === 'confirm_cancel') {
          <div class="refund-box mt-s">
            <h4 style="margin: 0 0 6px;">{{ i18n.t('PAYMENT_OUTCOME_TITLE') }}</h4>
            @if (mb.payment_method === 'Membership' || !mb.amount_kzt || +mb.amount_kzt === 0) {
              <p style="margin: 0; font-size: .9rem;">
                {{ i18n.t('REFUND_MEMBERSHIP_DESC') }}
              </p>
            } @else {
              <p style="margin: 0 0 6px; font-size: .9rem;">
                {{ i18n.t('PAID_AMOUNT_LABEL') }} <b>{{ mb.amount_kzt }} KZT</b> ({{ mb.payment_method }})
              </p>
              <p style="margin: 0; font-size: .9rem;">
                @if (isMoreThan24Hours(mb.session_start)) {
                  {{ i18n.t('REFUND_OVER_24H') }} (<b>{{ mb.amount_kzt }} KZT</b>).
                } @else {
                  {{ i18n.t('REFUND_UNDER_24H') }} (<b>{{ +mb.amount_kzt * 0.5 }} KZT</b>).
                }
              </p>
            }
          </div>

          <div class="row mt" style="justify-content: space-between;">
            <button class="btn" (click)="modalStep.set('choice')">{{ i18n.t('BTN_BACK') }}</button>
            <button class="btn btn-danger" [disabled]="actionBusy()" (click)="confirmCancel(mb)">
              {{ actionBusy() ? i18n.t('CANCELLING_BUSY') : i18n.t('CONFIRM_CANCELLATION') }}
            </button>
          </div>
        }
      </div>
    </div>
  }

  <!-- Review Modal -->
  @if (reviewing(); as rb) {
    <div class="backdrop" (click)="reviewing.set(null)">
      <div class="card dialog" (click)="$event.stopPropagation()">
        <h3>{{ i18n.t('RATE_TITLE') }} {{ rb.trainer_name }}</h3>
        <p>{{ rb.session_start | date: 'EEEE d MMMM, HH:mm' }}</p>
        <div style="text-align:center;margin:12px 0"><app-stars [value]="stars" [editable]="true" (picked)="stars = $event" /></div>
        <label for="cm">{{ i18n.t('COMMENT_OPTIONAL') }}</label>
        <textarea id="cm" rows="4" maxlength="1000" [(ngModel)]="comment" [placeholder]="i18n.t('COMMENT_PLACEHOLDER')"></textarea>
        <div class="row mt" style="justify-content:flex-end">
          <button class="btn" (click)="reviewing.set(null)">{{ i18n.t('BTN_CANCEL_SIMPLE') }}</button>
          <button class="btn btn-primary" [disabled]="!stars || sending()" (click)="sendReview(rb)">{{ i18n.t('SEND_REVIEW_BTN') }}</button>
        </div>
      </div>
    </div>
  }`,
  styles: `
    .my-review{padding:10px 12px;border-radius:8px;border:1px solid var(--border);font-size:.9rem}
    .backdrop{position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:1000;padding:16px}
    .dialog{width:420px;max-width:95%;max-height:90vh;overflow-y:auto}
    textarea{font:inherit;width:100%;padding:11px 14px;border-radius:12px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);resize:vertical}
    .choice-box{padding:14px;border-radius:12px;border:1px solid var(--border);background:var(--surface-2);cursor:pointer;transition:border-color .2s,transform .15s}
    .choice-box:hover{border-color:var(--primary);transform:translateY(-2px)}
    .choice-box.danger:hover{border-color:var(--danger,#ef4444)}
    .refund-box{padding:14px;border-radius:12px;background:var(--surface-2);border-left:4px solid var(--primary)}
    .streak-banner{border-left:4px solid var(--primary)}
  `
})
export class MyBookingsComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected auth = inject(AuthService);
  protected i18n = inject(I18nService);

  tabs: Tab[] = ['upcoming', 'past', 'cancelled'];
  tab = signal<Tab>('upcoming');
  all = signal<Booking[]>([]);
  loaded = signal(false);

  // Review modal state
  reviewing = signal<Booking | null>(null);
  sending = signal(false);
  stars = 0;
  comment = '';

  // Cancel / Reschedule modal state
  managing = signal<Booking | null>(null);
  modalStep = signal<CancelModalStep>('choice');
  actionBusy = signal(false);
  loadingSlots = signal(false);
  availableSlots = signal<Slot[]>([]);
  days = computed(() => {
    const localeMap = { kk: 'kk-KZ', ru: 'ru-RU', en: 'en-GB' } as const;
    const locale = localeMap[this.i18n.lang()];
    return Array.from({ length: 10 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return { value: isoDate(d), label: d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }) };
    });
  });
  newDate = signal(isoDate(new Date()));
  newTime = signal<string | null>(null);

  shown = computed(() => this.filter(this.tab()));
  completedCount = computed(() =>
    this.all().filter(b => b.status === 'Completed' || b.status === 'Confirmed').length
  );

  ngOnInit() { this.load(); }

  load() { this.api.myBookings().subscribe(b => { this.all.set(b); this.loaded.set(true); }); }

  tabLabel(t: Tab): string {
    const map: Record<Tab, string> = {
      upcoming: 'TAB_UPCOMING',
      past: 'TAB_PAST',
      cancelled: 'TAB_CANCELLED',
    };
    return this.i18n.t(map[t]);
  }

  statusLabel(status: string): string {
    const key = `STATUS_${status.toUpperCase()}`;
    const translated = this.i18n.t(key);
    return translated === key ? status : translated;
  }

  payStatusLabel(status: string | null | undefined): string {
    if (!status) return '';
    const key = `PAY_STATUS_${status.toUpperCase()}`;
    const translated = this.i18n.t(key);
    return translated === key ? status : translated;
  }

  private filter(t: Tab) {
    const now = Date.now();
    return this.all().filter(b => {
      const future = new Date(b.session_start).getTime() > now;
      if (t === 'cancelled') return b.status === 'Cancelled';
      if (t === 'upcoming') return b.status === 'Confirmed' && future;
      return b.status === 'Completed' || (b.status === 'Confirmed' && !future);
    });
  }
  count(t: Tab) { return this.filter(t).length; }

  openReview(b: Booking) { this.stars = 0; this.comment = ''; this.reviewing.set(b); }

  sendReview(b: Booking) {
    this.sending.set(true);
    this.api.reviewBooking(b.booking_id, this.stars, this.comment).subscribe({
      next: () => { this.sending.set(false); this.reviewing.set(null); this.toast.show(this.i18n.t('TOAST_REVIEW_SENT'), 'success'); this.load(); },
      error: (e: HttpErrorResponse) => { this.sending.set(false); this.toast.show((e.error as ApiError)?.message ?? this.i18n.t('ERR_REVIEW_SEND'), 'error'); }
    });
  }

  openManageModal(b: Booking) {
    this.managing.set(b);
    this.modalStep.set('choice');
    this.newTime.set(null);
  }

  startReschedule(b: Booking) {
    this.modalStep.set('reschedule');
    this.selectRescheduleDate(b, this.days()[0].value);
  }

  selectRescheduleDate(b: Booking, dateVal: string) {
    this.newDate.set(dateVal);
    this.newTime.set(null);
    this.loadingSlots.set(true);
    this.api.slots(b.trainer_id, dateVal).subscribe({
      next: res => {
        this.availableSlots.set(res.slots);
        this.loadingSlots.set(false);
      },
      error: () => {
        this.loadingSlots.set(false);
        this.toast.show(this.i18n.t('ERR_SLOTS'), 'error');
      }
    });
  }

  confirmReschedule(b: Booking) {
    const timeVal = this.newTime();
    if (!timeVal) return;
    this.actionBusy.set(true);
    this.api.cancelBooking(b.booking_id, {
      choice: 'reschedule',
      new_session_start: `${this.newDate()} ${timeVal}`,
    }).subscribe({
      next: () => {
        this.actionBusy.set(false);
        this.managing.set(null);
        this.toast.show(this.i18n.t('TOAST_RESCHEDULED'), 'success');
        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.actionBusy.set(false);
        this.toast.show((e.error as ApiError)?.message ?? this.i18n.t('ERR_RESCHEDULE'), 'error');
      }
    });
  }

  isMoreThan24Hours(sessionStart: string): boolean {
    const diffHours = (new Date(sessionStart).getTime() - Date.now()) / (1000 * 60 * 60);
    return diffHours >= 24;
  }

  confirmCancel(b: Booking) {
    this.actionBusy.set(true);
    this.api.cancelBooking(b.booking_id, { choice: 'cancel' }).subscribe({
      next: res => {
        this.actionBusy.set(false);
        this.managing.set(null);
        const refunded = res.refund_info?.refunded_kzt;
        const pct = res.refund_info?.refund_percent ?? 0;
        if (refunded && refunded > 0) {
          this.toast.show(`${this.i18n.t('TOAST_CANCELLED_REFUND')} ${refunded} KZT (${pct}%).`, 'success');
        } else {
          this.toast.show(this.i18n.t('TOAST_CANCELLED'), 'success');
        }
        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.actionBusy.set(false);
        this.toast.show((e.error as ApiError)?.message ?? this.i18n.t('ERR_CANCEL'), 'error');
      }
    });
  }
}