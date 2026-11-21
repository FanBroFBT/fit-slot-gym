import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { ApiService } from './api.service';
import { AuthInfo } from './models';

const KEY = 'fitslot_auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private router = inject(Router);
  readonly user = signal<AuthInfo | null>(this.load());
  readonly role = computed(() => this.user()?.role ?? null);
  readonly token = computed(() => this.user()?.token ?? null);

  private load(): AuthInfo | null {
    try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; }
  }
  private save(info: AuthInfo) {
    localStorage.setItem(KEY, JSON.stringify(info));
    this.user.set(info);
  }
  login(email: string, password: string) {
    return this.api.login(email, password).pipe(tap(i => this.save(i)));
  }
  register(body: { full_name: string; phone: string; email: string; password: string }) {
    return this.api.register(body).pipe(tap(i => this.save(i)));
  }
  logout() {
    localStorage.removeItem(KEY);
    this.user.set(null);
    this.router.navigate(['/login']);
  }
  home(): string { return this.role() === 'admin' ? '/admin' : '/book'; }
}
