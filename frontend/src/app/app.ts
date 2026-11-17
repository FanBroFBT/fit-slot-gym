import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { ToastService } from './core/toast.service';
import { ThemeService } from './core/theme.service';
import { I18nService, LangCode } from './core/i18n.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected auth = inject(AuthService);
  protected toast = inject(ToastService);
  protected themeSvc = inject(ThemeService);
  protected i18n = inject(I18nService);

  changeLang(event: Event) {
    const val = (event.target as HTMLSelectElement).value as LangCode;
    this.i18n.setLang(val);
  }
}