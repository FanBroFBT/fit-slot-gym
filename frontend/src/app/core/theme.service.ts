import { Injectable, signal } from '@angular/core';
export type ThemeName = 'dark'|'light'|'neon';
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly current = signal<ThemeName>(this.saved());
  constructor() { if (typeof document !== 'undefined') this.apply(); }
  private saved(): ThemeName {
    try { const v = localStorage.getItem('fitslot_theme'); return v === 'light' || v === 'neon' ? v : 'dark'; }
    catch { return 'dark'; }
  }
  setTheme(value: ThemeName) {
    this.current.set(value);
    try { localStorage.setItem('fitslot_theme', value); } catch { /* storage disabled */ }
    this.apply();
  }
  cycle() { this.setTheme(this.current() === 'dark' ? 'light' : this.current() === 'light' ? 'neon' : 'dark'); }
  private apply() {
    document.body.classList.remove('theme-dark', 'theme-light', 'theme-neon');
    document.body.classList.add(`theme-${this.current()}`);
  }
}
