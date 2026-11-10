import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { ApiError, Booking, Member, MembershipStatus, Summary, Trainer } from '../core/models';
import { ToastService } from '../core/toast.service';

type Tab = 'bookings' | 'members' | 'busiest';

@Component({
  selector: 'app-admin',
  imports: [FormsModule, DatePipe],
  template: `
  <h2>Admin dashboard</h2>
  @if (summary(); as s) {
    <div class="grid grid-4">
      <div class="card"><p>Bookings today</p><h1 class="accent">{{ s.bookings_today }}</h1></div>
      <div class="card"><p>Active members</p><h1>{{ s.active_members }}</h1></div>
      <div class="card"><p>Revenue this month</p><h1>{{ s.revenue_month_kzt }} <small class="muted">KZT</small></h1></div>
      <div class="card"><p>Cancellation rate</p><h1>{{ s.cancellation_rate }}%</h1></div>
    </div>
  }
  <div class="row mt">
    @for (t of tabs; track t) { <button class="chip" [class.on]="tab() === t" (click)="tab.set(t)">{{ labels[t] }}</button> }
  </div>

  @if (tab() === 'bookings') {
    <div class="card mt">
      <div class="row">
        <select style="width:auto" [(ngModel)]="fTrainer" (ngModelChange)="loadBookings()">
          <option value="">All trainers</option>
          @for (t of trainers(); track t.trainer_id) { <option [value]="t.trainer_id">{{ t.full_name }}</option> }
        </select>
        <select style="width:auto" [(ngModel)]="fStatus" (ngModelChange)="loadBookings()">
          <option value="">All statuses</option><option>Confirmed</option><option>Completed</option><option>Cancelled</option>
        </select>
        <span class="muted">{{ bookings().length }} bookings</span>
      </div>
      <div class="table-wrap mt-s"><table>
        <tr><th>ID</th><th>Member</th><th>Trainer</th><th>Time</th><th>Status</th><th>Payment</th></tr>
        @for (b of bookings(); track b.booking_id) {
          <tr><td>{{ b.booking_id }}</td><td>{{ b.member_name }}</td><td>{{ b.trainer_name }}</td>
            <td>{{ b.session_start | date: 'd MMM, HH:mm' }}</td>
            <td><span class="badge b-{{ b.status }}">{{ b.status }}</span></td>
            <td><span class="badge b-{{ b.payment_status }}">{{ b.payment_status }}</span></td></tr>
        }
      </table></div>
    </div>
  }

  @if (tab() === 'members') {
    <div class="card mt"><div class="table-wrap"><table>
      <tr><th>ID</th><th>Name</th><th>Phone</th><th>Valid until</th><th>Status</th></tr>
      @for (m of members(); track m.member_id) {
        <tr><td>{{ m.member_id }}</td><td>{{ m.full_name }}</td><td>{{ m.phone }}</td><td>{{ m.membership_end_date }}</td>
          <td><select style="width:auto" [ngModel]="m.membership_status" (ngModelChange)="setStatus(m, $event)">
            <option>Active</option><option>Frozen</option><option>Expired</option></select></td></tr>
      }
    </table></div></div>
  }

  @if (tab() === 'busiest') {
    <div class="card mt"><h3>Busiest trainers this month</h3>
      @for (b of summary()?.busiest_trainers ?? []; track b.trainer_id) {
        <div class="row mt-s"><span style="width:160px">{{ b.trainer_name }}</span>
          <div class="bar"><div class="fill" [style.width.%]="b.total_bookings / max() * 100"></div></div><b>{{ b.total_bookings }}</b></div>
      } @empty { <p>No confirmed bookings this month.</p> }
    </div>
  }`,
  styles: `.bar{flex:1;height:14px;background:var(--surface-2);border-radius:99px;overflow:hidden;min-width:120px}
  .fill{height:100%;background:linear-gradient(90deg,var(--indigo),var(--primary));border-radius:99px}`
})
export class AdminComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  tabs: Tab[] = ['bookings', 'members', 'busiest'];
  labels: Record<Tab, string> = { bookings: 'Bookings', members: 'Members', busiest: 'Busiest trainers' };
  tab = signal<Tab>('bookings');
  summary = signal<Summary | null>(null);
  bookings = signal<Booking[]>([]);
  members = signal<Member[]>([]);
  trainers = signal<Trainer[]>([]);
  fTrainer = ''; fStatus = '';
  max = computed(() => Math.max(1, ...(this.summary()?.busiest_trainers.map(b => b.total_bookings) ?? [1])));

  ngOnInit() {
    this.api.adminSummary().subscribe(s => this.summary.set(s));
    this.api.trainers().subscribe(t => this.trainers.set(t));
    this.api.adminMembers().subscribe(m => this.members.set(m));
    this.loadBookings();
  }

  loadBookings() {
    this.api.adminBookings({ trainer: this.fTrainer, status: this.fStatus }).subscribe(b => this.bookings.set(b));
  }

  setStatus(m: Member, status: MembershipStatus) {
    this.api.setMemberStatus(m.member_id, status).subscribe({
      next: updated => {
        this.members.update(list => list.map(x => (x.member_id === updated.member_id ? updated : x)));
        this.toast.show(`${updated.full_name} is now ${updated.membership_status}`, 'success');
        this.api.adminSummary().subscribe(s => this.summary.set(s));
      },
      error: (e: HttpErrorResponse) => this.toast.show((e.error as ApiError)?.message ?? 'Could not update', 'error')
    });
  }
}
