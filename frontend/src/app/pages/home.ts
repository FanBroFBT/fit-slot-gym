import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { CoachPanelService } from '../core/coach-panel.service';
import { I18nService } from '../core/i18n.service';
import { ThemeService } from '../core/theme.service';
import { Booking, MyStats, Trainer } from '../core/models';

@Component({
  selector: 'app-home',
  imports: [RouterLink, DatePipe, DecimalPipe],
  template: `
    <section class="home-hero fs-enter">
      <div class="home-copy">
        <span class="home-kicker">✦ FITSLOT · YOUR TRAINING SPACE</span>
        <h1>{{ greeting() }}<span class="accent">.</span><br><span class="home-heading-muted">{{ tagline() }}</span></h1>
        <p>{{ subline() }}</p>
        <div class="hero-buttons">
          <a class="btn btn-primary" routerLink="/book">{{i18n.t('Book now')}} <span aria-hidden="true">↗</span></a>
          <button class="btn" type="button" (click)="coach.open()">✦ {{i18n.t('AI Fitness Coach')}}</button>
        </div>
        <div class="hero-proof"><span class="proof-dot"></span>{{ helperText() }}</div>
      </div>
      <div class="home-art" aria-hidden="true">
        <span class="art-orbit orbit-a"></span><span class="art-orbit orbit-b"></span>
        <img [src]="theme.current() === 'neon' ? '/mascot/fitslot-neon.webp' : '/mascot/fitslot-default.webp'"
          alt="" width="270" height="360" fetchpriority="high" />
        <div class="art-tag">✦ TRAIN SMARTER</div>
      </div>
    </section>

    <div class="home-section-heading"><div><span class="home-kicker">YOUR OVERVIEW</span><h2>{{ overviewTitle() }}</h2></div>
      <a routerLink="/stats" class="home-text-link">{{i18n.t('Stats')}} <span aria-hidden="true">↗</span></a>
    </div>
    @if (statsLoading()) {
      <div class="grid grid-4 home-stat-grid" aria-label="Loading workout statistics">
        @for (n of [1,2,3,4]; track n) { <div class="card home-stat"><div class="skeleton" style="height:18px;width:48%"></div><div class="skeleton" style="height:44px;width:65%;margin-top:22px"></div></div> }
      </div>
    } @else if (stats(); as s) {
      <div class="grid grid-4 home-stat-grid">
        <article class="card home-stat"><div class="stat-icon">▣</div><span>{{i18n.t('Completed workouts')}}</span><strong>{{s.total_sessions}}</strong><small>{{i18n.t('sessions')}}</small></article>
        <article class="card home-stat"><div class="stat-icon">◷</div><span>{{i18n.t('Training hours')}}</span><strong>{{s.total_hours}}</strong><small>HOURS</small></article>
        <article class="card home-stat"><div class="stat-icon">↗</div><span>{{i18n.t('Upcoming sessions')}}</span><strong>{{s.upcoming}}</strong><small>NEXT UP</small></article>
        <article class="card home-stat"><div class="stat-icon">◇</div><span>{{i18n.t('Loyalty progress')}}</span><strong>{{s.loyalty_progress}}<em> / 5</em></strong><div class="home-progress"><div [style.width.%]="loyaltyPercent()"></div></div></article>
      </div>
    } @else {
      <div class="card home-retry"><span>{{ loadErrorText() }}</span><button class="btn btn-sm" (click)="loadStats()">{{ retryText() }}</button></div>
    }

    <div class="home-two-col">
      <section class="card upcoming-panel">
        <div class="row between"><div><span class="home-kicker">YOUR SCHEDULE</span><h2>{{ nextTitle() }}</h2></div>
          <a routerLink="/my-bookings" class="home-text-link">{{i18n.t('My bookings')}} ↗</a>
        </div>
        @if (bookingsLoading()) {
          <div class="skeleton" style="height:110px;margin-top:20px"></div>
        } @else if (nextBooking(); as b) {
          <div class="upcoming-session">
            <div class="session-date"><b>{{b.session_start | date:'dd'}}</b><small>{{b.session_start | date:'MMM'}}</small></div>
            <div class="session-info"><strong>{{b.trainer_name}}</strong><span>{{b.specialization}}</span>
              <small>{{b.session_start | date:'EEEE, HH:mm'}} · {{i18n.t(b.training_type === 'group' ? 'Group' : 'Individual')}}</small>
            </div>
            <span class="upcoming-marker">●</span>
          </div>
        } @else if (bookingsError()) {
          <p class="mt">{{loadErrorText()}}</p><button class="btn btn-sm" (click)="loadBookings()">{{ retryText() }}</button>
        } @else {
          <div class="empty-next"><span class="empty-icon">✦</span><strong>{{emptyTitle()}}</strong><p>{{emptySubtitle()}}</p>
            <a class="btn btn-primary btn-sm" routerLink="/book">{{i18n.t('Book now')}} ↗</a>
          </div>
        }
      </section>
      <section class="card coach-panel">
        <span class="home-kicker">MEET YOUR COACH</span>
        <div class="coach-promo"><div><h2>{{coachTitle()}}</h2><p>{{coachText()}}</p><button class="btn btn-primary" (click)="coach.open()">✦ {{i18n.t('AI Fitness Coach')}} ↗</button></div>
          <img [src]="theme.current() === 'neon' ? '/mascot/fitslot-coach-neon.webp' : '/mascot/fitslot-coach.webp'" alt="" width="142" height="142" loading="lazy" />
        </div>
      </section>
    </div>

    <div class="home-section-heading"><div><span class="home-kicker">THE PEOPLE BEHIND YOUR PROGRESS</span><h2>{{trainerTitle()}}</h2></div>
      <a routerLink="/trainers" class="home-text-link">{{i18n.t('Trainers')}} ↗</a>
    </div>
    @if (trainersLoading()) {
      <div class="grid grid-3">
        @for (n of [1,2,3]; track n) { <div class="card home-trainer-skeleton"><div class="skeleton" style="height:145px"></div><div class="skeleton" style="height:22px;width:64%;margin-top:18px"></div></div> }
      </div>
    } @else if (recommended().length) {
      <div class="grid grid-3">
        @for (t of recommended(); track t.trainer_id) {
          <a class="card home-trainer-card" [routerLink]="['/book']" [queryParams]="{trainer:t.trainer_id}">
            <div class="home-trainer-img">
              @if (t.photo) { <img [src]="t.photo" [alt]="t.full_name" loading="lazy" decoding="async" /> }
              @else { <span>{{ initials(t.full_name) }}</span> }
              <small>★ {{t.avg_rating ?? '—'}}</small>
            </div>
            <div class="row between"><div><h3>{{t.full_name}}</h3><p>{{t.specialization}}</p></div><span class="trainer-arrow">↗</span></div>
          </a>
        }
      </div>
    } @else {
      <div class="card"><p>{{trainersError() ? loadErrorText() : emptyTrainersText()}}</p>
        @if (trainersError()) { <button class="btn btn-sm" (click)="loadTrainers()">{{retryText()}}</button> }
      </div>
    }
  `,
  styles: `
    .home-hero{display:grid;grid-template-columns:minmax(0,1fr) 37%;position:relative;overflow:hidden;isolation:isolate;align-items:center;min-height:370px;border:1px solid var(--border);border-radius:28px;padding:42px 40px 0;background:radial-gradient(ellipse at 79% 31%,var(--glow),transparent 52%),var(--surface)}
    .home-copy{z-index:1;padding-bottom:44px}.home-kicker{font-size:.72rem;font-weight:850;letter-spacing:.17em;color:var(--primary)}
    .home-copy h1{font-size:clamp(2.2rem,4.7vw,4rem);margin:18px 0}.home-heading-muted{color:var(--muted)}.home-copy p{max-width:460px;font-size:1rem}
    .hero-buttons{display:flex;flex-wrap:wrap;gap:12px;margin:23px 0}.hero-proof{font-size:.75rem;color:var(--muted);display:flex;align-items:center;gap:9px}.proof-dot{background:var(--ok);width:7px;height:7px;border-radius:50%}
    .home-art{min-height:350px;align-self:stretch;position:relative;display:flex;align-items:flex-end;justify-content:center}
    .home-art img{position:relative;z-index:1;width:min(100%,275px);height:auto;max-height:345px;object-fit:contain;object-position:bottom;filter:drop-shadow(0 16px 27px #0004);animation:fs-mascot-float 5s ease-in-out infinite}
    .art-orbit{position:absolute;border:1px solid var(--border);border-radius:50%;left:50%;top:50%;transform:translate(-50%,-50%)}.orbit-a{width:230px;height:230px}.orbit-b{width:320px;height:320px;opacity:.7}
    .art-tag{position:absolute;right:0;top:19%;z-index:2;background:var(--surface-2);color:var(--text);padding:9px 12px;border:1px solid var(--border);border-radius:10px;font-size:.65rem;letter-spacing:.1em;font-weight:800}
    .home-section-heading{display:flex;justify-content:space-between;align-items:end;gap:15px;margin:34px 0 14px}.home-section-heading h2{margin-top:5px}.home-text-link{color:var(--primary);font-size:.82rem;font-weight:750;text-decoration:none;white-space:nowrap}.home-text-link:hover{text-decoration:underline}
    .home-stat-grid{gap:14px}.home-stat{min-height:170px;display:flex;flex-direction:column;align-items:flex-start}.stat-icon{color:var(--primary);font-size:1.35rem;font-weight:850;margin-bottom:9px}.home-stat span{color:var(--muted);font-size:.8rem}.home-stat strong{font:850 2.25rem var(--font-head);margin:5px 0;color:var(--text)}.home-stat strong em{font:600 1rem var(--font);color:var(--muted)}.home-stat small{font-size:.65rem;letter-spacing:.12em;color:var(--muted)}.home-progress{height:5px;background:var(--surface-3);width:100%;border-radius:4px;margin-top:8px;overflow:hidden}.home-progress div{background:var(--primary);height:100%;transition:width .3s}
    .home-two-col{display:grid;grid-template-columns:1.05fr 1fr;gap:18px;margin-top:23px}.upcoming-panel,.coach-panel{min-height:250px}.upcoming-session{display:flex;align-items:center;gap:15px;margin-top:24px;background:var(--surface-2);border:1px solid var(--border);padding:18px;border-radius:16px}.session-date{display:grid;place-items:center;min-width:64px;border-radius:12px;padding:12px 5px;background:var(--primary);color:var(--primary-ink)}.session-date b{font-size:1.6rem;line-height:1.1}.session-date small{text-transform:uppercase}.session-info{display:grid;gap:5px}.session-info strong{font-size:1rem}.session-info span,.session-info small{color:var(--muted);font-size:.78rem}.upcoming-marker{color:var(--ok);margin-left:auto}.empty-next{text-align:center;padding:15px 10px;display:grid;justify-items:center;gap:8px}.empty-next p{font-size:.83rem}.empty-icon{font-size:2rem;color:var(--primary)}
    .coach-panel{background:radial-gradient(ellipse at right bottom,var(--glow),transparent 68%),var(--surface)}.coach-promo{display:flex;gap:8px;align-items:center;margin-top:15px}.coach-promo>div{min-width:0;flex:1}.coach-promo p{font-size:.83rem}.coach-promo img{width:37%;max-width:150px;height:auto;object-fit:contain}
    .home-trainer-card{text-decoration:none;padding:12px;transition:transform .18s,border-color .18s}.home-trainer-card:hover{transform:translateY(-3px);border-color:var(--primary)}.home-trainer-img{height:154px;border-radius:14px;background:var(--surface-2);overflow:hidden;position:relative;display:grid;place-items:center;margin-bottom:14px}.home-trainer-img img{width:100%;height:100%;object-fit:cover}.home-trainer-img>span{font-size:3rem;font-weight:900;color:var(--primary)}.home-trainer-img small{position:absolute;bottom:9px;right:9px;padding:5px 10px;background:var(--surface);border:1px solid var(--border);border-radius:9px;font-weight:800}.home-trainer-card .row{padding:0 7px 5px}.home-trainer-card h3{margin-bottom:3px}.home-trainer-card p{font-size:.77rem;margin:0}.trainer-arrow{color:var(--primary);font-size:1.3rem}.home-retry{display:flex;align-items:center;justify-content:space-between;gap:12px}
    @media(max-width:840px){.home-two-col{grid-template-columns:1fr}.home-hero{padding:28px 26px 0}.home-art img{max-height:285px}.home-art{min-height:285px}}
    @media(max-width:560px){.home-hero{grid-template-columns:1fr 105px;min-height:250px;padding:22px 16px 0;border-radius:18px}.home-copy{padding-bottom:23px}.home-copy h1{font-size:clamp(1.5rem,7vw,2rem);margin:10px 0}.home-copy p{font-size:.8rem}.hero-buttons{margin:14px 0}.hero-buttons .btn{padding:8px 11px;font-size:.78rem}.hero-proof{font-size:.65rem}.home-art{min-height:225px}.home-art img{width:150px;max-width:none;height:auto;max-height:225px;object-position:bottom}.art-tag,.art-orbit{display:none}.home-section-heading h2{font-size:1.25rem}.coach-promo img{width:115px}}
    @media(prefers-reduced-motion:reduce){.home-art img{animation:none}}
  `
})
export class HomeComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  readonly coach = inject(CoachPanelService);
  readonly theme = inject(ThemeService);
  readonly i18n = inject(I18nService);
  readonly stats = signal<MyStats | null>(null);
  readonly bookings = signal<Booking[]>([]);
  readonly trainers = signal<Trainer[]>([]);
  readonly statsLoading = signal(true);
  readonly bookingsLoading = signal(true);
  readonly trainersLoading = signal(true);
  readonly bookingsError = signal(false);
  readonly trainersError = signal(false);
  readonly nextBooking = computed(() => this.bookings().filter(b => b.status === 'Confirmed' && new Date(b.session_start).getTime() > Date.now()).sort((a,b) => new Date(a.session_start).getTime()-new Date(b.session_start).getTime())[0] ?? null);
  readonly recommended = computed(() => [...this.trainers()].sort((a,b) => (b.avg_rating ?? -1) - (a.avg_rating ?? -1) || b.reviews_count - a.reviews_count).slice(0,3));
  readonly loyaltyPercent = computed(() => Math.max(0,Math.min(100,(this.stats()?.loyalty_progress ?? 0)/5*100)));
  ngOnInit() { this.loadStats();this.loadBookings();this.loadTrainers(); }
  loadStats() { this.statsLoading.set(true);this.api.myStats().subscribe({next:v=>{this.stats.set(v);this.statsLoading.set(false)},error:()=>{this.stats.set(null);this.statsLoading.set(false)}}); }
  loadBookings() { this.bookingsError.set(false);this.bookingsLoading.set(true);this.api.myBookings().subscribe({next:v=>{this.bookings.set(v);this.bookingsLoading.set(false)},error:()=>{this.bookingsError.set(true);this.bookingsLoading.set(false)}}); }
  loadTrainers() { this.trainersError.set(false);this.trainersLoading.set(true);this.api.trainers().subscribe({next:v=>{this.trainers.set(v);this.trainersLoading.set(false)},error:()=>{this.trainersError.set(true);this.trainersLoading.set(false)}}); }
  initials(name:string){return name.trim().split(/\s+/).map(s=>s[0]??'').slice(0,2).join('').toUpperCase();}
  greeting() { const l=this.i18n.lang();return l==='kk'?'Алға, чемпион':l==='ru'?'Вперёд, чемпион':'Move with purpose'; }
  tagline(){const l=this.i18n.lang();return l==='kk'?'Жаттығуың осы жерден басталады':l==='ru'?'Твой прогресс начинается здесь':'Your progress starts here';}
  subline(){const l=this.i18n.lang();return l==='kk'?'Тренер, брондау, статистика және AI көмекші — бәрі бір жерде.':l==='ru'?'Тренеры, записи, статистика и AI-помощник — всё в одном месте.':'Your trainers, bookings, progress and AI coach — all in one place.';}
  helperText(){const l=this.i18n.lang();return l==='kk'?'Шынайы жаттықтырушылар · Қолжетімді уақыттар':l==='ru'?'Настоящие тренеры · Доступные слоты':'Real coaches · Live booking availability';}
  overviewTitle(){const l=this.i18n.lang();return l==='kk'?'Сенің жетістіктерің':l==='ru'?'Твои результаты':'Your progress at a glance';}
  nextTitle(){const l=this.i18n.lang();return l==='kk'?'Келесі жаттығу':l==='ru'?'Следующая тренировка':'Next on your calendar';}
  emptyTitle(){const l=this.i18n.lang();return l==='kk'?'Әзірге бронь жоқ':l==='ru'?'Пока нет тренировок':'No upcoming sessions';}
  emptySubtitle(){const l=this.i18n.lang();return l==='kk'?'Алғашқы жаттығуыңды таңда.':l==='ru'?'Забронируй первую тренировку.':'Your next win starts with one booking.';}
  coachTitle(){const l=this.i18n.lang();return l==='kk'?'Жаттығудағы серігің':l==='ru'?'Твой персональный помощник':'Your training companion';}
  coachText(){const l=this.i18n.lang();return l==='kk'?'Жоспар құрастыр, қалпына келу туралы сұра немесе тренер таңда.':l==='ru'?'Составь план, узнай о восстановлении или найди тренера.':'Get workout ideas, recovery tips and help choosing a real coach.';}
  trainerTitle(){const l=this.i18n.lang();return l==='kk'?'Жаттықтырушылармен таныс':l==='ru'?'Познакомься с тренерами':'Meet your next coach';}
  retryText(){const l=this.i18n.lang();return l==='kk'?'Қайталау':l==='ru'?'Повторить':'Retry';}
  loadErrorText(){const l=this.i18n.lang();return l==='kk'?'Қазір деректерді жүктеу мүмкін болмады.':l==='ru'?'Не удалось загрузить данные.':'Could not load data right now.';}
  emptyTrainersText(){const l=this.i18n.lang();return l==='kk'?'Әзірге тренерлер жоқ.':l==='ru'?'Пока нет тренеров.':'No trainers available yet.';}
}
