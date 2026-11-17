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
        <strong>🔥 Loyalty Streak: {{ completedCount() % 5 }} / 5 sessions</strong>
        <p class="muted" style="margin: 2px 0 0; font-size: .85rem;">
          Complete 5 paid sessions to receive an automatic <strong>10% cashback</strong> to your Wallet!
        </p>
      </div>
      <span class="chip on">{{ 5 - (completedCount() % 5) }} left for bonus</span>
    </div>
  </div>

  <div class="row mt-s" style="margin-top: 20px;">
    @for (t of tabs; track t) {
      <button class="chip" [class.on]="tab() === t" (click)="tab.set(t)">{{ t }} ({{ count(t) }})</button>
    }
  </div>

  <div class="grid mt">
    @for (b of shown(); track b.booking_id) {
      <div class="card" style="display: flex; flex-direction: column; gap: 12px;">
        <div class="row between" style="align-items: flex-start;">
          <div>
            <h3>{{ b.trainer_name }} <span class="badge b-{{ b.status }}">{{ b.status }}</span></h3>
            <p>{{ b.session_start | date: 'EEEE d MMMM, HH:mm' }} · {{ b.specialization }}</p>
            <p style="font-size:.85rem; color: #94a3b8;">
              Booking ID: {{ b.booking_id }} · {{ b.amount_kzt }} KZT
              <span class="badge b-{{ b.payment_status }}">{{ b.payment_status }}</span>
            </p>
          </div>
          @if (b.status === 'Confirmed') {
            <button
              class="btn btn-danger"
              [disabled]="!b.can_cancel"
              (click)="openManageModal(b)"
              [title]="b.can_cancel ? '' : 'Cancel or reschedule at least 2 hours before the session'"
            >
              {{ i18n.t('BTN_CANCEL') }}
            </button>
          }
        </div>

        @if (b.review; as r) {
          <div class="my-review"><app-stars [value]="r.rating" /> <span class="muted">Your review</span>
            @if (r.comment) { <p style="margin:4px 0 0">{{ r.comment }}</p> }</div>
        } @else if (b.can_review) {
          <div class="row between my-review"><span>How was your session?</span>
            <button class="btn btn-primary btn-sm" (click)="openReview(b)">★ Rate trainer</button></div>
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
              <p style="font-weight: 600; font-size: 0.95rem; margin-bottom: 4px;">Сеансқа кіру QR-коды</p>
              <p style="font-size: 0.85rem; color: #94a3b8; line-height: 1.4;">Залдың турникетінде осы жеке кодты сканерлеңіз. Код тек осы тренировкаға ғана жарамды.</p>
            </div>
          </div>
        }
      </div>
    } @empty { <div class="card muted">{{ loaded() ? 'Nothing here yet.' : 'Loading…' }}</div> }
  </div>

  <!-- РОЛЛАН: Cancel vs Reschedule таңдау модалы -->
  @if (managing(); as mb) {
    <div class="backdrop" (click)="managing.set(null)">
      <div class="card dialog" style="width: 480px;" (click)="$event.stopPropagation()">
        <div class="row between">
          <h3 style="margin: 0;">Manage booking #{{ mb.booking_id }}</h3>
          <button class="btn btn-sm" (click)="managing.set(null)">✕</button>
        </div>
        <p class="muted" style="margin-top: 6px;">
          {{ mb.trainer_name }} · {{ mb.session_start | date: 'EEEE d MMMM, HH:mm' }}
        </p>

        @if (modalStep() === 'choice') {
          <p class="mt-s">Would you like to move this workout to another time, or cancel it completely?</p>

          <div class="choice-box mt-s" (click)="startReschedule(mb)">
            <strong>🕒 Change time (Reschedule)</strong>
            <p class="muted" style="margin: 4px 0 0; font-size: .85rem;">
              Pick another free slot with {{ mb.trainer_name }}. <b>No extra payment</b> — your existing payment moves to the new time.
            </p>
          </div>

          <div class="choice-box danger mt-s" (click)="modalStep.set('confirm_cancel')">
            <strong>✕ Cancel booking completely</strong>
            <p class="muted" style="margin: 4px 0 0; font-size: .85rem;">
              Release your spot and process payment refund according to the 24-hour policy.
            </p>
          </div>
        }

        @if (modalStep() === 'reschedule') {
          <h4 class="mt-s">1. Choose a new date</h4>
          <div class="row" style="flex-wrap: wrap;">
            @for (d of days; track d.value) {
              <button class="chip" [class.on]="newDate() === d.value" (click)="selectRescheduleDate(mb, d.value)">
                {{ d.label }}
              </button>
            }
          </div>

          <h4 class="mt-s">2. Choose a new time</h4>
          @if (loadingSlots()) {
            <p class="muted">Loading available slots…</p>
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
              } @empty { <p class="muted">No slots on this date.</p> }
            </div>
          }

          <div class="row mt" style="justify-content: space-between;">
            <button class="btn" (click)="modalStep.set('choice')">← Back</button>
            <button class="btn btn-primary" [disabled]="!newTime() || actionBusy()" (click)="confirmReschedule(mb)">
              {{ actionBusy() ? 'Updating…' : 'Confirm new time' }}
            </button>
          </div>
        }

        @if (modalStep() === 'confirm_cancel') {
          <div class="refund-box mt-s">
            <h4 style="margin: 0 0 6px;">💳 What happens with your payment?</h4>
            @if (mb.payment_method === 'Membership' || !mb.amount_kzt || +mb.amount_kzt === 0) {
              <p style="margin: 0; font-size: .9rem;">
                This session was booked using your <b>Membership subscription</b>. Your session pass will simply be released with no charge.
              </p>
            } @else {
              <p style="margin: 0 0 6px; font-size: .9rem;">
                Paid amount: <b>{{ mb.amount_kzt }} KZT</b> ({{ mb.payment_method }})
              </p>
              <p style="margin: 0; font-size: .9rem;">
                @if (isMoreThan24Hours(mb.session_start)) {
                  ✅ <b>More than 24 hours left:</b> You will receive a <b>100% refund ({{ mb.amount_kzt }} KZT)</b> directly to your Wallet.
                } @else {
                  ⚠️ <b>Less than 24 hours left:</b> Late cancellation policy applies — you will receive a <b>50% refund ({{ +mb.amount_kzt * 0.5 }} KZT)</b> to your Wallet.
                }
              </p>
            }
          </div>

          <div class="row mt" style="justify-content: space-between;">
            <button class="btn" (click)="modalStep.set('choice')">← Back</button>
            <button class="btn btn-danger" [disabled]="actionBusy()" (click)="confirmCancel(mb)">
              {{ actionBusy() ? 'Cancelling…' : 'Confirm cancellation' }}
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
        <h3>Rate {{ rb.trainer_name }}</h3>
        <p>{{ rb.session_start | date: 'EEEE d MMMM, HH:mm' }}</p>
        <div style="text-align:center;margin:12px 0"><app-stars [value]="stars" [editable]="true" (picked)="stars = $event" /></div>
        <label for="cm">Comment (optional)</label>
        <textarea id="cm" rows="4" maxlength="1000" [(ngModel)]="comment" placeholder="What did you like? What could be better?"></textarea>
        <div class="row mt" style="justify-content:flex-end">
          <button class="btn" (click)="reviewing.set(null)">Cancel</button>
          <button class="btn btn-primary" [disabled]="!stars || sending()" (click)="sendReview(rb)">Send review</button>
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
  days = Array.from({ length: 10 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return { value: isoDate(d), label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) };
  });
  newDate = signal(this.days[0].value);
  newTime = signal<string | null>(null);

  shown = computed(() => this.filter(this.tab()));
  completedCount = computed(() =>
    this.all().filter(b => b.status === 'Completed' || b.status === 'Confirmed').length
  );

  ngOnInit() { this.load(); }

  load() { this.api.myBookings().subscribe(b => { this.all.set(b); this.loaded.set(true); }); }

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
      next: () => { this.sending.set(false); this.reviewing.set(null); this.toast.show('Thank you for your review!', 'success'); this.load(); },
      error: (e: HttpErrorResponse) => { this.sending.set(false); this.toast.show((e.error as ApiError)?.message ?? 'Could not send review', 'error'); }
    });
  }

  openManageModal(b: Booking) {
    this.managing.set(b);
    this.modalStep.set('choice');
    this.newTime.set(null);
  }

  startReschedule(b: Booking) {
    this.modalStep.set('reschedule');
    this.selectRescheduleDate(b, this.days[0].value);
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
        this.toast.show('Could not load available slots', 'error');
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
        this.toast.show('Session time updated! No extra payment charged.', 'success');
        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.actionBusy.set(false);
        this.toast.show((e.error as ApiError)?.message ?? 'Could not reschedule session', 'error');
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
          this.toast.show(`Booking cancelled. ${refunded} KZT (${pct}%) refunded to your Wallet.`, 'success');
        } else {
          this.toast.show('Booking cancelled.', 'success');
        }
        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.actionBusy.set(false);
        this.toast.show((e.error as ApiError)?.message ?? 'Could not cancel booking', 'error');
      }
    });
  }
}