import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { ToastService } from './core/toast.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected auth = inject(AuthService);
  protected toast = inject(ToastService);

  // Қараңғы/Жарық режим логикасы
  isLight = signal<boolean>(localStorage.getItem('theme') === 'light');

  constructor() {
    if (this.isLight()) {
      document.body.classList.add('light-theme');
    }
  }

  toggleTheme() {
    this.isLight.update(v => !v);
    if (this.isLight()) {
      document.body.classList.add('light-theme');
      localStorage.setItem('theme', 'light');
    } else {
      document.body.classList.remove('light-theme');
      localStorage.setItem('theme', 'dark');
    }
  }
}