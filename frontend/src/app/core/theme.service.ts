import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'dark' | 'light' | 'neon';

const THEME_KEY = 'fitslot_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<ThemeMode>((localStorage.getItem(THEME_KEY) as ThemeMode) || 'dark');

  constructor() {
    this.apply(this.theme());
  }

  setTheme(mode: ThemeMode) {
    this.theme.set(mode);
    localStorage.setItem(THEME_KEY, mode);
    this.apply(mode);
  }

  cycleTheme() {
    const order: ThemeMode[] = ['dark', 'light', 'neon'];
    const next = order[(order.indexOf(this.theme()) + 1) % order.length];
    this.setTheme(next);
  }

  private apply(mode: ThemeMode) {
    document.documentElement.setAttribute('data-theme', mode);
    document.body.classList.toggle('light-theme', mode === 'light');
  }
}