import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { ToastService } from './core/toast.service';
import { ThemeService } from './core/theme.service';
import { I18nService, LangCode } from './core/i18n.service';
import { NotificationBellComponent } from './core/notification-bell';
import { AICoachWidgetComponent } from './core/ai-coach-widget';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NotificationBellComponent, AICoachWidgetComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected auth = inject(AuthService);
  protected toast = inject(ToastService);
  protected themeSvc = inject(ThemeService);
  protected i18n = inject(I18nService);
  changeLang(event: Event) { this.i18n.setLang((event.target as HTMLSelectElement).value as LangCode); }
}
