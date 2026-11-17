import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { StarsComponent } from '../core/stars';
import { ApiError, Booking, Slot, Trainer, TrainerReviews, Wallet } from '../core/models';
import { ToastService } from '../core/toast.service';
import { I18nService } from '../core/i18n.service'; // <-- Yol farklıysa düzelt (ör. '../services/i18n.service')

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

@Component({
  selector: 'app-book',
  imports: [FormsModule, DatePipe, RouterLink, StarsComponent],
  template: `
  <h2>{{ i18n.t('BOOK_TITLE') }}</h2>
  <p>{{ i18n.t('BOOK_STEP') }} {{ step() }} {{ i18n.t('BOOK_OF_3') }}: {{ [i18n.t('STEP_1_LABEL'), i18n.t('STEP_2_LABEL'), i18n.t('STEP_3_LABEL')][step() - 1] }}</p>

  @if (result(); as r) {
    <div class="card alert-ok" style="text-align:center;padding:40px">
      <h1 class="accent">{{ i18n.t('BOOKED_SUCCESS') }}</h1>
      <p>{{ i18n.t('BOOKING_ID') }} <b>{{ r.booking_id }}</b> {{ i18n.t('BOOKING_WITH') }} {{ r.trainer_name }}</p>
      <p>{{ r.session_start | date: 'EEEE d MMMM, HH:mm' }} · {{ r.amount_kzt }} KZT {{ r.payment_status }}</p>
      <div class="row" style="justify-content:center">
        <a class="btn btn-primary" routerLink="/my-bookings">{{ i18n.t('NAV_MY_BOOKINGS') }}</a>
        <button class="btn" (click)="reset()">{{ i18n.t('BOOK_ANOTHER') }}</button>
      </div>
    </div>
  } @else {
    <div class="grid grid-3">
      @for (t of trainers(); track t.trainer_id) {
        <div class="card pick trainer-card" [class.sel]="trainer()?.trainer_id === t.trainer_id" (click)="pick(t)">
          <div class="trainer-img-container">
            @if (t.photo && !failed().has(t.trainer_id)) {
              <img [src]="t.photo" [alt]="t.full_name" class="trainer-photo" loading="lazy" referrerpolicy="no-referrer" (error)="photoFailed(t)">
            } @else {
              <div class="photo-fallback">{{ initials(t.full_name) }}</div>
            }
          </div>
          <div class="trainer-info">
            <span class="badge-speciality">{{ i18n.tSpec(t.specialization) }}</span>
            <h3 class="trainer-name">{{ t.full_name }}</h3>
            <p class="trainer-rating">
              @if (t.reviews_count) { <app-stars [value]="t.avg_rating" /> <b>{{ t.avg_rating }}</b> <span class="muted">({{ t.reviews_count }})</span> }
              @else { <span class="muted">{{ i18n.t('NO_REVIEWS') }}</span> }
            </p>
            <p class="trainer-hours">🕒 {{ t.working_hours }}</p>
          </div>
          <button class="btn-book" (click)="$event.stopPropagation(); pick(t)">{{ i18n.t('BTN_BOOK') }}</button>
          <button class="btn-details" (click)="$event.stopPropagation(); showTrainerDetails(t)">{{ i18n.t('BTN_VIEW_DETAILS') }}</button>
        </div>
      } @empty { <div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div> }
    </div>

    @if (trainer(); as t) {
      <div class="card mt" id="schedule">
        <h3>{{ t.full_name }}: {{ i18n.t('CHOOSE_DAY') }}</h3>
        <div class="row">
          @for (d of days(); track d.value) {
            <button class="chip" [class.on]="date() === d.value" (click)="setDate(d.value)">{{ d.label }}</button>
          }
        </div>
        <h3 class="mt">{{ i18n.t('TIME_LABEL') }}</h3>
        @if (loading()) { <div class="skeleton" style="height:56px"></div> }
        @else {
          <div class="row">
            @for (s of slots(); track s.time) {
              <button class="chip" [class.on]="time() === s.time" [disabled]="!s.available" (click)="pickTime(s.time)">{{ s.time }}</button>
            } @empty { <p>{{ i18n.t('NO_SLOTS') }}</p> }
          </div>
          <p class="mt-s" style="font-size:.85rem">{{ i18n.t('CROSSED_OUT_HINT') }}</p>
        }
      </div>
    }

    @if (trainer() && time()) {
      <div class="card mt" id="confirm">
        <h3>{{ i18n.t('CONFIRM_AND_PAY') }}</h3>
        <p>{{ trainer()!.full_name }} · {{ date() }} {{ time() }} · <b>{{ method === 'Membership' ? i18n.t('FREE_LABEL') : '5000 KZT' }}</b></p>
        <label for="m">{{ i18n.t('PAYMENT_METHOD') }}</label>
        <select id="m" [(ngModel)]="method">
          @if (wallet()?.has_subscription) { <option value="Membership">{{ i18n.t('PAY_SUBSCRIPTION') }}</option> }
          <option value="Wallet">{{ i18n.t('PAY_WALLET') }} ({{ wallet()?.balance_kzt ?? 0 }} KZT)</option>
          <option value="Card">{{ i18n.t('PAY_CARD') }}</option>
          <option value="Kaspi">Kaspi</option>
          <option value="Cash">{{ i18n.t('PAY_CASH') }}</option>
        </select>
        <label class="row" style="margin-top:14px"><input type="checkbox" style="width:auto" [(ngModel)]="simulateFailure" />
          {{ i18n.t('SIMULATE_FAILURE') }}</label>
        @if (error(); as e) {
          <div class="alert alert-error mt-s"><b>{{ e.message }}</b>
            @if (e.error === 'insufficient_funds' || e.error === 'no_subscription') { <a routerLink="/wallet" class="accent"> {{ i18n.t('OPEN_WALLET') }}</a> }
            @if (e.alternatives?.length) {
              <div class="row mt-s">{{ i18n.t('FREE_TIMES') }}
                @for (a of e.alternatives; track a) { <button class="chip" (click)="useAlternative(a)">{{ a }}</button> }
              </div>
            }
          </div>
        }
        <button class="btn btn-primary mt" [disabled]="busy()" (click)="confirm()">{{ busy() ? i18n.t('BOOKING_BUSY') : i18n.t('CONFIRM_BOOKING') }}</button>
      </div>
    }
  }

  @if (selectedTrainer(); as st) {
    <div class="modal-backdrop" (click)="selectedTrainer.set(null)">
      <div class="card modal-content" (click)="$event.stopPropagation()">
        @if (st.photo && !failed().has(st.trainer_id)) {
          <img [src]="st.photo" [alt]="st.full_name" referrerpolicy="no-referrer" (error)="photoFailed(st)" style="width: 100%; height: 220px; object-fit: cover; border-radius: 8px; margin-bottom: 15px;">
        } @else {
          <div class="photo-fallback" style="height:220px;border-radius:8px;margin-bottom:15px">{{ initials(st.full_name) }}</div>
        }
        <h2 style="margin-bottom: 5px;">{{ st.full_name }}</h2>
        <span class="badge b-Completed" style="display: inline-block; margin-bottom: 10px;">{{ i18n.tSpec(st.specialization) }}</span>
        <p style="margin: 8px 0;"><b>{{ i18n.t('WORKING_HOURS') }}</b> {{ st.working_hours }}</p>
        <p style="margin: 8px 0;"><b>{{ i18n.t('PHONE_LABEL') }}</b> {{ st.phone }}</p>
        <p style="margin: 8px 0;"><b>{{ i18n.t('RATING_LABEL') }}</b>
          @if (reviews(); as r) { @if (r.reviews_count) { <app-stars [value]="r.avg_rating" /> {{ r.avg_rating }} / 5 ({{ r.reviews_count }} {{ i18n.t('REVIEWS_WORD') }}) } @else { {{ i18n.t('NO_REVIEWS') }} } }
        </p>
        <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 15px 0;">
        <p style="font-size: 0.95rem; color: #94a3b8; line-height: 1.5;">
          <b>{{ i18n.t('EXPERIENCE_TITLE') }}</b> {{ i18n.t('EXPERIENCE_DESC') }}
        </p>
        @if (reviews(); as r) {
          @if (r.reviews.length) {
            <h3 style="margin-top:16px">{{ i18n.t('MEMBER_REVIEWS') }}</h3>
            <div class="reviews">
              @for (rv of r.reviews; track rv.id) {
                <div class="review"><div class="row between"><b>{{ rv.member_name }}</b><app-stars [value]="rv.rating" /></div>
                  @if (rv.comment) { <p style="margin:4px 0 0">{{ rv.comment }}</p> }
                  <span class="muted" style="font-size:.75rem">{{ rv.created_at | date: 'd MMM y' }}</span></div>
              }
            </div>
          }
        }
        <button class="btn btn-primary mt" style="width: 100%; margin-top: 20px;" (click)="selectedTrainer.set(null)">{{ i18n.t('BTN_CLOSE') }}</button>
      </div>
    </div>
  }`,
  styles: `
    .trainer-card {
      background: #1e293b; border: 1px solid #334155; border-radius: 16px; overflow: hidden;
      display: flex; flex-direction: column; padding: 0 !important; cursor: pointer;
      transition: all 0.25s ease; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .trainer-card:hover, .trainer-card.sel {
      border-color: #38bdf8; transform: translateY(-4px); box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.3);
    }
    .trainer-img-container { width: 100%; height: 220px; overflow: hidden; }
    .trainer-photo { width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease; }
    .trainer-card:hover .trainer-photo { transform: scale(1.05); }
    .trainer-info { padding: 16px 20px 8px 20px; display: flex; flex-direction: column; flex-grow: 1; }
    .badge-speciality { font-size: 0.75rem; font-weight: 700; color: #fbbf24; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .trainer-name { font-size: 1.25rem; font-weight: 700; color: #f8fafc; margin-bottom: 6px; }
    .trainer-hours { font-size: 0.85rem; color: #94a3b8; margin-bottom: 12px; }
    .btn-book {
      margin: 0 20px 10px 20px; background-color: #a3e635; color: #0f172a; border: none; border-radius: 12px;
      padding: 12px; font-weight: 700; font-size: 1rem; cursor: pointer; text-align: center; transition: background-color 0.2s, transform 0.1s;
    }
    .btn-book:hover { background-color: #bef264; }
    .btn-details {
      margin: 0 20px 20px 20px; background: rgba(255, 255, 255, 0.08); color: #f8fafc;
      border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 8px; font-size: 0.85rem;
      cursor: pointer; text-align: center; transition: background 0.2s;
    }
    .btn-details:hover { background: rgba(255, 255, 255, 0.15); }
    .trainer-rating { display:flex; align-items:center; gap:6px; font-size:.85rem; margin:0 0 10px; }
    .photo-fallback { width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:3rem; font-weight:800;
      color:#0f172a; background:linear-gradient(135deg,#a3e635,#38bdf8); }
    .reviews { max-height:200px; overflow:auto; display:grid; gap:8px; margin-top:8px; }
    .review { padding:10px 12px; border:1px solid var(--border-color); border-radius:10px; font-size:.9rem; }
    .modal-backdrop {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center; z-index: 1000;
    }
    .modal-content {
      width: 420px; max-width: 90%; padding: 24px; position: relative;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5); animation: fadeIn 0.2s ease-in-out;
    }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
  `
})
export class BookComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  readonly i18n = inject(I18nService);

  trainers = signal<Trainer[]>([]);
  wallet = signal<Wallet | null>(null);
  reviews = signal<TrainerReviews | null>(null);
  failed = signal<Set<string>>(new Set());
  trainer = signal<Trainer | null>(null);
  selectedTrainer = signal<Trainer | null>(null);

  days = computed(() => {
    const localeMap = { kk: 'kk-KZ', ru: 'ru-RU', en: 'en-GB' } as const;
    const locale = localeMap[this.i18n.lang()];
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return { value: iso(d), label: d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }) };
    });
  });

  date = signal(iso(new Date()));
  slots = signal<Slot[]>([]);
  time = signal<string | null>(null);
  loading = signal(false); busy = signal(false);
  result = signal<Booking | null>(null);
  error = signal<ApiError | null>(null);
  method = 'Card'; simulateFailure = false;
  step = computed(() => (!this.trainer() ? 1 : !this.time() ? 2 : 3));

  ngOnInit() {
    const preselectedId = this.route.snapshot.queryParamMap.get('trainer');
    this.api.trainers().subscribe(t => {
      this.trainers.set(t);
      if (preselectedId) {
        const match = t.find(x => String(x.trainer_id) === String(preselectedId));
        if (match) this.pick(match);
      }
    });
    this.loadWallet();
  }

  loadWallet() {
    this.api.wallet().subscribe(w => {
      if (!this.wallet()) this.method = w.has_subscription ? 'Membership' : 'Card';
      this.wallet.set(w);
    });
  }

  initials(name: string) { return name.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase(); }
  photoFailed(t: Trainer) { this.failed.update(s => new Set(s).add(t.trainer_id)); }

  private scrollTo(id: string) {
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  pick(t: Trainer) { this.trainer.set(t); this.time.set(null); this.error.set(null); this.loadSlots(); this.scrollTo('schedule'); }
  pickTime(v: string) { this.time.set(v); this.scrollTo('confirm'); }
  setDate(v: string) { this.date.set(v); this.time.set(null); this.error.set(null); this.loadSlots(); }

  showTrainerDetails(t: Trainer) {
    this.selectedTrainer.set(t);
    this.reviews.set(null);
    this.api.trainerReviews(t.trainer_id).subscribe(r => this.reviews.set(r));
  }

  loadSlots() {
    const t = this.trainer();
    if (!t) return;
    this.loading.set(true);
    this.api.slots(t.trainer_id, this.date()).subscribe({
      next: r => { this.slots.set(r.slots); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.show(this.i18n.t('ERR_SLOTS'), 'error'); }
    });
  }

  useAlternative(a: string) {
    const [d, t] = a.split(' ');
    this.date.set(d); this.time.set(t); this.error.set(null); this.loadSlots();
  }

  confirm() {
    const t = this.trainer(), time = this.time();
    if (!t || !time) return;
    this.busy.set(true); this.error.set(null);
    this.api.createBooking({
      trainer_id: t.trainer_id, session_start: `${this.date()} ${time}`,
      payment_method: this.method, simulate_payment_failure: this.simulateFailure
    }).subscribe({
      next: b => { this.busy.set(false); this.result.set(b); this.loadWallet(); this.toast.show(this.i18n.t('TOAST_BOOKING_SAVED'), 'success'); },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.error.set((e.error as ApiError)?.message ? e.error as ApiError : { error: 'network', message: this.i18n.t('ERR_SERVER') });
        this.time.set(null); this.loadSlots(); this.loadWallet();
      }
    });
  }

  reset() { this.result.set(null); this.trainer.set(null); this.time.set(null); this.simulateFailure = false; }
}