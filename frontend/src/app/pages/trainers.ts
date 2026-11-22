import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../core/api.service';
import { I18nService } from '../core/i18n.service';
import { Slot, Trainer, TrainingType } from '../core/models';
import { ToastService } from '../core/toast.service';

const dateCode = (day: Date) => `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
type SortMode = 'rating' | 'experience' | 'name';

@Component({
  selector: 'app-trainers',
  imports: [FormsModule],
  template: `
    <section class="coaches-intro fs-enter">
      <div><span class="fs-kicker">FITSLOT PRO TEAM</span><h1>{{title()}}<span class="accent">.</span></h1><p>{{subtitle()}}</p></div>
      <div class="coaches-count">{{trainers().length}} <small>{{i18n.t('Trainers')}}</small></div>
    </section>

    <section class="coaches-tools" aria-label="Trainer search and sorting">
      <div class="search-box"><span aria-hidden="true">⌕</span>
        <input type="search" [ngModel]="search()" (ngModelChange)="search.set($event)" [placeholder]="searchPlaceholder()" aria-label="Search trainers" />
      </div>
      <select [ngModel]="specialty()" (ngModelChange)="specialty.set($event)" aria-label="Filter by specialization">
        <option value="">{{allSpecialties()}}</option>
        @for (item of specializations(); track item) { <option [value]="item">{{item}}</option> }
      </select>
      <select [ngModel]="sort()" (ngModelChange)="sort.set($event)" aria-label="Sort trainers">
        <option value="rating">{{i18n.t('Rating')}} ↓</option><option value="experience">{{i18n.t('Experience')}} ↓</option><option value="name">A–Z</option>
      </select>
    </section>

    @if (loading()) {
      <div class="grid grid-3 mt" aria-label="Loading trainers">
        @for (n of [1,2,3,4,5,6]; track n) { <div class="card fs-coach-card"><div class="skeleton" style="height:205px"></div><div class="skeleton" style="height:20px;width:65%;margin-top:20px"></div><div class="skeleton" style="height:14px;width:45%;margin-top:12px"></div></div> }
      </div>
    } @else if (errorLoading()) {
      <div class="card"><p>{{errorTitle()}}</p><button type="button" class="btn btn-primary" (click)="load()">{{retryTitle()}}</button></div>
    } @else {
      <div class="grid grid-3 mt fs-coaches-grid">
        @for (trainer of filtered(); track trainer.trainer_id) {
          <article class="card fs-coach-card">
            <button type="button" class="fs-coach-open" (click)="select(trainer.trainer_id)" [attr.aria-label]="i18n.t('Trainer profile') + ': ' + trainer.full_name">
              <div class="fs-photo">
                @if (trainer.photo) { <img [src]="trainer.photo" [alt]="trainer.full_name" loading="lazy" decoding="async" /> }
                @else { <span class="fs-initials">{{initials(trainer.full_name)}}</span> }
                <span class="fs-rating">★ {{trainer.avg_rating ?? '—'}} <small>({{trainer.reviews_count}})</small></span>
              </div>
              <div class="fs-coach-body">
                <span class="fs-specialization">{{trainer.specialization}}</span>
                <h3>{{trainer.full_name}}</h3>
                <div class="fs-coach-meta"><span>◷ {{trainer.experience_years}} {{i18n.t('years')}}</span><span>↗ {{trainer.working_hours}}</span></div>
              </div>
            </button>
            <div class="fs-coach-actions"><button class="btn btn-primary" type="button" (click)="bookTrainer(trainer)">{{i18n.t('Book now')}} ↗</button>
              <button class="btn" type="button" (click)="select(trainer.trainer_id)">{{i18n.t('Trainer profile')}}</button></div>
          </article>
        } @empty { <div class="card fs-empty"><h3>{{emptyText()}}</h3><button class="btn" type="button" (click)="search.set(''); specialty.set('')">{{resetFilters()}}</button></div> }
      </div>
    }

    @if (profileLoading()) {
      <div class="fs-drawer-backdrop" role="presentation"><section class="card fs-drawer"><div class="skeleton" style="height:240px"></div><div class="skeleton" style="height:30px;margin-top:20px"></div></section></div>
    } @else if (profile(); as trainer) {
      <div class="fs-drawer-backdrop" (click)="close()" (keydown.escape)="close()" tabindex="-1">
        <section class="card fs-drawer" role="dialog" aria-modal="true" [attr.aria-label]="trainer.full_name" (click)="$event.stopPropagation()">
          <div class="row between"><span class="fs-kicker">COACH PROFILE</span><button class="btn btn-sm" type="button" (click)="close()" [attr.aria-label]="i18n.t('Close')">✕</button></div>
          <div class="fs-profile-header">
            @if (trainer.photo) { <img [src]="trainer.photo" [alt]="trainer.full_name" loading="lazy" /> }
            @else { <div class="fs-profile-initials">{{initials(trainer.full_name)}}</div> }
            <div><span class="fs-specialization">{{trainer.specialization}}</span><h2>{{trainer.full_name}}</h2><p>★ {{trainer.avg_rating ?? '—'}} / 5 · {{trainer.reviews_count}} {{i18n.t('Client reviews')}}</p><small>◷ {{trainer.experience_years}} {{i18n.t('years')}} · {{trainer.working_hours}}</small></div>
          </div>
          <p>{{trainer.bio}}</p>
          <h3 class="mt">{{i18n.t('Certificates & Qualifications')}}</h3>
          <div class="fs-certificates">
            @for (cert of trainer.certificates; track cert.id) { <span class="certificate">✧ {{cert.title}} · {{cert.issuer}} · {{cert.year}}</span> }
            @empty { <span class="muted">—</span> }
          </div>
          <h3 class="mt">{{i18n.t('Client reviews')}}</h3>
          @for (review of trainer.reviews ?? []; track review.id) { <div class="review"><b>{{review.member_name}}</b> · ★ {{review.rating}}<p>{{review.comment}}</p></div> }
          @empty { <p>{{i18n.t('No reviews yet')}}</p> }
          <div class="fs-divider"></div>
          <h3>{{i18n.t('Training format')}}</h3>
          <div class="row"><button type="button" class="chip" [class.on]="trainingType() === 'individual'" (click)="setType('individual')">{{i18n.t('Individual (5,000 KZT)')}}</button><button type="button" class="chip" [class.on]="trainingType() === 'group'" (click)="setType('group')">{{i18n.t('Group (2,500 KZT)')}}</button></div>
          <h3 class="mt">{{i18n.t('Choose date')}}</h3>
          <div class="fs-date-row">
            @for (d of dates; track d) { <button type="button" class="fs-day" [class.on]="date()===d" (click)="setDate(d)"><b>{{dayNumber(d)}}</b><small>{{dayShort(d)}}</small></button> }
          </div>
          <h3 class="mt">{{i18n.t('Available slots')}}</h3>
          @if (loadingSlots()) { <div class="skeleton" style="height:54px"></div> }
          @else if (slotsError()) { <button class="btn btn-sm" type="button" (click)="loadSlots()">{{retryTitle()}}</button> }
          @else { <div class="fs-slots">
            @for (slot of slots(); track slot.time) {
              <button class="chip" type="button" [disabled]="!slot.available" (click)="book(trainer,slot)">
                {{slot.time}} @if(trainingType()==='group'){ · {{slot.remaining_spots}} {{i18n.t('Remaining spots')}} }
              </button>
            } @empty { <p>{{i18n.t('No slots on this day.')}}</p> }
          </div> }
        </section>
      </div>
    }
  `,
  styles: `
    .coaches-intro{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:30px 32px;border-radius:22px;background:radial-gradient(circle at right,var(--glow),transparent 60%),var(--surface);border:1px solid var(--border)}.coaches-intro h1{margin-top:10px}.coaches-intro p{margin:0}.coaches-count{font:850 clamp(2rem,5vw,4rem) var(--font-head);color:var(--primary);line-height:1}.coaches-count small{display:block;font:600 .78rem var(--font);color:var(--muted);text-align:center}
    .coaches-tools{display:grid;grid-template-columns:minmax(0,1fr) minmax(140px,220px) minmax(130px,170px);gap:12px;margin-top:23px}.search-box{position:relative}.search-box span{position:absolute;left:13px;top:9px;color:var(--muted);font-size:24px}.search-box input{padding-left:39px}
    .fs-coach-card{padding:0;overflow:hidden;transition:transform .18s,border-color .18s}.fs-coach-card:hover{transform:translateY(-3px);border-color:var(--primary)}.fs-coach-open{width:100%;background:none;border:0;padding:0;cursor:pointer;text-align:left;color:inherit}.fs-photo{height:205px;position:relative;background:var(--surface-2);display:grid;place-items:center;overflow:hidden}.fs-photo img{width:100%;height:100%;object-fit:cover;transition:transform .35s}.fs-coach-card:hover .fs-photo img{transform:scale(1.035)}.fs-initials{font:850 3.2rem var(--font-head);color:var(--primary)}.fs-rating{position:absolute;bottom:12px;right:12px;background:var(--surface);color:var(--text);font-size:.85rem;font-weight:800;border:1px solid var(--border);padding:6px 10px;border-radius:11px}.fs-rating small{font-size:.68rem;color:var(--muted)}.fs-coach-body{padding:20px 19px 10px}.fs-coach-body h3{font-size:1.3rem;margin:5px 0 12px}.fs-specialization{color:var(--primary);font-size:.72rem;font-weight:850;letter-spacing:.11em;text-transform:uppercase}.fs-coach-meta{display:flex;flex-wrap:wrap;gap:10px;font-size:.74rem;color:var(--muted)}.fs-coach-actions{display:flex;gap:8px;padding:12px 19px 20px}.fs-coach-actions .btn{padding:9px 12px;font-size:.75rem}.fs-empty{grid-column:1/-1;text-align:center}
    .fs-drawer-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:120;display:flex;justify-content:flex-end}.fs-drawer{width:min(650px,100vw);height:100%;border-radius:22px 0 0 22px;overflow:auto;padding:28px;overscroll-behavior:contain}.fs-profile-header{display:flex;align-items:center;gap:20px;margin:23px 0}.fs-profile-header img,.fs-profile-initials{height:130px;width:130px;object-fit:cover;border-radius:16px;background:var(--surface-2)}.fs-profile-initials{display:grid;place-items:center;font-size:2rem;color:var(--primary)}.fs-profile-header p{margin:4px 0}.fs-profile-header small{color:var(--muted)}.fs-certificates,.fs-slots,.fs-date-row{display:flex;gap:9px;flex-wrap:wrap}.certificate{display:inline-flex;background:var(--surface-2);border:1px solid var(--border);padding:9px 11px;border-radius:10px;font-size:.76rem}.review{padding:14px 0;border-bottom:1px solid var(--border);font-size:.85rem}.review p{margin:4px 0}.fs-divider{height:1px;background:var(--border);margin:20px 0}.fs-date-row{flex-wrap:nowrap;overflow-x:auto;padding-bottom:8px}.fs-day{display:grid;gap:4px;flex:0 0 64px;place-items:center;padding:10px 5px;border:1px solid var(--border);border-radius:11px;background:var(--surface-2);color:var(--text);cursor:pointer}.fs-day.on{background:var(--primary);color:var(--primary-ink)}.fs-day small{font-size:.7rem}
    @media(max-width:670px){.coaches-intro{padding:20px}.coaches-tools{grid-template-columns:1fr 1fr}.search-box{grid-column:1/-1}.fs-drawer{padding:20px;border-radius:14px 0 0 14px}.fs-profile-header{align-items:flex-start}.fs-profile-header img,.fs-profile-initials{width:94px;height:94px}.fs-coach-actions{flex-wrap:wrap}}
    @media(prefers-reduced-motion:reduce){.fs-coach-card,.fs-photo img{transition:none}}
  `
})
export class TrainersComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private router = inject(Router);
  private toast = inject(ToastService);
  readonly i18n = inject(I18nService);
  readonly trainers = signal<Trainer[]>([]);
  readonly profile = signal<Trainer | null>(null);
  readonly profileLoading = signal(false);
  readonly slots = signal<Slot[]>([]);
  readonly loading = signal(true);
  readonly loadingSlots = signal(false);
  readonly errorLoading = signal(false);
  readonly slotsError = signal(false);
  readonly trainingType = signal<TrainingType>('individual');
  readonly search = signal('');
  readonly specialty = signal('');
  readonly sort = signal<SortMode>('rating');
  readonly specializations = computed(() => [...new Set(this.trainers().map(t => t.specialization).filter(Boolean))].sort());
  readonly filtered = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    const rows = this.trainers().filter(t => (!this.specialty() || t.specialization === this.specialty()) &&
      (!query || [t.full_name,t.specialization,t.bio].join(' ').toLocaleLowerCase().includes(query)));
    if (this.sort()==='experience') rows.sort((a,b)=>b.experience_years-a.experience_years);
    else if (this.sort()==='name') rows.sort((a,b)=>a.full_name.localeCompare(b.full_name));
    else rows.sort((a,b)=>(b.avg_rating??-1)-(a.avg_rating??-1)||b.reviews_count-a.reviews_count);
    return rows;
  });
  readonly dates = Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()+i);return dateCode(d);});
  readonly date = signal(this.dates[0]);
  private slotsSub?: Subscription;
  ngOnInit(){this.load();}
  ngOnDestroy(){this.slotsSub?.unsubscribe();}
  load(){this.loading.set(true);this.errorLoading.set(false);this.api.trainers().subscribe({next:rows=>{this.trainers.set(rows);this.loading.set(false)},error:()=>{this.loading.set(false);this.errorLoading.set(true);this.toast.show(this.i18n.t('Unable to load trainers'),'error')}});}
  initials(name:string){return name.trim().split(/\s+/).map(s=>s[0]??'').slice(0,2).join('').toUpperCase();}
  select(id:string){this.profileLoading.set(true);this.api.trainer(id).subscribe({next:t=>{this.profile.set(t);this.profileLoading.set(false);this.loadSlots()},error:()=>{this.profileLoading.set(false);this.toast.show(this.i18n.t('Trainer not found'),'error')}});}
  close(){this.profile.set(null);this.slotsSub?.unsubscribe();}
  setDate(d:string){this.date.set(d);this.loadSlots();}
  setType(v:TrainingType){this.trainingType.set(v);this.loadSlots();}
  loadSlots(){const t=this.profile();if(!t)return;this.slotsSub?.unsubscribe();this.loadingSlots.set(true);this.slotsError.set(false);this.slots.set([]);
    this.slotsSub=this.api.slots(t.trainer_id,this.date(),this.trainingType()).subscribe({next:r=>{this.slots.set(r.slots);this.loadingSlots.set(false)},error:()=>{this.loadingSlots.set(false);this.slotsError.set(true)}});
  }
  bookTrainer(trainer:Trainer){this.router.navigate(['/book'],{queryParams:{trainer:trainer.trainer_id}});}
  book(trainer:Trainer,slot:Slot){this.close();this.router.navigate(['/book'],{queryParams:{trainer:trainer.trainer_id,date:this.date(),time:slot.time,training_type:this.trainingType()}});}
  dayNumber(d:string){return d.slice(-2);}
  dayShort(d:string){return new Date(`${d}T12:00:00`).toLocaleDateString(this.locale(),{weekday:'short'});}
  locale(){return this.i18n.lang()==='kk'?'kk-KZ':this.i18n.lang()==='ru'?'ru-RU':'en-GB';}
  title(){return this.i18n.lang()==='kk'?'Өзіңе лайық тренерді тап':this.i18n.lang()==='ru'?'Найди своего тренера':'Meet your next coach';}
  subtitle(){return this.i18n.lang()==='kk'?'Нақты пікірлер, сертификаттар және бос уақыттар.':this.i18n.lang()==='ru'?'Реальные отзывы, сертификаты и свободные слоты.':'Explore certified coaches, real reviews and available slots.';}
  searchPlaceholder(){return this.i18n.lang()==='kk'?'Есімі немесе бағыты бойынша іздеу':this.i18n.lang()==='ru'?'Поиск по имени или направлению':'Search by name or specialty';}
  allSpecialties(){return this.i18n.lang()==='kk'?'Барлық бағыттар':this.i18n.lang()==='ru'?'Все направления':'All specialties';}
  errorTitle(){return this.i18n.lang()==='kk'?'Жаттықтырушылар жүктелмеді':this.i18n.lang()==='ru'?'Не удалось загрузить тренеров':'Could not load trainers';}
  emptyText(){return this.i18n.lang()==='kk'?'Сәйкес тренер табылмады':this.i18n.lang()==='ru'?'Ничего не найдено':'No matching trainers';}
  resetFilters(){return this.i18n.lang()==='kk'?'Сүзгіні тазалау':this.i18n.lang()==='ru'?'Сбросить фильтры':'Clear filters';}
  retryTitle(){return this.i18n.lang()==='kk'?'Қайталау':this.i18n.lang()==='ru'?'Повторить':'Retry';}
}
