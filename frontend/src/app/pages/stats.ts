import { Component, ElementRef, OnDestroy, OnInit, effect, inject, signal, viewChild } from '@angular/core';
import { Chart } from 'chart.js/auto';
import { ApiService } from '../core/api.service';
import { MyStats } from '../core/models';
import { I18nService } from '../core/i18n.service';

const COLORS = ['#C6F432', '#6366F1', '#38BDF8', '#F59E0B', '#EF4444', '#22C55E', '#A855F7'];

@Component({
  selector: 'app-stats',
  template: `
  <h2>{{ i18n.t('STATS_TITLE') }}</h2>
  <p>{{ i18n.t('STATS_SUBTITLE') }}</p>

  @if (stats(); as s) {
    <div class="grid grid-4">
      <div class="card"><p>{{ i18n.t('STATS_FINISHED') }}</p><h1 class="accent">{{ s.total_sessions }}</h1></div>
      <div class="card"><p>{{ i18n.t('STATS_HOURS') }}</p><h1>{{ s.total_hours }} <small class="muted">{{ i18n.t('STATS_HOUR_UNIT') }}</small></h1></div>
      <div class="card"><p>{{ i18n.t('STATS_UPCOMING') }}</p><h1>{{ s.upcoming }}</h1></div>
      <div class="card"><p>{{ i18n.t('STATS_FAVORITE_TRAINER') }}</p><h3 style="margin-top:10px">{{ s.favorite_trainer ?? '—' }}</h3></div>
    </div>

    @if (s.total_sessions === 0) {
      <div class="card mt muted">{{ i18n.t('STATS_EMPTY') }}</div>
    } @else {
      <div class="grid charts mt">
        <div class="card"><h3>{{ i18n.t('CHART_SESSIONS_TRAINER') }}</h3><div class="box"><canvas #barCanvas></canvas></div></div>
        <div class="card"><h3>{{ i18n.t('CHART_HOURS_TRAINER') }}</h3><div class="box"><canvas #pieCanvas></canvas></div></div>
        <div class="card wide"><h3>{{ i18n.t('CHART_SESSIONS_MONTH') }}</h3><div class="box"><canvas #lineCanvas></canvas></div></div>
      </div>
    }
  } @else { <div class="skeleton mt"></div> }`,
  styles: `.charts{grid-template-columns:repeat(auto-fit,minmax(320px,1fr))} .wide{grid-column:1/-1}
    .box{position:relative;height:280px;margin-top:10px}`
})
export class StatsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  readonly i18n = inject(I18nService);

  stats = signal<MyStats | null>(null);
  private charts: Chart[] = [];
  private bar = viewChild<ElementRef<HTMLCanvasElement>>('barCanvas');
  private pie = viewChild<ElementRef<HTMLCanvasElement>>('pieCanvas');
  private line = viewChild<ElementRef<HTMLCanvasElement>>('lineCanvas');

  constructor() {
    effect(() => {
      this.i18n.lang(); // Dil değişimini dinle
      const s = this.stats();
      if (s && s.total_sessions > 0) {
        setTimeout(() => this.draw(s));
      }
    });
  }

  ngOnInit() {
    this.api.myStats().subscribe(s => {
      this.stats.set(s);
    });
  }

  ngOnDestroy() { this.destroyCharts(); }

  private destroyCharts() {
    this.charts.forEach(c => c.destroy());
    this.charts = [];
  }

  private draw(s: MyStats) {
    this.destroyCharts();
    const text = getComputedStyle(document.body).color || '#E8EDF7';
    const grid = 'rgba(147,160,184,.2)';
    const names = s.by_trainer.map(t => t.trainer_name);
    const sessionsLabel = this.i18n.t('CHART_LABEL_SESSIONS');
    const hoursLabel = this.i18n.t('CHART_LABEL_HOURS');
    const bar = this.bar()?.nativeElement, pie = this.pie()?.nativeElement, line = this.line()?.nativeElement;

    if (bar) this.charts.push(new Chart(bar, {
      type: 'bar',
      data: { labels: names, datasets: [{ label: sessionsLabel, data: s.by_trainer.map(t => t.sessions), backgroundColor: COLORS[0], borderRadius: 8 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { x: { ticks: { color: text }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: text, precision: 0 }, grid: { color: grid } } } }
    }));
    if (pie) this.charts.push(new Chart(pie, {
      type: 'doughnut',
      data: { labels: names, datasets: [{ label: hoursLabel, data: s.by_trainer.map(t => t.hours), backgroundColor: COLORS, borderWidth: 0 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: text } } } }
    }));
    if (line) this.charts.push(new Chart(line, {
      type: 'line',
      data: { labels: s.by_month.map(m => m.month), datasets: [{ label: sessionsLabel, data: s.by_month.map(m => m.sessions), borderColor: COLORS[1], backgroundColor: 'rgba(99,102,241,.2)', fill: true, tension: .35, pointRadius: 4 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { x: { ticks: { color: text }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: text, precision: 0 }, grid: { color: grid } } } }
    }));
  }
}