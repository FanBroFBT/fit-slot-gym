import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { Trainer, TrainerReviews } from '../core/models';
import { StarsComponent } from '../core/stars';

@Component({
  selector: 'app-trainers',
  imports: [FormsModule, DatePipe, StarsComponent],
  template: `
  <div class="row between" style="flex-wrap: wrap; gap: 12px;">
    <div>
      <h2>Our trainers</h2>
      <p class="muted">Explore trainer profiles, ratings, schedules, and member reviews.</p>
    </div>
    <input
      style="max-width: 260px;"
      type="search"
      placeholder="Search trainer or specialty..."
      [ngModel]="query()"
      (ngModelChange)="query.set($event)"
    />
  </div>

  <!-- Мамандық бойынша сүзгі -->
  <div class="row mt-s" style="flex-wrap: wrap;">
    <button class="chip" [class.on]="spec() === 'ALL'" (click)="spec.set('ALL')">
      All ({{ trainers().length }})
    </button>
    @for (s of specializations(); track s) {
      <button class="chip" [class.on]="spec() === s" (click)="spec.set(s)">{{ s }}</button>
    }
  </div>

  @if (loading()) {
    <div class="grid grid-3 mt">
      <div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>
    </div>
  } @else {
    <div class="grid grid-3 mt">
      @for (t of filtered(); track t.trainer_id) {
        <div class="card trainer-card">
          <div class="img-box">
            @if (t.photo && !failed().has(t.trainer_id)) {
              <img [src]="t.photo" [alt]="t.full_name" loading="lazy" referrerpolicy="no-referrer" (error)="photoFailed(t)" />
            } @else {
              <div class="photo-fallback">{{ initials(t.full_name) }}</div>
            }
            <span class="spec-pill">{{ t.specialization }}</span>
          </div>

          <div class="card-body">
            <h3 style="margin: 0 0 6px;">{{ t.full_name }}</h3>
            <div class="row" style="gap: 6px; font-size: .88rem;">
              @if (t.reviews_count) {
                <app-stars [value]="t.avg_rating" />
                <b>{{ t.avg_rating }}</b>
                <span class="muted">({{ t.reviews_count }})</span>
              } @else {
                <span class="muted">No reviews yet</span>
              }
            </div>

            <div class="meta mt-s">
              <p>🕒 {{ t.working_hours || '09:00 – 21:00' }}</p>
              <p>📞 {{ t.phone || '—' }}</p>
            </div>

            <div class="row mt" style="gap: 8px; margin-top: auto;">
              <button class="btn" style="flex: 1;" (click)="openProfile(t)">View profile</button>
              <button class="btn btn-primary" style="flex: 1;" (click)="bookWith(t)">Book</button>
            </div>
          </div>
        </div>
      } @empty {
        <div class="card muted">No trainers match your filter.</div>
      }
    </div>
  }

  <!-- Тренердің толық профилі мен пікірлері модалы -->
  @if (selected(); as tr) {
    <div class="backdrop" (click)="selected.set(null)">
      <div class="card modal-box" (click)="$event.stopPropagation()">
        @if (tr.photo && !failed().has(tr.trainer_id)) {
          <img [src]="tr.photo" [alt]="tr.full_name" referrerpolicy="no-referrer" (error)="photoFailed(tr)" class="modal-cover" />
        } @else {
          <div class="photo-fallback modal-cover">{{ initials(tr.full_name) }}</div>
        }

        <div class="row between" style="align-items: flex-start;">
          <div>
            <h2 style="margin: 0;">{{ tr.full_name }}</h2>
            <span class="badge b-Active" style="display: inline-block; margin-top: 6px;">{{ tr.specialization }}</span>
          </div>
          <button class="btn btn-sm" (click)="selected.set(null)">✕</button>
        </div>

        <div class="meta mt-s">
          <p><b>Working hours:</b> {{ tr.working_hours || '09:00 – 21:00' }}</p>
          <p><b>Phone:</b> {{ tr.phone || '—' }}</p>
          <p>
            <b>Rating:</b>
            @if (reviews(); as rv) {
              @if (rv.reviews_count) {
                <app-stars [value]="rv.avg_rating" /> {{ rv.avg_rating }} / 5 ({{ rv.reviews_count }} reviews)
              } @else {
                <span class="muted">No reviews yet</span>
              }
            }
          </p>
        </div>

        <h3 class="mt">Member reviews</h3>
        @if (loadingReviews()) {
          <p class="muted">Loading reviews…</p>
        } @else if (reviews(); as rv) {
          @if (rv.reviews.length) {
            <div class="reviews-list">
              @for (item of rv.reviews; track item.id) {
                <div class="review-card">
                  <div class="row between">
                    <b>{{ item.member_name }}</b>
                    <app-stars [value]="item.rating" />
                  </div>
                  @if (item.comment) {
                    <p style="margin: 6px 0 2px;">{{ item.comment }}</p>
                  }
                  <span class="muted" style="font-size: .75rem;">{{ item.created_at | date: 'd MMM y' }}</span>
                </div>
              }
            </div>
          } @else {
            <p class="muted">No reviews yet. Book a session and leave the first review!</p>
          }
        }

        <div class="row mt" style="justify-content: flex-end; gap: 10px;">
          <button class="btn" (click)="selected.set(null)">Close</button>
          <button class="btn btn-primary" (click)="bookWith(tr)">Book session</button>
        </div>
      </div>
    </div>
  }`,
  styles: `
    .trainer-card { padding: 0; overflow: hidden; display: flex; flex-direction: column; }
    .img-box { position: relative; width: 100%; height: 210px; overflow: hidden; }
    .img-box img { width: 100%; height: 100%; object-fit: cover; }
    .spec-pill {
      position: absolute; top: 12px; left: 12px; padding: 4px 10px; border-radius: 99px;
      background: rgba(15, 23, 42, .85); color: #38bdf8; font-size: .75rem; font-weight: 700;
    }
    .photo-fallback {
      width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
      font-size: 2.6rem; font-weight: 800; color: #0f172a;
      background: linear-gradient(135deg, #a3e635, #38bdf8);
    }
    .card-body { padding: 16px 18px 18px; display: flex; flex-direction: column; flex: 1; }
    .meta p { margin: 4px 0; font-size: .88rem; }
    .backdrop {
      position: fixed; inset: 0; background: rgba(0, 0, 0, .72); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 1000;
    }
    .modal-box { width: 480px; max-width: 95%; max-height: 88vh; overflow-y: auto; }
    .modal-cover { width: 100%; height: 210px; object-fit: cover; border-radius: 10px; margin-bottom: 14px; }
    .reviews-list { display: grid; gap: 8px; max-height: 220px; overflow-y: auto; margin-top: 8px; }
    .review-card { padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; font-size: .9rem; }
  `
})
export class TrainersComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  trainers = signal<Trainer[]>([]);
  loading = signal(true);
  spec = signal('ALL');
  query = signal('');
  failed = signal<Set<string>>(new Set());

  selected = signal<Trainer | null>(null);
  reviews = signal<TrainerReviews | null>(null);
  loadingReviews = signal(false);

  specializations = computed(() =>
    Array.from(new Set(this.trainers().map(t => t.specialization).filter(Boolean)))
  );

  filtered = computed(() => {
    const s = this.spec();
    const q = this.query().trim().toLowerCase();
    return this.trainers().filter(t => {
      const matchSpec = s === 'ALL' || t.specialization === s;
      const matchQuery =
        !q ||
        t.full_name.toLowerCase().includes(q) ||
        t.specialization.toLowerCase().includes(q);
      return matchSpec && matchQuery;
    });
  });

  ngOnInit() {
    this.api.trainers().subscribe({
      next: list => {
        this.trainers.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  initials(name: string): string {
    return (name || 'T').split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase();
  }

  photoFailed(t: Trainer) {
    this.failed.update(set => new Set(set).add(t.trainer_id));
  }

  openProfile(t: Trainer) {
    this.selected.set(t);
    this.reviews.set(null);
    this.loadingReviews.set(true);
    this.api.trainerReviews(t.trainer_id).subscribe({
      next: r => {
        this.reviews.set(r);
        this.loadingReviews.set(false);
      },
      error: () => this.loadingReviews.set(false),
    });
  }

  bookWith(t: Trainer) {
    this.selected.set(null);
    this.router.navigate(['/book'], { queryParams: { trainer: t.trainer_id } });
  }
}