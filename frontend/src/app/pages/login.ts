import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ApiError } from '../core/models';
import { ToastService } from '../core/toast.service';

export interface PasswordRules {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasDigit: boolean;
  hasSpecial: boolean;
  notPersonal: boolean;
}

export function checkPasswordRules(password: string, email = '', fullName = ''): PasswordRules {
  const lowerPwd = password.toLowerCase();
  const emailPrefix = email.split('@')[0]?.trim().toLowerCase() ?? '';
  const nameToken = fullName.trim().toLowerCase();

  const containsEmail = emailPrefix.length >= 3 && lowerPwd.includes(emailPrefix);
  const containsName = nameToken.length >= 3 && lowerPwd.includes(nameToken);

  return {
    minLength: password.length >= 8 && password.length <= 64,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasDigit: /\d/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>_\-]/.test(password),
    notPersonal: !containsEmail && !containsName,
  };
}

export function isPasswordStrong(password: string, email = '', fullName = ''): boolean {
  const r = checkPasswordRules(password, email, fullName);
  return r.minLength && r.hasUpper && r.hasLower && r.hasDigit && r.hasSpecial && r.notPersonal;
}

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
        <button type="button" class="chip" [class.on]="mode() === 'login'" (click)="switchMode('login')">Log in</button>
        <button type="button" class="chip" [class.on]="mode() === 'register'" (click)="switchMode('register')">Sign up</button>
      </div>
      <form (ngSubmit)="submit()">
        @if (mode() === 'register') {
          <label for="n">Full name</label>
          <input id="n" name="n" [(ngModel)]="fullName" required />

          <label for="p">Phone</label>
          <input id="p" name="p" [(ngModel)]="phone" required />
        }

        <label for="e">Email</label>
        <input id="e" name="e" type="email" [(ngModel)]="email" required />

        <label for="pw">Password</label>
        <div class="pwd-wrap">
          <input
            id="pw"
            name="pw"
            [type]="showPassword() ? 'text' : 'password'"
            [(ngModel)]="password"
            required
          />
          <button type="button" class="btn btn-sm pwd-toggle" (click)="showPassword.set(!showPassword())">
            {{ showPassword() ? 'Hide' : 'Show' }}
          </button>
        </div>

        @if (mode() === 'register') {
          <label for="cpw">Confirm password</label>
          <input
            id="cpw"
            name="cpw"
            [type]="showPassword() ? 'text' : 'password'"
            [(ngModel)]="confirmPassword"
            required
          />

          <div class="pwd-rules mt-s">
            <p class="rules-title">Password security requirements:</p>
            <ul>
              <li [class.valid]="pwdRules.minLength">{{ pwdRules.minLength ? '✔' : '○' }} 8–64 characters</li>
              <li [class.valid]="pwdRules.hasUpper">{{ pwdRules.hasUpper ? '✔' : '○' }} At least 1 uppercase letter (A–Z)</li>
              <li [class.valid]="pwdRules.hasLower">{{ pwdRules.hasLower ? '✔' : '○' }} At least 1 lowercase letter (a–z)</li>
              <li [class.valid]="pwdRules.hasDigit">{{ pwdRules.hasDigit ? '✔' : '○' }} At least 1 digit (0–9)</li>
              <li [class.valid]="pwdRules.hasSpecial">{{ pwdRules.hasSpecial ? '✔' : '○' }} At least 1 special character (!&#64;#$%...)</li>
              <li [class.valid]="pwdRules.notPersonal">{{ pwdRules.notPersonal ? '✔' : '○' }} Does not contain your email or name</li>
            </ul>
          </div>
        }

        @if (error()) { <div class="alert alert-error mt-s">{{ error() }}</div> }

        <button
          class="btn btn-primary mt"
          style="width:100%"
          [disabled]="busy() || (mode() === 'register' && !canRegister)"
        >
          {{ mode() === 'login' ? 'Log in' : 'Create account' }}
        </button>
      </form>

      <p class="mt muted" style="font-size:.85rem">Demo accounts:</p>
      <div class="row">
        <button class="btn btn-sm" type="button" (click)="demo('member@gym.kz', 'member123')">Member</button>
        <button class="btn btn-sm" type="button" (click)="demo('admin@gym.kz', 'admin123')">Admin</button>
      </div>
    </div>
  </section>`,
  styles: `
    .hero{display:grid;grid-template-columns:1.2fr 1fr;gap:40px;align-items:center;padding-top:40px}
    .pwd-wrap{display:flex;gap:8px;align-items:center}
    .pwd-wrap input{flex:1;margin:0}
    .pwd-toggle{white-space:nowrap}
    .pwd-rules{padding:10px 12px;border-radius:8px;background:rgba(128,128,128,.08);font-size:.82rem}
    .rules-title{margin:0 0 6px;font-weight:600}
    .pwd-rules ul{list-style:none;padding:0;margin:0;display:grid;gap:3px}
    .pwd-rules li{opacity:.75;transition:color .2s,opacity .2s}
    .pwd-rules li.valid{color:#16a34a;opacity:1;font-weight:500}
    @media (max-width:800px){.hero{grid-template-columns:1fr}}
  `
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  mode = signal<'login' | 'register'>('login');
  showPassword = signal(false);
  email = '';
  password = '';
  confirmPassword = '';
  fullName = '';
  phone = '';
  error = signal('');
  busy = signal(false);

  get pwdRules(): PasswordRules {
    return checkPasswordRules(this.password, this.email, this.fullName);
  }

  get canRegister(): boolean {
    return (
      this.fullName.trim().length > 0 &&
      this.phone.trim().length > 0 &&
      this.email.trim().length > 0 &&
      isPasswordStrong(this.password, this.email, this.fullName) &&
      this.password === this.confirmPassword
    );
  }

  switchMode(nextMode: 'login' | 'register') {
    this.mode.set(nextMode);
    this.error.set('');
    this.confirmPassword = '';
  }

  demo(email: string, password: string) {
    this.email = email;
    this.password = password;
    this.mode.set('login');
    this.submit();
  }

  submit() {
    this.error.set('');

    if (this.mode() === 'register') {
      if (!isPasswordStrong(this.password, this.email, this.fullName)) {
        this.error.set('Password must be 8+ chars with uppercase, lowercase, digit, and special character.');
        return;
      }
      if (this.password !== this.confirmPassword) {
        this.error.set('Passwords do not match.');
        return;
      }
    }

    this.busy.set(true);
    const request = this.mode() === 'login'
      ? this.auth.login(this.email, this.password)
      : this.auth.register({
          full_name: this.fullName,
          phone: this.phone,
          email: this.email,
          password: this.password,
        });

    request.subscribe({
      next: info => {
        this.busy.set(false);
        this.toast.show(`Welcome, ${info.name}`, 'success');
        this.router.navigate([this.auth.home()]);
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        const body = e.error as (ApiError & { detail?: string; password?: string[] }) | null;
        const validationMsg =
          body?.message ||
          body?.detail ||
          (Array.isArray(body?.password) ? body.password[0] : null);
        this.error.set(validationMsg ?? 'Server is not reachable. Is the backend running?');
      },
    });
  }
}