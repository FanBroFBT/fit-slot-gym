import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { I18nService } from '../core/i18n.service';
import { ApiError, Wallet } from '../core/models';
import { ToastService } from '../core/toast.service';
@Component({
  selector: 'app-wallet', imports: [FormsModule, DatePipe, DecimalPipe],
  template: `
    <h2>{{i18n.t('Wallet & Subscriptions')}}</h2>
    @if(data();as wallet) {
      <div class="grid grid-3 mt">
        <div class="card"><p>{{i18n.t('Wallet balance')}}</p><h1 class="accent">{{wallet.balance_kzt | number:'1.0-2'}} ₸</h1></div>
        <div class="card"><p>{{i18n.t('Subscription')}}</p>
          <h3>{{wallet.has_subscription ? i18n.t('Active subscription') : i18n.t('No active subscription')}}</h3>
          @if(wallet.subscription_until){ <p>{{wallet.subscription_until | date:'mediumDate'}}</p> }
        </div>
        <div class="card"><p>{{i18n.t('Individual session')}}</p><h2>{{wallet.session_price_kzt | number:'1.0-0'}} ₸</h2></div>
      </div>
      <div class="grid grid-3 mt">
        <div class="card"><h3>{{i18n.t('Top up wallet')}}</h3>
          <label>{{i18n.t('Amount KZT')}}</label><input type="number" [(ngModel)]="amount" min="1000" max="500000" step="500" />
          <label>{{i18n.t('Payment method')}}</label>
          <select [(ngModel)]="method"><option>Card</option><option>Kaspi</option><option>Cash</option></select>
          <button class="btn btn-primary mt-s" [disabled]="busy() || amount < 1000" (click)="topUp()">{{i18n.t('Top up')}}</button>
        </div>
        @for(plan of wallet.plans;track plan.key) {
          <div class="card"><h3>{{plan.name}}</h3><p>{{plan.days}} {{i18n.t('days')}}</p>
            <h2>{{plan.price_kzt | number:'1.0-0'}} ₸</h2>
            <button class="btn btn-primary" [disabled]="busy() || wallet.balance_kzt < plan.price_kzt" (click)="subscribe(plan.key)">{{i18n.t('Subscribe')}}</button>
          </div>
        }
      </div>
      <div class="card mt"><h3>{{i18n.t('Transactions')}}</h3>
        <div class="table-wrap"><table><thead><tr><th>{{i18n.t('Date')}}</th><th>{{i18n.t('Type')}}</th><th>{{i18n.t('Description')}}</th><th>KZT</th></tr></thead>
        <tbody>@for(item of wallet.transactions;track item.id) {<tr>
          <td>{{item.created_at | date:'d MMM, HH:mm'}}</td><td>{{item.kind}}</td><td>{{item.description}}</td>
          <td [style.color]="+item.amount_kzt >= 0 ? 'var(--ok)' : 'var(--danger)'">{{item.amount_kzt}}</td>
        </tr>} @empty {<tr><td colspan="4">—</td></tr>}</tbody></table></div>
      </div>
    } @else { <p>{{i18n.t('Loading…')}}</p> }
  `
})
export class WalletComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  i18n = inject(I18nService);
  data = signal<Wallet|null>(null);
  busy = signal(false);
  amount = 5000;
  method = 'Card';
  ngOnInit(){this.load();}
  load(){this.api.wallet().subscribe({next:r=>this.data.set(r),error:()=>this.toast.show(this.i18n.t('Cannot load wallet'),'error')});}
  topUp(){
    if(this.busy())return;
    this.busy.set(true);
    this.api.topUp(this.amount,this.method).subscribe({next:r=>{this.data.set(r);this.busy.set(false);this.toast.show(this.i18n.t('Wallet updated'),'success');},error:(e:HttpErrorResponse)=>this.fail(e)});
  }
  subscribe(plan:string){
    if(this.busy())return;
    this.busy.set(true);
    this.api.subscribe(plan).subscribe({next:r=>{this.data.set(r);this.busy.set(false);this.toast.show(this.i18n.t('Subscription updated'),'success');},error:(e:HttpErrorResponse)=>this.fail(e)});
  }
  private fail(e:HttpErrorResponse){this.busy.set(false);this.toast.show((e.error as ApiError)?.message ?? this.i18n.t('Payment failed'),'error');}
}
