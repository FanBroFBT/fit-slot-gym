import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiService } from '../core/api.service';
import { I18nService } from '../core/i18n.service';
import { MyStats } from '../core/models';
@Component({
  selector: 'app-stats', imports: [DecimalPipe],
  template: `
    <h2>{{i18n.t('Workout Statistics')}}</h2>
    @if(data();as stats){
      <div class="grid grid-4 mt">
        <div class="card"><p>{{i18n.t('Completed workouts')}}</p><h1>{{stats.total_sessions}}</h1></div>
        <div class="card"><p>{{i18n.t('Training hours')}}</p><h1>{{stats.total_hours}}</h1></div>
        <div class="card"><p>{{i18n.t('Upcoming sessions')}}</p><h1>{{stats.upcoming}}</h1></div>
        <div class="card"><p>{{i18n.t('Total spent')}}</p><h1>{{stats.spent_kzt | number:'1.0-0'}} ₸</h1></div>
      </div>
      <div class="card mt"><h3>🎁 {{i18n.t('Loyalty progress')}} {{stats.loyalty_progress}}/5</h3>
        <div class="progress"><div [style.width.%]="stats.loyalty_progress / 5 * 100"></div></div>
        <p>{{stats.loyalty_remaining}} {{i18n.t('paid sessions until the cashback bonus')}}</p>
      </div>
      <div class="grid grid-3 mt">
        <div class="card"><h3>{{i18n.t('By trainer')}}</h3>
          @for(row of stats.by_trainer;track row.trainer_id){<p>{{row.trainer_name}} — {{row.sessions}} {{i18n.t('sessions')}}</p>}
        </div>
        <div class="card"><h3>{{i18n.t('By month')}}</h3>
          @for(row of stats.by_month;track row.month){<div class="row"><span>{{row.month}}</span><span>{{row.sessions}}</span></div>}
        </div>
        <div class="card"><h3>{{i18n.t('Favorite trainer')}}</h3><h2>{{stats.favorite_trainer ?? '—'}}</h2></div>
      </div>
    } @else {<p>{{i18n.t('Loading…')}}</p>}
  `,
  styles: `.progress{height:12px;background:var(--surface-2);border-radius:20px;overflow:hidden;margin:15px 0}.progress div{height:100%;background:var(--primary);border-radius:20px}`
})
export class StatsComponent implements OnInit {
  private api = inject(ApiService);
  i18n = inject(I18nService);
  data = signal<MyStats|null>(null);
  ngOnInit(){this.api.myStats().subscribe({next:s=>this.data.set(s)});}
}
