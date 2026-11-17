import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ApiError } from '../core/models';
import { ToastService } from '../core/toast.service';
import { I18nService } from '../core/i18n.service';

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
      <p class="accent" style="font-weight:600">{{ i18n.t('SYS_NAME') }}</p>
      <h1>{{ i18n.t('HERO_TITLE_1') }} <span class="accent">{{ i18n.t('HERO_TITLE_ACCENT') }}</span></h1>
      <p>{{ i18n.t('HERO_DESC') }}</p>
      <div class="row mt-s muted"><span>{{ i18n.t('FEAT_1') }}</span><span>{{ i18n.t('FEAT_2') }}</span><span>{{ i18n.t('FEAT_3') }}</span></div>
    </div>
    <div class="card">
      <div class="row">
        <button type="button" class="chip" [class.on]="mode() === 'login'" (click)="switchMode('login')">{{ i18n.t('TAB_LOGIN') }}</button>
        <button type="button" class="chip" [class.on]="mode() === 'register'" (click)="switchMode('register')">{{ i18n.t('TAB_REGISTER') }}</button>
      </div>
      <form (ngSubmit)="submit()">
        @if (mode() === 'register') {
          <label for="n">{{ i18n.t('FULL_NAME') }}</label>
          <input id="n" name="n" [(ngModel)]="fullName" required />

          <label for="p">{{ i18n.t('PHONE') }}</label>
          <input id="p" name="p" [(ngModel)]="phone" required />
        }

        <label for="e">{{ i18n.t('EMAIL') }}</label>
        <input id="e" name="e" type="email" [(ngModel)]="email" required />

        <label for="pw">{{ i18n.t('PASSWORD') }}</label>
        <div class="pwd-wrap">
          <input
            id="pw"
            name="pw"
            [type]="showPassword() ? 'text' : 'password'"
            [(ngModel)]="password"
            required
          />
          <button type="button" class="btn btn-sm pwd-toggle" (click)="showPassword.set(!showPassword())">
            {{ showPassword() ? i18n.t('BTN_HIDE') : i18n.t('BTN_SHOW') }}
          </button>
        </div>

        @if (mode() === 'register') {
          <label for="cpw">{{ i18n.t('CONFIRM_PASSWORD') }}</label>
          <input
            id="cpw"
            name="cpw"
            [type]="showPassword() ? 'text' : 'password'"
            [(ngModel)]="confirmPassword"
            required
          />

          <div class="pwd-rules mt-s">
            <p class="rules-title">{{ i18n.t('PWD_RULES_TITLE') }}</p>
            <ul>
              <li [class.valid]="pwdRules.minLength">{{ pwdRules.minLength ? '✔' : '○' }} {{ i18n.t('RULE_LENGTH') }}</li>
              <li [class.valid]="pwdRules.hasUpper">{{ pwdRules.hasUpper ? '✔' : '○' }} {{ i18n.t('RULE_UPPER') }}</li>
              <li [class.valid]="pwdRules.hasLower">{{ pwdRules.hasLower ? '✔' : '○' }} {{ i18n.t('RULE_LOWER') }}</li>
              <li [class.valid]="pwdRules.hasDigit">{{ pwdRules.hasDigit ? '✔' : '○' }} {{ i18n.t('RULE_DIGIT') }}</li>
              <li [class.valid]="pwdRules.hasSpecial">{{ pwdRules.hasSpecial ? '✔' : '○' }} {{ i18n.t('RULE_SPECIAL') }}</li>
              <li [class.valid]="pwdRules.notPersonal">{{ pwdRules.notPersonal ? '✔' : '○' }} {{ i18n.t('RULE_PERSONAL') }}</li>
            </ul>
          </div>
        }

        @if (error()) { <div class="alert alert-error mt-s">{{ error() }}</div> }

        <button
          class="btn btn-primary mt"
          style="width:100%"
          [disabled]="busy() || (mode() === 'register' && !canRegister)"
        >
          {{ mode() === 'login' ? i18n.t('BTN_LOGIN') : i18n.t('BTN_REGISTER') }}
        </button>
      </form>

      <p class="mt muted" style="font-size:.85rem">{{ i18n.t('DEMO_ACCOUNTS') }}</p>
      <div class="row">
        <button class="btn btn-sm" type="button" (click)="demo('member@gym.kz', 'member123')">{{ i18n.t('DEMO_MEMBER') }}</button>
        <button class="btn btn-sm" type="button" (click)="demo('admin@gym.kz', 'admin123')">{{ i18n.t('DEMO_ADMIN') }}</button>
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
  protected i18n = inject(I18nService);

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
        this.error.set(this.i18n.t('ERR_WEAK_PASSWORD'));
        return;
      }
      if (this.password !== this.confirmPassword) {
        this.error.set(this.i18n.t('ERR_PASSWORDS_MISMATCH'));
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
        this.toast.show(`${this.i18n.t('WELCOME_PREFIX')}${info.name}`, 'success');
        this.router.navigate([this.auth.home()]);
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        const body = e.error as (ApiError & { detail?: string; password?: string[] }) | null;
        const validationMsg =
          body?.message ||
          body?.detail ||
          (Array.isArray(body?.password) ? body.password[0] : null);
        this.error.set(validationMsg ?? this.i18n.t('ERR_SERVER_UNREACHABLE'));
      },
    });
  }
}