import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { I18nService } from '../core/i18n.service';
import { Slot, Trainer, TrainingType } from '../core/models';
import { ToastService } from '../core/toast.service';
const dateCode = (day: Date) => `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
@Component({
  selector: 'app-trainers',
  imports: [FormsModule],
  template: `
    <h2>{{i18n.t('Trainers')}}</h2>
    <div class="grid grid-3 mt">
      @for (trainer of trainers(); track trainer.trainer_id) {
        <button class="card trainer-card" type="button" (click)="select(trainer.trainer_id)">
          @if (trainer.photo) { <img class="avatar" [src]="trainer.photo" [alt]="trainer.full_name"> }
          @else { <div class="initials">{{initials(trainer.full_name)}}</div> }
          <h3>{{trainer.full_name}}</h3><p>{{trainer.specialization}}</p>
          <p>⭐ {{trainer.avg_rating ?? '—'}} ({{trainer.reviews_count}}) · {{trainer.experience_years}} {{i18n.t('years')}}</p>
          <span class="btn btn-primary">{{i18n.t('Trainer profile')}}</span>
        </button>
      } @empty { <p>{{i18n.t('Loading…')}}</p> }
    </div>
    @if (profile(); as trainer) {
      <div class="drawer-backdrop" (click)="profile.set(null)">
        <section class="card drawer" (click)="$event.stopPropagation()" aria-label="Trainer profile">
          <div class="row between"><h2>{{trainer.full_name}}</h2><button class="btn btn-sm" (click)="profile.set(null)">✕</button></div>
          @if (trainer.photo) { <img class="hero-image" [src]="trainer.photo" [alt]="trainer.full_name"> }
          <p><b>{{i18n.t('Specialization')}}:</b> {{trainer.specialization}}</p>
          <p><b>{{i18n.t('Experience')}}:</b> {{trainer.experience_years}} {{i18n.t('years')}}</p>
          <p><b>{{i18n.t('Working hours')}}:</b> {{trainer.working_hours}}</p>
          <p>{{trainer.bio}}</p>
          <h3>⭐ {{i18n.t('Rating')}}: {{trainer.avg_rating ?? '—'}} / 5</h3>
          <div class="row rating-row">
            @for (star of stars; track star) {
              <small>{{star}}★: {{trainer.rating_breakdown[star]}}</small>
            }
          </div>
          <h3 class="mt">{{i18n.t('Certificates & Qualifications')}}</h3>
          <div class="row">
            @for (cert of trainer.certificates; track cert.id) {
              <span class="certificate">🏅 {{cert.title}} · {{cert.issuer}} ({{cert.year}}) @if(cert.credential_id){ · {{cert.credential_id}} }</span>
            } @empty { <p class="muted">—</p> }
          </div>
          <h3 class="mt">{{i18n.t('Client reviews')}}</h3>
          @for (review of trainer.reviews ?? []; track review.id) {
            <div class="review"><b>{{review.member_name}}</b> · <span>⭐ {{review.rating}}/5</span><p>{{review.comment}}</p></div>
          } @empty { <p>{{i18n.t('No reviews yet')}}</p> }
          <h3 class="mt">{{i18n.t('Choose date')}}</h3>
          <input type="date" [(ngModel)]="date" [min]="dates[0]" [max]="dates[dates.length-1]" (ngModelChange)="loadSlots()" />
          <h3 class="mt">{{i18n.t('Training format')}}</h3>
          <div class="row">
            <button class="chip" [class.on]="trainingType() === 'individual'" (click)="setType('individual')">{{i18n.t('Individual (5,000 KZT)')}}</button>
            <button class="chip" [class.on]="trainingType() === 'group'" (click)="setType('group')">{{i18n.t('Group (2,500 KZT)')}}</button>
          </div>
          <h3 class="mt">{{i18n.t('Available slots')}}</h3>
          <div class="row">
            @for (slot of slots(); track slot.time) {
              <button class="chip" [disabled]="!slot.available" (click)="book(trainer,slot)">
                {{slot.time}} @if(trainingType()==='group'){ ({{slot.spots_taken}}/{{slot.max_capacity}}) }
              </button>
            } @empty { <p>{{i18n.t('No slots on this day.')}}</p> }
          </div>
        </section>
      </div>
    }`,
  styles: `
    .trainer-card{text-align:left;cursor:pointer;color:var(--text);width:100%}.trainer-card .btn{display:inline-block}
    .avatar,.initials{width:100%;height:155px;object-fit:cover;border-radius:12px;margin-bottom:16px}
    .initials{display:grid;place-items:center;background:var(--surface-2);font-size:44px;font-weight:800;color:var(--primary)}
    .drawer-backdrop{position:fixed;inset:0;background:#000a;z-index:100;display:flex;justify-content:flex-end}
    .drawer{width:min(640px,100vw);border-radius:16px 0 0 16px;overflow:auto}.hero-image{width:100%;max-height:200px;object-fit:cover;border-radius:10px}
    .certificate{border:1px solid var(--border);padding:8px 10px;border-radius:8px;background:var(--surface-2);font-size:12px}
    .review{padding:12px 0;border-bottom:1px solid var(--border)}.rating-row{color:var(--muted)}
  `
})
export class TrainersComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private toast = inject(ToastService);
  i18n = inject(I18nService);
  trainers = signal<Trainer[]>([]);
  profile = signal<Trainer | null>(null);
  slots = signal<Slot[]>([]);
  trainingType = signal<TrainingType>('individual');
  stars = [5,4,3,2,1];
  dates = Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()+i);return dateCode(d);});
  date = this.dates[0];
  ngOnInit() { this.api.trainers().subscribe({next: rows => this.trainers.set(rows), error:()=>this.toast.show(this.i18n.t('Unable to load trainers'),'error')}); }
  initials(name: string) { return name.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase(); }
  select(id: string) {
    this.api.trainer(id).subscribe({ next: trainer => {this.profile.set(trainer); this.loadSlots();}, error:()=>this.toast.show(this.i18n.t('Trainer not found'),'error') });
  }
  setType(value:TrainingType) { this.trainingType.set(value); this.loadSlots(); }
  loadSlots() {
    const trainer = this.profile();
    if (!trainer || !this.date) return;
    this.api.slots(trainer.trainer_id,this.date,this.trainingType()).subscribe({ next: r => this.slots.set(r.slots), error:()=>this.slots.set([]) });
  }
  book(trainer: Trainer, slot: Slot) {
    this.router.navigate(['/book'], {queryParams:{trainer:trainer.trainer_id,date:this.date,time:slot.time,training_type:this.trainingType()}});
  }
}
