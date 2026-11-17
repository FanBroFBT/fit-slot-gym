import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { ApiError, Plan, Wallet } from '../core/models';
import { ToastService } from '../core/toast.service';
import { I18nService } from '../core/i18n.service';

@Component({
  selector: 'app-wallet',
  imports: [FormsModule, DatePipe],
  template: `
  <h2>{{ i18n.t('WALLET_TITLE') }}</h2>
  <p>{{ i18n.t('WALLET_SUBTITLE') }}</p>

  @if (w(); as wl) {
    <div class="grid grid-4">
      <div class="card"><p>{{ i18n.t('WALLET_BALANCE') }}</p><h1 class="accent">{{ wl.balance_kzt }} <small class="muted">KZT</small></h1></div>
      <div class="card"><p>{{ i18n.t('WALLET_SUBSCRIPTION') }}</p>
        @if (wl.has_subscription) {
          <h3 style="margin-top:10px"><span class="badge b-Active">{{ i18n.t('STATUS_ACTIVE') }}</span></h3>
          <p class="mt-s">{{ i18n.t('WALLET_FREE_UNTIL') }} {{ wl.subscription_until | date: 'd MMMM y' }}</p>
        } @else { <h3 style="margin-top:10px"><span class="badge b-Expired">{{ i18n.t('STATUS_EXPIRED') }}</span></h3><p class="mt-s">{{ i18n.t('WALLET_PAY_PER_SESSION') }} {{ wl.session_price_kzt }} KZT</p> }
      </div>
    </div>

    <div class="grid two mt">
      <div class="card">
        <h3>{{ i18n.t('TOP_UP_TITLE') }}</h3>
        <div class="row mt-s">
          @for (a of amounts; track a) { <button class="chip" [class.on]="amount === a" (click)="amount = a">{{ a }}</button> }
        </div>
        <label for="amt">{{ i18n.t('OTHER_AMOUNT') }}</label>
        <input id="amt" type="number" min="1000" step="500" [(ngModel)]="amount" />
        <label for="pm">{{ i18n.t('PAYMENT_METHOD') }}</label>
        <select id="pm" [(ngModel)]="method">
          <option value="Card">{{ i18n.t('PAY_CARD') }}</option>
          <option value="Kaspi">Kaspi</option>
        </select>
        <button class="btn btn-primary mt" [disabled]="busy()" (click)="topUp()">{{ i18n.t('BTN_TOP_UP') }}</button>
      </div>

      <div class="card">
        <h3>{{ i18n.t('BUY_SUB_TITLE') }}</h3>
        <p>{{ i18n.t('BUY_SUB_DESC') }}</p>
        @for (p of wl.plans; track p.key) {
          <div class="row between plan">
            <div><b>{{ p.name }}</b><br><span class="muted">{{ p.days }} {{ i18n.t('PLAN_DAYS_DESC') }}</span></div>
            <button class="btn" [disabled]="busy() || wl.balance_kzt < p.price_kzt" (click)="buy(p)">{{ p.price_kzt }} KZT</button>
          </div>
        }
        @if (wl.plans.length && wl.balance_kzt < wl.plans[0].price_kzt) { <p class="mt-s">{{ i18n.t('TOP_UP_TO_BUY_HINT') }}</p> }
      </div>
    </div>

    <div class="card mt">
      <h3>{{ i18n.t('TX_HISTORY_TITLE') }}</h3>
      <div class="table-wrap"><table>
        <tr><th>{{ i18n.t('TH_DATE') }}</th><th>{{ i18n.t('TH_DESC') }}</th><th>{{ i18n.t('TH_AMOUNT') }}</th><th>{{ i18n.t('TH_BALANCE_AFTER') }}</th></tr>
        @for (t of wl.transactions; track t.id) {
          <tr><td>{{ t.created_at | date: 'd MMM, HH:mm' }}</td><td>{{ t.description }}</td>
            <td [class.accent]="+t.amount_kzt > 0" [style.color]="+t.amount_kzt < 0 ? 'var(--danger)' : null"><b>{{ +t.amount_kzt > 0 ? '+' : '' }}{{ t.amount_kzt }}</b></td>
            <td>{{ t.balance_after }}</td></tr>
        } @empty { <tr><td colspan="4" class="muted">{{ i18n.t('NO_TRANSACTIONS') }}</td></tr> }
      </table></div>
    </div>
  } @else { <div class="skeleton"></div> }`,
  styles: `.two{grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
    .plan{padding:12px 0;border-top:1px solid var(--border)}`
})
export class WalletComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  readonly i18n = inject(I18nService);

  w = signal<Wallet | null>(null);
  busy = signal(false);
  amounts = [5000, 10000, 25000, 50000];
  amount = 10000; method = 'Card';

  ngOnInit() { this.api.wallet().subscribe(w => this.w.set(w)); }

  private done(msg: string) {
    return {
      next: (w: Wallet) => { this.w.set(w); this.busy.set(false); this.toast.show(msg, 'success'); },
      error: (e: HttpErrorResponse) => { this.busy.set(false); this.toast.show((e.error as ApiError)?.message ?? this.i18n.t('ERR_REQUEST_FAILED'), 'error'); }
    };
  }
  topUp() { this.busy.set(true); this.api.topUp(Number(this.amount), this.method).subscribe(this.done(this.i18n.t('TOAST_TOPPED_UP'))); }
  buy(p: Plan) { this.busy.set(true); this.api.subscribe(p.key).subscribe(this.done(`${this.i18n.t('TOAST_SUB_ACTIVATED')} "${p.name}"`)); }
}