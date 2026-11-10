import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { StarsComponent } from '../core/stars';
import { ApiService } from '../core/api.service';
import { ApiError, Booking } from '../core/models';
import { ToastService } from '../core/toast.service';
import { AuthService } from '../core/auth.service';

type Tab = 'upcoming' | 'past' | 'cancelled';

@Component({
  selector: 'app-my-bookings',
  imports: [DatePipe, RouterLink, FormsModule, StarsComponent],
  template: `
  <div class="row between">
    <h2>My bookings</h2>
    <a class="btn btn-primary" routerLink="/book">+ New booking</a>
  </div>

  <div class="row mt-s" style="margin-top: 24px;">
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
            <p style="font-size:.85rem; color: #94a3b8;">Booking ID: {{ b.booking_id }} · {{ b.amount_kzt }} KZT <span class="badge b-{{ b.payment_status }}">{{ b.payment_status }}</span></p>
          </div>
          @if (b.status === 'Confirmed') {
            <button class="btn btn-danger" [disabled]="!b.can_cancel" (click)="cancel(b)"
              [title]="b.can_cancel ? '' : 'Cancel at least 2 hours before the session'">Cancel</button>
          }
        </div>

        @if (b.review; as r) {
          <div class="my-review"><app-stars [value]="r.rating" /> <span class="muted">Your review</span>
            @if (r.comment) { <p style="margin:4px 0 0">{{ r.comment }}</p> }</div>
        } @else if (b.can_review) {
          <div class="row between my-review"><span>How was your session?</span>
            <button class="btn btn-primary btn-sm" (click)="openReview(b)">★ Rate trainer</button></div>
        }

        <!-- Егер бронь расталған (Confirmed) болса, сол сеансқа арналған жеке QR-код шығады -->
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
  styles: `.my-review{padding:10px 12px;border-radius:8px;border:1px solid var(--border);font-size:.9rem}
    .backdrop{position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:1000}
    .dialog{width:420px;max-width:92%}
    textarea{font:inherit;width:100%;padding:11px 14px;border-radius:12px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);resize:vertical}`
})
export class MyBookingsComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected auth = inject(AuthService);

  tabs: Tab[] = ['upcoming', 'past', 'cancelled'];
  tab = signal<Tab>('upcoming');
  all = signal<Booking[]>([]);
  loaded = signal(false);
  reviewing = signal<Booking | null>(null);
  sending = signal(false);
  stars = 0; comment = '';
  shown = computed(() => this.filter(this.tab()));

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

  cancel(b: Booking) {
    this.api.cancelBooking(b.booking_id).subscribe({
      next: () => { this.toast.show('Booking cancelled', 'success'); this.load(); },
      error: (e: HttpErrorResponse) => this.toast.show((e.error as ApiError)?.message ?? 'Could not cancel', 'error')
    });
  }
}