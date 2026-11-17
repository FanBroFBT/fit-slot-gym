import { Component, ElementRef, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import { Chart } from 'chart.js/auto';
import { ApiService } from '../core/api.service';
import { MyStats } from '../core/models';

const COLORS = ['#C6F432', '#6366F1', '#38BDF8', '#F59E0B', '#EF4444', '#22C55E', '#A855F7'];

@Component({
  selector: 'app-stats',
  template: `
  <h2>Workout history & analytics</h2>
  <p>Your sessions, hours and favorite trainers.</p>

  @if (stats(); as s) {
    <div class="grid grid-4">
      <div class="card"><p>Finished sessions</p><h1 class="accent">{{ s.total_sessions }}</h1></div>
      <div class="card"><p>Hours trained</p><h1>{{ s.total_hours }} <small class="muted">h</small></h1></div>
      <div class="card"><p>Upcoming</p><h1>{{ s.upcoming }}</h1></div>
      <div class="card"><p>Favorite trainer</p><h3 style="margin-top:10px">{{ s.favorite_trainer ?? '—' }}</h3></div>
    </div>

    @if (s.total_sessions === 0) {
      <div class="card mt muted">No finished sessions yet. Book your first training and your charts will appear here.</div>
    } @else {
      <div class="grid charts mt">
        <div class="card"><h3>Sessions per trainer</h3><div class="box"><canvas #barCanvas></canvas></div></div>
        <div class="card"><h3>Hours per trainer</h3><div class="box"><canvas #pieCanvas></canvas></div></div>
        <div class="card wide"><h3>Sessions per month</h3><div class="box"><canvas #lineCanvas></canvas></div></div>
      </div>
    }
  } @else { <div class="skeleton mt"></div> }`,
  styles: `.charts{grid-template-columns:repeat(auto-fit,minmax(320px,1fr))} .wide{grid-column:1/-1}
    .box{position:relative;height:280px;margin-top:10px}`
})
export class StatsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  stats = signal<MyStats | null>(null);
  private charts: Chart[] = [];
  private bar = viewChild<ElementRef<HTMLCanvasElement>>('barCanvas');
  private pie = viewChild<ElementRef<HTMLCanvasElement>>('pieCanvas');
  private line = viewChild<ElementRef<HTMLCanvasElement>>('lineCanvas');

  ngOnInit() {
    this.api.myStats().subscribe(s => {
      this.stats.set(s);
      setTimeout(() => this.draw(s));   // wait until the canvases are rendered
    });
  }

  ngOnDestroy() { this.charts.forEach(c => c.destroy()); }

  private draw(s: MyStats) {
    const text = getComputedStyle(document.body).color || '#E8EDF7';
    const grid = 'rgba(147,160,184,.2)';
    const names = s.by_trainer.map(t => t.trainer_name);
    const bar = this.bar()?.nativeElement, pie = this.pie()?.nativeElement, line = this.line()?.nativeElement;
    if (bar) this.charts.push(new Chart(bar, {
      type: 'bar',
      data: { labels: names, datasets: [{ label: 'Sessions', data: s.by_trainer.map(t => t.sessions), backgroundColor: COLORS[0], borderRadius: 8 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { x: { ticks: { color: text }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: text, precision: 0 }, grid: { color: grid } } } }
    }));
    if (pie) this.charts.push(new Chart(pie, {
      type: 'doughnut',
      data: { labels: names, datasets: [{ label: 'Hours', data: s.by_trainer.map(t => t.hours), backgroundColor: COLORS, borderWidth: 0 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: text } } } }
    }));
    if (line) this.charts.push(new Chart(line, {
      type: 'line',
      data: { labels: s.by_month.map(m => m.month), datasets: [{ label: 'Sessions', data: s.by_month.map(m => m.sessions), borderColor: COLORS[1], backgroundColor: 'rgba(99,102,241,.2)', fill: true, tension: .35, pointRadius: 4 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { x: { ticks: { color: text }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: text, precision: 0 }, grid: { color: grid } } } }
    }));
  }
}
