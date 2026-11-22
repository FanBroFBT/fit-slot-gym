import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { ApiError, Booking, Slot, Trainer, TrainingType } from '../core/models';
import { I18nService } from '../core/i18n.service';
import { combineLatest, Subscription } from 'rxjs';
import { ToastService } from '../core/toast.service';
import { ThemeService } from '../core/theme.service';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

@Component({
  selector: 'app-book',
  imports: [FormsModule, DatePipe, RouterLink],
  template: `
  <section class="brand-hero" aria-label="FitSlot training welcome">
    <div>
      <span class="eyebrow">✦ FITSLOT TRAINING CLUB</span>
      <h1>{{i18n.t('Book a training session')}}<span class="accent">.</span></h1>
      <p>Find your coach. Choose a format. Lock in your training time — all in one place.</p>
      <div class="brand-hero-actions">
        <span class="brand-mini-tag">✓ Real available slots</span>
        <span class="brand-mini-tag">✓ Individual & group</span>
        <span class="brand-mini-tag">✓ Smart AI coaching</span>
      </div>
    </div>
    <div class="brand-hero-media">
      <img [src]="themeSvc.current() === 'neon' ? '/mascot/fitslot-neon.webp' : '/mascot/fitslot-default.webp'"
           alt="FitSlot tiger mascot ready for training" width="255" height="341" />
    </div>
  </section>
  <div class="card mt-s">
    <b>{{i18n.t('Training format')}}</b>
    <div class="row mt-s">
      <button class="chip" [class.on]="trainingType() === 'individual'" (click)="setType('individual')">{{i18n.t('Individual (5,000 KZT)')}}</button>
      <button class="chip" [class.on]="trainingType() === 'group'" (click)="setType('group')">{{i18n.t('Group (2,500 KZT)')}}</button>
    </div>
  </div>
  <nav class="fs-stepper" aria-label="Booking progress">
    @for (label of stepLabels(); track $index) {
      <div class="fs-step" [class.current]="step() === $index + 1" [class.passed]="step() > $index + 1 || result()">
        <span>{{step() > $index + 1 || result() ? '✓' : $index + 1}}</span><small>{{label}}</small>
      </div>
    }
  </nav>

  @if (result(); as r) {
    <section class="card fs-booking-success" role="status" aria-live="polite">
      <div class="fs-success-glow" aria-hidden="true"></div>
      <img class="fs-success-mascot" [src]="themeSvc.current() === 'neon' ? '/mascot/fitslot-neon.webp' : '/mascot/fitslot-default.webp'"
        alt="FitSlot mascot celebrating your booking" width="160" height="214" />
      <span class="fs-success-mark">✓</span>
      <h1>{{successTitle()}}</h1><p>{{successSubtitle()}}</p>
      <div class="fs-success-details"><b>{{r.trainer_name}}</b><span>{{r.session_start | date:'EEEE d MMMM, HH:mm'}}</span><span>{{r.amount_kzt}} ₸ · {{r.payment_status}}</span><small>ID: {{r.booking_id}}</small></div>
      <div class="row" style="justify-content:center"><a class="btn btn-primary" routerLink="/my-bookings">{{i18n.t('My bookings')}} ↗</a><button class="btn" type="button" (click)="reset()">{{i18n.t('New booking')}}</button></div>
    </section>
  } @else {
    <div class="grid grid-3">
      @for (t of trainers(); track t.trainer_id) {
        <div class="card pick trainer-card" [class.sel]="trainer()?.trainer_id === t.trainer_id" (click)="pick(t)" (keydown.enter)="pick(t)" tabindex="0" [attr.aria-label]="i18n.t('Select a trainer') + ': '+ t.full_name">
          @if (t.photo) {
            <div class="trainer-img-container">
              <img [src]="t.photo" [alt]="t.full_name" class="trainer-photo" loading="lazy" decoding="async">
            </div>
          }
          <div class="trainer-info">
            <span class="badge-speciality">{{ t.specialization }}</span>
            <h3 class="trainer-name">{{ t.full_name }}</h3>
            <p class="trainer-hours">🕒 {{ t.working_hours }}</p>
          </div>
          
          <!-- Тренерді таңдау және брондау батырмасы -->
          <button class="btn-book" (click)="$event.stopPropagation(); pick(t)">
            {{i18n.t('Book now')}} ↗
          </button>

          <!-- Толығырақ көру батырмасы (модальды терезе үшін) -->
          <button class="btn-details" (click)="$event.stopPropagation(); showTrainerDetails(t)">
            {{i18n.t('Trainer profile')}}
          </button>
        </div>
      } @empty {
        @if (trainersLoading()) { @for (n of [1,2,3]; track n) { <div class="card"><div class="skeleton" style="height:188px"></div><div class="skeleton" style="height:22px;margin-top:14px;width:65%"></div></div> } }
        @else if (trainersError()) { <div class="card"><p>{{loadTrainersError()}}</p><button class="btn btn-primary" (click)="loadTrainers()">{{retryText()}}</button></div> }
        @else { <div class="card"><p>{{emptyTrainersText()}}</p></div> }
      }
    </div>

    @if (trainer(); as t) {
      <div class="card mt">
        <div class="fs-calendar-heading"><div><span class="fs-kicker">STEP 02 · YOUR TRAINING DAY</span><h3>{{i18n.t('Choose date')}}</h3><p>{{t.full_name}} · {{i18n.t(trainingType() === 'group' ? 'Group' : 'Individual')}}</p></div>
          <div class="fs-week-controls"><button type="button" class="btn btn-sm" [disabled]="weekOffset()===0" (click)="weekOffset.set(0)" aria-label="Previous week">‹</button>
            <span>{{weekLabel()}}</span><button type="button" class="btn btn-sm" [disabled]="weekOffset()===1" (click)="weekOffset.set(1)" aria-label="Next week">›</button></div>
        </div>
        <div class="fs-calendar" role="group" [attr.aria-label]="i18n.t('Choose date')">
          @for (d of visibleDays(); track d.value) {
            <button class="fs-calendar-day" type="button" [class.on]="date() === d.value" [attr.aria-pressed]="date() === d.value" (click)="setDate(d.value)">
              <span>{{dayWeek(d.value)}}</span><b>{{dayNumber(d.value)}}</b><small>{{dayMonth(d.value)}}</small>
            </button>
          }
        </div>
        <div class="fs-time-heading"><h3>{{i18n.t('Choose time')}}</h3><small>{{date()}} · {{i18n.t('Training format')}}: {{i18n.t(trainingType()==='group' ? 'Group' : 'Individual')}}</small></div>
        @if (loading()) { <div class="fs-time-skeleton"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div> }
        @else if (slotsError()) { <div class="alert alert-error"><p>{{slotLoadError()}}</p><button class="btn btn-sm" type="button" (click)="loadSlots()">{{retryText()}}</button></div> }
        @else {
          @for (group of slotGroups(); track group.label) {
            <div class="fs-time-group"><div class="fs-time-label">{{group.label}} <small>{{group.slots.length}}</small></div>
              <div class="fs-time-chips">
                @for (s of group.slots; track s.time) {
                  <button class="fs-time-chip" type="button" [class.on]="time() === s.time" [disabled]="!s.available"
                    [attr.aria-pressed]="time()===s.time" (click)="time.set(s.time)">
                    <b>{{s.time}}</b>
                    @if (trainingType() === 'group') { <small>{{s.available ? s.remaining_spots + ' ' + i18n.t('Remaining spots') : fullText()}}</small> }
                    @else { <small>{{s.available ? availableText() : fullText()}}</small> }
                  </button>
                }
              </div>
            </div>
          } @empty { <p class="mt">{{i18n.t('No slots on this day.')}}</p> }
          <p class="fs-calendar-note">● {{slotHint()}}</p>
        }
      </div>
    }

    @if (trainer() && time()) {
      <div class="card mt">
        <span class="fs-kicker">STEP 03 · READY TO TRAIN</span><h3 class="mt-s">{{i18n.t('Confirm and pay')}}</h3>
        <div class="fs-checkout-summary"><strong>{{trainer()!.full_name}}</strong><span>{{date()}} · {{time()}}</span><b>{{trainingType() === 'group' ? '2 500' : '5 000'}} ₸</b></div>
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
        <button class="btn btn-primary mt fs-confirm" type="button" [disabled]="busy()" (click)="confirm()">{{ busy() ? bookingText() : i18n.t('Confirm booking') }} ↗</button>
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
        
        <hr style="border: 0; border-top: 1px solid var(--border); margin: 15px 0;">
        
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
      transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
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
      color: var(--primary);
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
      color: var(--primary-ink);
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
      background: var(--surface-2);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 8px;
      font-size: 0.85rem;
      cursor: pointer;
      text-align: center;
      transition: background 0.2s;
    }
    .btn-details:hover {
      background: var(--surface-3);
    }

    /* Модальды терезе стилі */
    .modal-backdrop {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.75);
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
    .fs-stepper{display:flex;gap:12px;align-items:center;justify-content:space-between;margin:20px 0 24px;max-width:820px}.fs-step{display:flex;align-items:center;gap:9px;color:var(--muted);font-size:.8rem}.fs-step span{width:30px;height:30px;flex-shrink:0;display:grid;place-items:center;border-radius:50%;border:1px solid var(--border);background:var(--surface-2);font-weight:850}.fs-step.current{color:var(--text);font-weight:800}.fs-step.current span,.fs-step.passed span{background:var(--primary);color:var(--primary-ink);border-color:var(--primary)}
    .fs-calendar-heading,.fs-time-heading{display:flex;justify-content:space-between;align-items:center;gap:14px}.fs-calendar-heading h3{margin-top:5px}.fs-calendar-heading p{margin:0;font-size:.82rem}.fs-week-controls{display:flex;align-items:center;gap:9px;white-space:nowrap}.fs-week-controls span{font-size:.81rem;color:var(--muted)}
    .fs-calendar{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:9px;margin:21px 0 26px}.fs-calendar-day{display:grid;justify-items:center;gap:4px;min-width:0;cursor:pointer;color:var(--text);background:var(--surface-2);border:1px solid var(--border);padding:13px 4px;border-radius:14px;transition:transform .18s,border-color .18s}.fs-calendar-day:hover{border-color:var(--primary);transform:translateY(-2px)}.fs-calendar-day.on{background:var(--primary);color:var(--primary-ink);border-color:var(--primary)}.fs-calendar-day span,.fs-calendar-day small{font-size:.7rem}.fs-calendar-day b{font-size:1.35rem;line-height:1.15}
    .fs-time-heading small{color:var(--muted)}.fs-time-group{margin:20px 0}.fs-time-label{font-size:.77rem;font-weight:850;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:9px}.fs-time-label small{margin-left:5px;color:var(--primary)}.fs-time-chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:9px}.fs-time-chip{display:grid;gap:4px;justify-items:center;cursor:pointer;background:var(--surface-2);color:var(--text);border:1px solid var(--border);padding:12px 9px;border-radius:12px;transition:border-color .15s,transform .15s}.fs-time-chip b{font-size:1rem}.fs-time-chip small{font-size:.66rem;color:var(--muted)}.fs-time-chip:hover:not(:disabled){transform:translateY(-2px);border-color:var(--primary)}.fs-time-chip.on{border-color:var(--primary);background:color-mix(in srgb,var(--primary) 16%,var(--surface))}.fs-time-chip:disabled{opacity:.42;cursor:not-allowed}.fs-time-skeleton{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:18px}.fs-time-skeleton .skeleton{height:64px}.fs-calendar-note{font-size:.74rem;color:var(--muted);margin:18px 0 0}
    .fs-checkout-summary{display:flex;align-items:center;flex-wrap:wrap;gap:12px;padding:15px;border:1px solid var(--border);background:var(--surface-2);border-radius:13px}.fs-checkout-summary span{color:var(--muted);font-size:.82rem}.fs-checkout-summary b{margin-left:auto;color:var(--primary);font-size:1.2rem}.fs-confirm{min-width:200px}
    .fs-booking-success{text-align:center;position:relative;overflow:hidden;isolation:isolate;padding:30px 18px 36px}.fs-success-glow{position:absolute;z-index:-1;inset:0;background:radial-gradient(ellipse 300px 200px at 50% 30%,var(--glow),transparent)}.fs-success-mascot{display:block;width:140px;height:190px;object-fit:contain;margin:0 auto 5px;animation:fs-success-pop .7s cubic-bezier(.2,.8,.2,1) both}.fs-success-mark{display:inline-grid;place-items:center;width:40px;height:40px;border-radius:50%;background:var(--ok);color:var(--primary-ink);font-size:1.5rem;font-weight:900}.fs-booking-success h1{margin:16px 0 9px}.fs-booking-success p{max-width:540px;margin:0 auto 20px}.fs-success-details{display:grid;justify-content:center;gap:4px;padding:15px;border:1px solid var(--border);border-radius:15px;background:var(--surface-2);max-width:420px;margin:20px auto}.fs-success-details span,.fs-success-details small{color:var(--muted)}
    @keyframes fs-success-pop{from{opacity:0;transform:translateY(25px) scale(.8)}to{opacity:1;transform:translateY(0) scale(1)}}
    @media(max-width:600px){.fs-stepper{gap:5px}.fs-step{font-size:.68rem;gap:5px}.fs-step span{width:24px;height:24px}.fs-calendar{gap:4px}.fs-calendar-day{padding:10px 2px;border-radius:9px}.fs-calendar-day span,.fs-calendar-day small{font-size:.58rem}.fs-calendar-day b{font-size:1.1rem}.fs-week-controls span{font-size:.7rem}.fs-time-heading{display:block}}
    @media(prefers-reduced-motion:reduce){.fs-booking-success img{animation:none}.fs-calendar-day,.fs-time-chip{transition:none}}
  `
})
export class BookComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  themeSvc = inject(ThemeService);
  private route = inject(ActivatedRoute);
  i18n = inject(I18nService);
  trainingType = signal<TrainingType>('individual');
  private wantedTime: string | null = null;
  
  trainers = signal<Trainer[]>([]);
  trainersLoading = signal(true);
  trainersError = signal(false);
  slotsError = signal(false);
  weekOffset = signal(0);
  private slotsSub?: Subscription;
  trainer = signal<Trainer | null>(null);
  
  selectedTrainer = signal<Trainer | null>(null);

  days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    return { value: iso(d), label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) };
  });
  date = signal(this.days[0].value);
  visibleDays = computed(() => this.days.slice(this.weekOffset()*7,this.weekOffset()*7+7));
  slotGroups = computed(() => {
    const times = this.slots();
    const groups = [
      {label: this.groupLabel('morning'), slots: times.filter(s=>Number(s.time.slice(0,2))<12)},
      {label: this.groupLabel('afternoon'), slots: times.filter(s=>Number(s.time.slice(0,2))>=12 && Number(s.time.slice(0,2))<17)},
      {label: this.groupLabel('evening'), slots: times.filter(s=>Number(s.time.slice(0,2))>=17)}
    ];
    return groups.filter(g=>g.slots.length);
  });
  slots = signal<Slot[]>([]);
  time = signal<string | null>(null);
  loading = signal(false); busy = signal(false);
  result = signal<Booking | null>(null);
  error = signal<ApiError | null>(null);
  method = 'Card'; simulateFailure = false;
  step = computed(() => (!this.trainer() ? 1 : !this.time() ? 2 : 3));

  ngOnInit() { this.loadTrainers(); }
  ngOnDestroy() { this.slotsSub?.unsubscribe(); }
  loadTrainers() {
    this.trainersLoading.set(true);this.trainersError.set(false);
    combineLatest([this.api.trainers(), this.route.queryParamMap]).subscribe({next:([trainers, query]) => {
      this.trainers.set(trainers);this.trainersLoading.set(false);
      const kind = query.get('training_type');
      if (kind === 'individual' || kind === 'group') this.trainingType.set(kind);
      const id = query.get('trainer');
      const found = trainers.find(t => t.trainer_id === id);
      if (!found) return;
      const requestedDate = query.get('date');
      if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate >= this.days[0].value && requestedDate <= this.days[this.days.length-1].value) {
        this.date.set(requestedDate);
      }
      this.weekOffset.set(this.days.findIndex(d => d.value === this.date()) >= 7 ? 1 : 0);
      this.wantedTime = query.get('time');
      this.pick(found);
    },error:()=>{this.trainersLoading.set(false);this.trainersError.set(true)}});
  }

  pick(t: Trainer) { this.trainer.set(t); this.time.set(null); this.error.set(null); this.loadSlots(); }
  setDate(v: string) { if (this.date() === v) return; this.date.set(v); this.time.set(null); this.wantedTime = null; this.error.set(null); this.loadSlots(); }
  setType(v: TrainingType) { this.trainingType.set(v); this.time.set(null); this.error.set(null); this.loadSlots(); }

  showTrainerDetails(t: Trainer) {
    this.api.trainer(t.trainer_id).subscribe({next: details => this.selectedTrainer.set(details), error: () => this.selectedTrainer.set(t)});
  }

  loadSlots() {
    const t = this.trainer();
    if (!t) return;
    this.slotsSub?.unsubscribe();
    this.loading.set(true);this.slotsError.set(false);this.slots.set([]);
    this.slotsSub = this.api.slots(t.trainer_id, this.date(), this.trainingType()).subscribe({
      next: r => {
        this.slots.set(r.slots);
        if (this.wantedTime && r.slots.find(s => s.time === this.wantedTime)?.available) this.time.set(this.wantedTime);
        this.wantedTime = null;
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.slotsError.set(true); this.toast.show('Could not load time slots', 'error'); }
    });
  }

  useAlternative(a: string) {
    const [d, t] = a.split(' ');
    this.date.set(d); const offset = this.days.findIndex(day => day.value === d); if (offset >= 0) this.weekOffset.set(offset >= 7 ? 1 : 0); this.wantedTime = t; this.time.set(null); this.error.set(null); this.loadSlots();
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
  locale() { return this.i18n.lang()==='kk'?'kk-KZ':this.i18n.lang()==='ru'?'ru-RU':'en-GB'; }
  dayWeek(v:string){return new Date(v+'T12:00:00').toLocaleDateString(this.locale(),{weekday:'short'});}
  dayNumber(v:string){return v.slice(-2);}
  dayMonth(v:string){return new Date(v+'T12:00:00').toLocaleDateString(this.locale(),{month:'short'});}
  weekLabel(){return `${this.dayMonth(this.visibleDays()[0].value)} ${this.dayNumber(this.visibleDays()[0].value)}–${this.dayNumber(this.visibleDays()[6].value)}`;}
  groupLabel(v:'morning'|'afternoon'|'evening'){
    const map={morning:{kk:'Таңертең',ru:'Утро',en:'Morning'},afternoon:{kk:'Күндіз',ru:'День',en:'Afternoon'},evening:{kk:'Кешке',ru:'Вечер',en:'Evening'}};
    return map[v][this.i18n.lang()];
  }
  stepLabels(){return [this.i18n.t('Select a trainer'),this.i18n.t('Choose date'),this.i18n.t('Confirm and pay')];}
  successTitle(){const l=this.i18n.lang();return l==='kk'?'Жаттығу брондалды!':l==='ru'?'Тренировка забронирована!':'You’re booked!';}
  successSubtitle(){const l=this.i18n.lang();return l==='kk'?'Бәрі дайын. Жаттығуда кездескенше!':l==='ru'?'Всё готово. До встречи на тренировке!':'All set. See you at your session!';}
  slotHint(){const l=this.i18n.lang();return l==='kk'?'Бос емес уақыттар қолжетімсіз.':l==='ru'?'Занятые слоты недоступны.':'Unavailable times cannot be selected.';}
  availableText(){const l=this.i18n.lang();return l==='kk'?'Бос':l==='ru'?'Свободно':'Available';}
  fullText(){const l=this.i18n.lang();return l==='kk'?'Толған':l==='ru'?'Занято':'Full';}
  bookingText(){const l=this.i18n.lang();return l==='kk'?'Брондалуда…':l==='ru'?'Бронируем…':'Booking…';}
  retryText(){const l=this.i18n.lang();return l==='kk'?'Қайталау':l==='ru'?'Повторить':'Retry';}
  slotLoadError(){const l=this.i18n.lang();return l==='kk'?'Бос уақыттар жүктелмеді.':l==='ru'?'Не удалось загрузить слоты.':'Could not load slots.';}
  loadTrainersError(){const l=this.i18n.lang();return l==='kk'?'Тренерлер жүктелмеді.':l==='ru'?'Не удалось загрузить тренеров.':'Could not load trainers.';}
  emptyTrainersText(){const l=this.i18n.lang();return l==='kk'?'Әзірге тренерлер жоқ.':l==='ru'?'Пока нет тренеров.':'No trainers yet.';}
}

