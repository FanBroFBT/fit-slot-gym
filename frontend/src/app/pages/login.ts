import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ApiError } from '../core/models';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
  <section class="hero">
    <div>
      <p class="accent" style="font-weight:600">GYM BOOKING SYSTEM</p>
      <h1>Book your trainer in 3 clicks. <span class="accent">Never double-booked.</span></h1>
      <p>Live availability, instant confirmation and one rule the database never breaks: one trainer, one slot.</p>
      <div class="row mt-s muted"><span>✔ Live slots</span><span>✔ Instant booking</span><span>✔ 24/7 access pass</span></div>
    </div>
    <div class="card">
      <div class="row">
        <button class="chip" [class.on]="mode() === 'login'" (click)="mode.set('login')">Log in</button>
        <button class="chip" [class.on]="mode() === 'register'" (click)="mode.set('register')">Sign up</button>
      </div>
      <form (ngSubmit)="submit()">
        @if (mode() === 'register') {
          <label for="n">Full name</label><input id="n" name="n" [(ngModel)]="fullName" required />
          <label for="p">Phone</label><input id="p" name="p" [(ngModel)]="phone" required />
        }
        <label for="e">Email</label><input id="e" name="e" type="email" [(ngModel)]="email" required />
        <label for="pw">Password</label><input id="pw" name="pw" type="password" [(ngModel)]="password" required />
        @if (error()) { <div class="alert alert-error mt-s">{{ error() }}</div> }
        <button class="btn btn-primary mt" style="width:100%" [disabled]="busy()">{{ mode() === 'login' ? 'Log in' : 'Create account' }}</button>
      </form>
      <p class="mt muted" style="font-size:.85rem">Demo accounts:</p>
      <div class="row">
        <button class="btn btn-sm" type="button" (click)="demo('member@gym.kz', 'member123')">Member</button>
        <button class="btn btn-sm" type="button" (click)="demo('admin@gym.kz', 'admin123')">Admin</button>
      </div>
    </div>
  </section>`,
  styles: `.hero{display:grid;grid-template-columns:1.2fr 1fr;gap:40px;align-items:center;padding-top:40px}
  @media (max-width:800px){.hero{grid-template-columns:1fr}}`
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);
  mode = signal<'login' | 'register'>('login');
  email = ''; password = ''; fullName = ''; phone = '';
  error = signal(''); busy = signal(false);

  demo(email: string, password: string) { this.email = email; this.password = password; this.mode.set('login'); this.submit(); }

  submit() {
    this.error.set(''); this.busy.set(true);
    const request = this.mode() === 'login'
      ? this.auth.login(this.email, this.password)
      : this.auth.register({ full_name: this.fullName, phone: this.phone, email: this.email, password: this.password });
    request.subscribe({
      next: info => { this.busy.set(false); this.toast.show(`Welcome, ${info.name}`, 'success'); this.router.navigate([this.auth.home()]); },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.error.set((e.error as ApiError)?.message ?? 'Server is not reachable. Is the backend running?');
      }
    });
  }
}
