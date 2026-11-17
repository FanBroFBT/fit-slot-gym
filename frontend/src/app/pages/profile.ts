import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { Member, MyStats, Wallet } from '../core/models';
import { ToastService } from '../core/toast.service';
import { PasswordRules, checkPasswordRules, isPasswordStrong } from './login';
import { I18nService } from '../core/i18n.service';

interface ProfileErrorResponse {
  message?: string;
  detail?: string;
  old_password?: string[];
  new_password?: string[];
  new_password_confirm?: string[];
  full_name?: string[];
  phone?: string[];
  email?: string[];
}

@Component({
  selector: 'app-profile',
  imports: [FormsModule, DatePipe, RouterLink],
  template: `
  <div class="row between">
    <div>
      <h2>{{ i18n.t('PROFILE_TITLE') }}</h2>
      <p class="muted">{{ i18n.t('PROFILE_SUBTITLE') }}</p>
    </div>
    @if (profile(); as p) {
      <span class="badge b-{{ p.membership_status }}">{{ p.membership_status }}</span>
    }
  </div>

  @if (loading()) {
    <div class="skeleton mt"></div>
  } @else if (profile(); as p) {
    <div class="grid grid-4 mt">
      <div class="card">
        <p>{{ i18n.t('MEMBER_ID') }}</p>
        <h2 class="accent">{{ p.member_id }}</h2>
      </div>
      <div class="card">
        <p>{{ i18n.t('MEMBERSHIP_VALID_UNTIL') }}</p>
        <h3>
          @if (p.membership_end_date; as endDate) {
            {{ endDate | date: 'd MMM y' }}
          } @else {
            {{ i18n.t('NO_ACTIVE_PLAN') }}
          }
        </h3>
      </div>
      <div class="card">
        <p>{{ i18n.t('WALLET_BALANCE_LABEL') }}</p>
        <h3>{{ wallet()?.balance_kzt ?? 0 }} <small class="muted">KZT</small></h3>
      </div>
      <div class="card">
        <p>{{ i18n.t('FINISHED_SESSIONS_LABEL') }}</p>
        <h3>{{ stats()?.total_sessions ?? 0 }} <small class="muted">({{ stats()?.total_hours ?? 0 }} {{ i18n.t('STATS_HOUR_UNIT') }})</small></h3>
      </div>
    </div>

    <div class="grid two mt">
      <!-- 1. Жеке деректерді өңдеу -->
      <div class="card">
        <div class="row" style="gap: 14px; align-items: center;">
          <div class="avatar">{{ initials(p.full_name) }}</div>
          <div>
            <h3 style="margin: 0;">{{ p.full_name }}</h3>
            <span class="muted" style="font-size: .85rem;">{{ p.email || 'No email' }} · {{ p.phone }}</span>
          </div>
        </div>

        <form class="mt" (ngSubmit)="saveProfile()">
          <label for="pf-name">{{ i18n.t('FULL_NAME') }}</label>
          <input id="pf-name" name="full_name" [(ngModel)]="form.full_name" required />

          <label for="pf-phone">{{ i18n.t('PHONE') }}</label>
          <input id="pf-phone" name="phone" [(ngModel)]="form.phone" required />

          <label for="pf-email">{{ i18n.t('EMAIL') }}</label>
          <input id="pf-email" name="email" type="email" [(ngModel)]="form.email" required />

          @if (profileError()) {
            <div class="alert alert-error mt-s">{{ profileError() }}</div>
          }

          <div class="row mt" style="justify-content: space-between;">
            <button class="btn btn-primary" [disabled]="savingProfile()">
              {{ savingProfile() ? i18n.t('SAVING_TEXT') : i18n.t('BTN_SAVE_CHANGES') }}
            </button>
            <a class="btn" routerLink="/wallet">{{ i18n.t('MANAGE_WALLET_LINK') }}</a>
          </div>
        </form>
      </div>

      <!-- 2. Парольді ауыстыру -->
      <div class="card">
        <h3>{{ i18n.t('CHANGE_PWD_TITLE') }}</h3>
        <p class="muted" style="font-size: .9rem;">{{ i18n.t('CHANGE_PWD_SUBTITLE') }}</p>

        <form (ngSubmit)="updatePassword()">
          <label for="old-pw">{{ i18n.t('OLD_PASSWORD') }}</label>
          <input
            id="old-pw"
            name="old_password"
            [type]="showPwd() ? 'text' : 'password'"
            [(ngModel)]="oldPassword"
            required
          />

          <label for="new-pw">{{ i18n.t('NEW_PASSWORD') }}</label>
          <div class="pwd-wrap">
            <input
              id="new-pw"
              name="new_password"
              [type]="showPwd() ? 'text' : 'password'"
              [(ngModel)]="newPassword"
              required
            />
            <button type="button" class="btn btn-sm" (click)="showPwd.set(!showPwd())">
              {{ showPwd() ? i18n.t('BTN_HIDE') : i18n.t('BTN_SHOW') }}
            </button>
          </div>

          <label for="conf-pw">{{ i18n.t('CONFIRM_NEW_PASSWORD') }}</label>
          <input
            id="conf-pw"
            name="confirm_password"
            [type]="showPwd() ? 'text' : 'password'"
            [(ngModel)]="confirmPassword"
            required
          />

          <div class="pwd-rules mt-s">
            <ul>
              <li [class.valid]="rules.minLength">{{ rules.minLength ? '✔' : '○' }} {{ i18n.t('RULE_LENGTH') }}</li>
              <li [class.valid]="rules.hasUpper">{{ rules.hasUpper ? '✔' : '○' }} {{ i18n.t('RULE_UPPER') }}</li>
              <li [class.valid]="rules.hasLower">{{ rules.hasLower ? '✔' : '○' }} {{ i18n.t('RULE_LOWER') }}</li>
              <li [class.valid]="rules.hasDigit">{{ rules.hasDigit ? '✔' : '○' }} {{ i18n.t('RULE_DIGIT') }}</li>
              <li [class.valid]="rules.hasSpecial">{{ rules.hasSpecial ? '✔' : '○' }} {{ i18n.t('RULE_SPECIAL') }}</li>
              <li [class.valid]="rules.notPersonal">{{ rules.notPersonal ? '✔' : '○' }} {{ i18n.t('RULE_PERSONAL') }}</li>
            </ul>
          </div>

          @if (pwdError()) {
            <div class="alert alert-error mt-s">{{ pwdError() }}</div>
          }

          <button class="btn btn-primary mt" style="width: 100%;" [disabled]="savingPwd() || !canChangePassword">
            {{ savingPwd() ? i18n.t('UPDATING_PWD_TEXT') : i18n.t('BTN_UPDATE_PASSWORD') }}
          </button>
        </form>
      </div>
    </div>
  }`,
  styles: `
    .two { grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); align-items: start; }
    .avatar {
      width: 54px; height: 54px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 1.2rem; color: #0f172a;
      background: linear-gradient(135deg, #a3e635, #38bdf8);
    }
    .pwd-wrap { display: flex; gap: 8px; align-items: center; }
    .pwd-wrap input { flex: 1; margin: 0; }
    .pwd-rules { padding: 10px 12px; border-radius: 10px; background: var(--surface-2); font-size: .82rem; }
    .pwd-rules ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 3px; }
    .pwd-rules li { opacity: .75; }
    .pwd-rules li.valid { color: #16a34a; opacity: 1; font-weight: 600; }
  `
})
export class ProfileComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  readonly i18n = inject(I18nService);

  profile = signal<Member | null>(null);
  wallet = signal<Wallet | null>(null);
  stats = signal<MyStats | null>(null);
  loading = signal(true);

  savingProfile = signal(false);
  savingPwd = signal(false);
  profileError = signal('');
  pwdError = signal('');
  showPwd = signal(false);

  form = { full_name: '', phone: '', email: '' };
  oldPassword = '';
  newPassword = '';
  confirmPassword = '';

  get rules(): PasswordRules {
    return checkPasswordRules(this.newPassword, this.form.email, this.form.full_name);
  }

  get canChangePassword(): boolean {
    return (
      this.oldPassword.length > 0 &&
      isPasswordStrong(this.newPassword, this.form.email, this.form.full_name) &&
      this.newPassword === this.confirmPassword
    );
  }

  ngOnInit() {
    this.api.myProfile().subscribe({
      next: m => {
        this.profile.set(m);
        this.form = { full_name: m.full_name, phone: m.phone, email: m.email ?? '' };
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.api.wallet().subscribe({ next: w => this.wallet.set(w), error: () => {} });
    this.api.myStats().subscribe({ next: s => this.stats.set(s), error: () => {} });
  }

  initials(name: string): string {
    return (name || 'M')
      .split(' ')
      .map(x => x[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  saveProfile() {
    this.profileError.set('');
    this.savingProfile.set(true);
    this.api.updateProfile(this.form).subscribe({
      next: updated => {
        this.profile.set(updated);
        this.auth.updateName(updated.full_name);
        this.savingProfile.set(false);
        this.toast.show(this.i18n.t('TOAST_PROFILE_UPDATED'), 'success');
      },
      error: (e: HttpErrorResponse) => {
        this.savingProfile.set(false);
        const body = e.error as ProfileErrorResponse | null;
        this.profileError.set(
          body?.message || body?.detail || body?.email?.[0] || this.i18n.t('ERR_UPDATE_PROFILE')
        );
      },
    });
  }

  updatePassword() {
    this.pwdError.set('');
    if (this.newPassword !== this.confirmPassword) {
      this.pwdError.set(this.i18n.t('ERR_PW_MATCH'));
      return;
    }
    this.savingPwd.set(true);
    this.api.changePassword({
      old_password: this.oldPassword,
      new_password: this.newPassword,
      new_password_confirm: this.confirmPassword,
    }).subscribe({
      next: () => {
        this.savingPwd.set(false);
        this.oldPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.toast.show(this.i18n.t('TOAST_PWD_UPDATED'), 'success');
      },
      error: (e: HttpErrorResponse) => {
        this.savingPwd.set(false);
        const body = e.error as ProfileErrorResponse | null;
        const msg =
          body?.old_password?.[0] ||
          body?.new_password?.[0] ||
          body?.message ||
          body?.detail ||
          this.i18n.t('ERR_CHANGE_PWD');
        this.pwdError.set(msg);
      },
    });
  }
}