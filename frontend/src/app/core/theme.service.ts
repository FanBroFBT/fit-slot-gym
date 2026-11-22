import { Injectable, signal } from '@angular/core';

export type ThemeName = 'dark' | 'light' | 'neon';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly current = signal<ThemeName>(this.saved());

  constructor() {
    this.apply();
  }

  private saved(): ThemeName {
    try {
      const value = localStorage.getItem('fitslot_theme');
      return value === 'light' || value === 'neon' ? value : 'dark';
    } catch {
      return 'dark';
    }
  }

  setTheme(value: ThemeName): void {
    this.current.set(value);
    try { localStorage.setItem('fitslot_theme', value); } catch { /* private mode */ }
    this.apply();
  }

  cycle(): void {
    const order: ThemeName[] = ['dark', 'light', 'neon'];
    this.setTheme(order[(order.indexOf(this.current()) + 1) % order.length]);
  }

  private apply(): void {
    if (typeof document === 'undefined') return;
    // The root element is global; component-scoped body selectors are not.
    const theme = this.current();
    document.documentElement.dataset['theme'] = theme;
    document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark';
    document.body.classList.remove('theme-dark', 'theme-light', 'theme-neon');
    document.body.classList.add(`theme-${theme}`);
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute('content', theme === 'light' ? '#f5f8f5' : theme === 'neon' ? '#080c16' : '#0b111b');
  }
}
