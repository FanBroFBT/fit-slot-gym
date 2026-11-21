import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { ApiError, Booking, Slot, Trainer, TrainingType } from '../core/models';
import { I18nService } from '../core/i18n.service';
import { combineLatest } from 'rxjs';
import { ToastService } from '../core/toast.service';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

@Component({
  selector: 'app-book',
  imports: [FormsModule, DatePipe, RouterLink],
  template: `
  <h2>{{ i18n.t('Book a training session') }}</h2>
  <div class="card mt-s">
    <b>{{i18n.t('Training format')}}</b>
    <div class="row mt-s">
      <button class="chip" [class.on]="trainingType() === 'individual'" (click)="setType('individual')">{{i18n.t('Individual (5,000 KZT)')}}</button>
      <button class="chip" [class.on]="trainingType() === 'group'" (click)="setType('group')">{{i18n.t('Group (2,500 KZT)')}}</button>
    </div>
  </div>
  <p>Step {{ step() }} of 3: {{ ['Choose a trainer', 'Choose date and time', 'Confirm and pay'][step() - 1] }}</p>

  @if (result(); as r) {
    <div class="card alert-ok" style="text-align:center;padding:40px">
      <h1 class="accent">Booked ✓</h1>
      <p>Booking <b>{{ r.booking_id }}</b> with {{ r.trainer_name }}</p>
      <p>{{ r.session_start | date: 'EEEE d MMMM, HH:mm' }} · {{ r.amount_kzt }} KZT {{ r.payment_status }}</p>
      <div class="row" style="justify-content:center">
        <a class="btn btn-primary" routerLink="/my-bookings">My bookings</a>
        <button class="btn" (click)="reset()">Book another</button>
      </div>
    </div>
  } @else {
    <div class="grid grid-3">
      @for (t of trainers(); track t.trainer_id) {
        <div class="card pick trainer-card" [class.sel]="trainer()?.trainer_id === t.trainer_id" (click)="pick(t)">
          @if (t.photo) {
            <div class="trainer-img-container">
              <img [src]="t.photo" [alt]="t.full_name" class="trainer-photo">
            </div>
          }
          <div class="trainer-info">
            <span class="badge-speciality">{{ t.specialization }}</span>
            <h3 class="trainer-name">{{ t.full_name }}</h3>
            <p class="trainer-hours">🕒 {{ t.working_hours }}</p>
          </div>
          
          <!-- Тренерді таңдау және брондау батырмасы -->
          <button class="btn-book" (click)="$event.stopPropagation(); pick(t)">
            Book
          </button>

          <!-- Толығырақ көру батырмасы (модальды терезе үшін) -->
          <button class="btn-details" (click)="$event.stopPropagation(); showTrainerDetails(t)">
            Толығырақ көру
          </button>
        </div>
      } @empty { <div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div> }
    </div>

    @if (trainer(); as t) {
      <div class="card mt">
        <h3>{{ t.full_name }}: choose a day</h3>
        <div class="row">
          @for (d of days; track d.value) {
            <button class="chip" [class.on]="date() === d.value" (click)="setDate(d.value)">{{ d.label }}</button>
          }
        </div>
        <h3 class="mt">Time</h3>
        @if (loading()) { <div class="skeleton" style="height:56px"></div> }
        @else {
          <div class="row">
            @for (s of slots(); track s.time) {
              <button class="chip" [class.on]="time() === s.time" [disabled]="!s.available" (click)="time.set(s.time)">{{ s.time }} @if(trainingType() === 'group'){ ({{s.spots_taken}}/{{s.max_capacity}}) }</button>
            } @empty { <p>No slots on this day.</p> }
          </div>
          <p class="mt-s" style="font-size:.85rem">Crossed-out times are booked or in the past.</p>
        }
      </div>
    }

    @if (trainer() && time()) {
      <div class="card mt">
        <h3>Confirm and pay</h3>
        <p>{{ trainer()!.full_name }} · {{ date() }} {{ time() }} · <b>{{trainingType() === 'group' ? '2500' : '5000'}} KZT</b></p>
        <label for="m">Payment method</label>
        <select id="m" [(ngModel)]="method"><option>Card</option><option>Kaspi</option><option>Cash</option></select>
        <label class="row" style="margin-top:14px"><input type="checkbox" style="width:auto" [(ngModel)]="simulateFailure" />
          Demo: simulate payment failure (booking must be rolled back)</label>
        @if (error(); as e) {
          <div class="alert alert-error mt-s"><b>{{ e.message }}</b>
            @if (e.alternatives?.length) {
              <div class="row mt-s">Free times:
                @for (a of e.alternatives; track a) { <button class="chip" (click)="useAlternative(a)">{{ a }}</button> }
              </div>
            }
          </div>
        }
        <button class="btn btn-primary mt" [disabled]="busy()" (click)="confirm()">{{ busy() ? 'Booking…' : 'Confirm booking' }}</button>
      </div>
    }
  }

  <!-- Тренердің жеке модальды терезесі (Modal) -->
  @if (selectedTrainer(); as st) {
    <div class="modal-backdrop" (click)="selectedTrainer.set(null)">
      <div class="card modal-content" (click)="$event.stopPropagation()">
        @if (st.photo) {
          <img [src]="st.photo" [alt]="st.full_name" style="width: 100%; height: 220px; object-fit: cover; border-radius: 8px; margin-bottom: 15px;">
        }
        <h2 style="margin-bottom: 5px;">{{ st.full_name }}</h2>
        <span class="badge b-Completed" style="display: inline-block; margin-bottom: 10px;">{{ st.specialization }}</span>
        
        <p style="margin: 8px 0;"><b>Жұмыс уақыты:</b> {{ st.working_hours }}</p>
        <p style="margin: 8px 0;"><b>Байланыс телефоны:</b> {{ st.phone }}</p>
        
        <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 15px 0;">
        
        <p style="font-size: 0.95rem; color: var(--muted); line-height: 1.5;">
          <b>{{i18n.t('Experience')}}:</b> {{st.experience_years}} {{i18n.t('years')}} · {{st.bio}}
        </p>

        <h3>⭐ {{i18n.t('Rating')}}: {{st.avg_rating ?? '—'}} ({{st.reviews_count}})</h3>
        <h3>{{i18n.t('Certificates & Qualifications')}}</h3>
        @for(cert of st.certificates;track cert.id) { <p>🏅 {{cert.title}} · {{cert.issuer}} · {{cert.year}}</p> }
        <h3>{{i18n.t('Client reviews')}}</h3>
        @for(review of st.reviews ?? [];track review.id){ <p>⭐ {{review.rating}} — {{review.member_name}}: {{review.comment}}</p> }
        <button class="btn btn-primary mt" style="width: 100%; margin-top: 20px;" (click)="selectedTrainer.set(null)">{{i18n.t('Close')}}</button>
      </div>
    </div>
  }`,
  styles: `
    .trainer-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      padding: 0 !important;
      cursor: pointer;
      transition: all 0.25s ease;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .trainer-card:hover, .trainer-card.sel {
      border-color: var(--primary);
      transform: translateY(-4px);
      box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.3);
    }
    .trainer-img-container {
      width: 100%;
      height: 220px;
      overflow: hidden;
    }
    .trainer-photo {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.4s ease;
    }
    .trainer-card:hover .trainer-photo {
      transform: scale(1.05);
    }
    .trainer-info {
      padding: 16px 20px 8px 20px;
      display: flex;
      flex-direction: column;
      flex-grow: 1;
    }
    .badge-speciality {
      font-size: 0.75rem;
      font-weight: 700;
      color: #fbbf24;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .trainer-name {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 6px;
    }
    .trainer-hours {
      font-size: 0.85rem;
      color: var(--muted);
      margin-bottom: 12px;
    }
    .btn-book {
      margin: 0 20px 10px 20px;
      background-color: var(--primary);
      color: #0f172a;
      border: none;
      border-radius: 12px;
      padding: 12px;
      font-weight: 700;
      font-size: 1rem;
      cursor: pointer;
      text-align: center;
      transition: background-color 0.2s, transform 0.1s;
    }
    .btn-book:hover {
      background-color: var(--primary);
    }
    .btn-details {
      margin: 0 20px 20px 20px;
      background: rgba(255, 255, 255, 0.08);
      color: var(--text);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 8px;
      font-size: 0.85rem;
      cursor: pointer;
      text-align: center;
      transition: background 0.2s;
    }
    .btn-details:hover {
      background: rgba(255, 255, 255, 0.15);
    }

    /* Модальды терезе стилі */
    .modal-backdrop {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center; z-index: 1000;
    }
    .modal-content {
      width: 420px; max-width: 90%; padding: 24px; position: relative;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5); animation: fadeIn 0.2s ease-in-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `
})
export class BookComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  i18n = inject(I18nService);
  trainingType = signal<TrainingType>('individual');
  private wantedTime: string | null = null;
  
  trainers = signal<Trainer[]>([]);
  trainer = signal<Trainer | null>(null);
  
  selectedTrainer = signal<Trainer | null>(null);

  days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    return { value: iso(d), label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) };
  });
  date = signal(this.days[0].value);
  slots = signal<Slot[]>([]);
  time = signal<string | null>(null);
  loading = signal(false); busy = signal(false);
  result = signal<Booking | null>(null);
  error = signal<ApiError | null>(null);
  method = 'Card'; simulateFailure = false;
  step = computed(() => (!this.trainer() ? 1 : !this.time() ? 2 : 3));

  ngOnInit() {
    combineLatest([this.api.trainers(), this.route.queryParamMap]).subscribe(([trainers, query]) => {
      this.trainers.set(trainers);
      const kind = query.get('training_type');
      if (kind === 'individual' || kind === 'group') this.trainingType.set(kind);
      const id = query.get('trainer');
      const found = trainers.find(t => t.trainer_id === id);
      if (!found) return;
      const requestedDate = query.get('date');
      if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate >= this.days[0].value && requestedDate <= this.days[this.days.length-1].value) {
        this.date.set(requestedDate);
      }
      this.wantedTime = query.get('time');
      this.pick(found);
    });
  }

  pick(t: Trainer) { this.trainer.set(t); this.time.set(null); this.error.set(null); this.loadSlots(); }
  setDate(v: string) { this.date.set(v); this.time.set(null); this.wantedTime = null; this.error.set(null); this.loadSlots(); }
  setType(v: TrainingType) { this.trainingType.set(v); this.time.set(null); this.error.set(null); this.loadSlots(); }

  showTrainerDetails(t: Trainer) {
    this.api.trainer(t.trainer_id).subscribe({next: details => this.selectedTrainer.set(details), error: () => this.selectedTrainer.set(t)});
  }

  loadSlots() {
    const t = this.trainer();
    if (!t) return;
    this.loading.set(true);
    this.api.slots(t.trainer_id, this.date(), this.trainingType()).subscribe({
      next: r => {
        this.slots.set(r.slots);
        if (this.wantedTime && r.slots.find(s => s.time === this.wantedTime)?.available) this.time.set(this.wantedTime);
        this.wantedTime = null;
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.toast.show('Could not load time slots', 'error'); }
    });
  }

  useAlternative(a: string) {
    const [d, t] = a.split(' ');
    this.date.set(d); this.wantedTime = t; this.time.set(null); this.error.set(null); this.loadSlots();
  }

  confirm() {
    const t = this.trainer(), time = this.time();
    if (!t || !time) return;
    this.busy.set(true); this.error.set(null);
    this.api.createBooking({
      trainer_id: t.trainer_id, session_start: `${this.date()} ${time}`,
      payment_method: this.method, training_type: this.trainingType(), simulate_payment_failure: this.simulateFailure
    }).subscribe({
      next: b => { this.busy.set(false); this.result.set(b); this.toast.show('Booking saved', 'success'); },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.error.set((e.error as ApiError)?.message ? e.error as ApiError : { error: 'network', message: 'Server is not reachable.' });
        this.time.set(null); this.loadSlots();
      }
    });
  }

  reset() { this.result.set(null); this.trainer.set(null); this.time.set(null); this.simulateFailure = false; }
}