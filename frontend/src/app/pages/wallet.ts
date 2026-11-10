import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { ApiError, Plan, Wallet } from '../core/models';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-wallet',
  imports: [FormsModule, DatePipe],
  template: `
  <h2>Wallet & membership</h2>
  <p>Top up once and pay for sessions from your balance, or buy a subscription and book for free.</p>

  @if (w(); as wl) {
    <div class="grid grid-4">
      <div class="card"><p>Balance</p><h1 class="accent">{{ wl.balance_kzt }} <small class="muted">KZT</small></h1></div>
      <div class="card"><p>Subscription</p>
        @if (wl.has_subscription) {
          <h3 style="margin-top:10px"><span class="badge b-Active">Active</span></h3>
          <p class="mt-s">Free sessions until {{ wl.subscription_until | date: 'd MMMM y' }}</p>
        } @else { <h3 style="margin-top:10px"><span class="badge b-Expired">None</span></h3><p class="mt-s">Pay per session: {{ wl.session_price_kzt }} KZT</p> }
      </div>
    </div>

    <div class="grid two mt">
      <div class="card">
        <h3>Top up balance</h3>
        <div class="row mt-s">
          @for (a of amounts; track a) { <button class="chip" [class.on]="amount === a" (click)="amount = a">{{ a }}</button> }
        </div>
        <label for="amt">Other amount (KZT)</label>
        <input id="amt" type="number" min="1000" step="500" [(ngModel)]="amount" />
        <label for="pm">Payment method</label>
        <select id="pm" [(ngModel)]="method"><option>Card</option><option>Kaspi</option></select>
        <button class="btn btn-primary mt" [disabled]="busy()" (click)="topUp()">Top up</button>
      </div>

      <div class="card">
        <h3>Buy a subscription</h3>
        <p>Paid from your balance. If you already have one, days are added to it.</p>
        @for (p of wl.plans; track p.key) {
          <div class="row between plan">
            <div><b>{{ p.name }}</b><br><span class="muted">{{ p.days }} days · unlimited free sessions</span></div>
            <button class="btn" [disabled]="busy() || wl.balance_kzt < p.price_kzt" (click)="buy(p)">{{ p.price_kzt }} KZT</button>
          </div>
        }
        @if (wl.plans.length && wl.balance_kzt < wl.plans[0].price_kzt) { <p class="mt-s">Top up your balance to buy a plan.</p> }
      </div>
    </div>

    <div class="card mt">
      <h3>Transaction history</h3>
      <div class="table-wrap"><table>
        <tr><th>Date</th><th>Description</th><th>Amount</th><th>Balance after</th></tr>
        @for (t of wl.transactions; track t.id) {
          <tr><td>{{ t.created_at | date: 'd MMM, HH:mm' }}</td><td>{{ t.description }}</td>
            <td [class.accent]="+t.amount_kzt > 0" [style.color]="+t.amount_kzt < 0 ? 'var(--danger)' : null"><b>{{ +t.amount_kzt > 0 ? '+' : '' }}{{ t.amount_kzt }}</b></td>
            <td>{{ t.balance_after }}</td></tr>
        } @empty { <tr><td colspan="4" class="muted">No transactions yet.</td></tr> }
      </table></div>
    </div>
  } @else { <div class="skeleton"></div> }`,
  styles: `.two{grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
    .plan{padding:12px 0;border-top:1px solid var(--border)}`
})
export class WalletComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  w = signal<Wallet | null>(null);
  busy = signal(false);
  amounts = [5000, 10000, 25000, 50000];
  amount = 10000; method = 'Card';

  ngOnInit() { this.api.wallet().subscribe(w => this.w.set(w)); }

  private done(msg: string) {
    return {
      next: (w: Wallet) => { this.w.set(w); this.busy.set(false); this.toast.show(msg, 'success'); },
      error: (e: HttpErrorResponse) => { this.busy.set(false); this.toast.show((e.error as ApiError)?.message ?? 'Request failed', 'error'); }
    };
  }
  topUp() { this.busy.set(true); this.api.topUp(Number(this.amount), this.method).subscribe(this.done('Balance topped up')); }
  buy(p: Plan) { this.busy.set(true); this.api.subscribe(p.key).subscribe(this.done(`Subscription "${p.name}" activated`)); }
}
