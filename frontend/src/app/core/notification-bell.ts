import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { ApiService } from './api.service';
import { NotificationsResponse } from './models';
import { I18nService } from './i18n.service';

@Component({
  selector: 'app-notification-bell',
  imports: [DatePipe],
  template: `
    <div class="bell-wrap">
      <button class="btn bell-button" type="button" aria-label="Notifications" [attr.aria-expanded]="open()" (click)="toggle()">
        🔔 @if (data().unread_count) { <span class="bell-count">{{data().unread_count}}</span> }
      </button>
      @if (open()) {
        <div class="bell-panel" role="region" aria-label="Notifications">
          <div class="bell-head">
            <b>{{i18n.t('Notifications')}}</b>
            <button class="btn btn-sm" [disabled]="!data().unread_count" (click)="markAll()">{{i18n.t('Mark all as read')}}</button>
          </div>
          <div class="bell-list">
            @for (item of data().notifications; track item.id) {
              <button class="bell-item" [class.unread]="!item.is_read" (click)="markOne(item.id)">
                <strong>{{i18n.t(item.title)}}</strong>
                <span>{{item.message}}</span>
                <small>{{item.created_at | date:'MMM d, HH:mm'}}</small>
              </button>
            } @empty { <p class="muted">{{i18n.t('No notifications')}}</p> }
          </div>
        </div>
      }
    </div>`,
  styles: `
    .bell-wrap{position:relative}.bell-button{position:relative;padding:7px 11px}
    .bell-count{position:absolute;top:-8px;right:-8px;background:var(--danger);color:#fff;font-size:11px;padding:1px 6px;border-radius:20px}
    .bell-panel{position:absolute;right:0;top:45px;width:min(370px,90vw);max-height:440px;overflow:hidden;background:var(--surface);border:1px solid var(--border);box-shadow:0 15px 50px #0006;border-radius:14px;z-index:100}
    .bell-head{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:14px;border-bottom:1px solid var(--border)}
    .bell-head button{font-size:11px}.bell-list{max-height:355px;overflow:auto}
    .bell-list p{padding:12px}.bell-item{display:grid;width:100%;gap:4px;text-align:left;background:transparent;color:var(--text);border:0;border-bottom:1px solid var(--border);padding:13px;cursor:pointer}
    .bell-item.unread{background:var(--surface-2)}.bell-item span{font-size:13px;color:var(--muted)}.bell-item small{font-size:11px;color:var(--muted)}
  `
})
export class NotificationBellComponent implements OnInit {
  private api = inject(ApiService);
  private destroyRef = inject(DestroyRef);
  i18n = inject(I18nService);
  open = signal(false);
  data = signal<NotificationsResponse>({ notifications: [], unread_count: 0 });
  ngOnInit() {
    this.refresh();
    interval(30000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.refresh());
  }
  refresh() { this.api.notifications().subscribe({ next: value => this.data.set(value) }); }
  toggle() { this.open.update(v => !v); if (this.open()) this.refresh(); }
  markOne(id: number) {
    this.api.readNotification(id).subscribe({ next: () => this.refresh() });
  }
  markAll() { this.api.readNotification().subscribe({ next: () => this.refresh() }); }
}
