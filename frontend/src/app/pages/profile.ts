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
      <h2>My profile</h2>
      <p class="muted">Manage your personal details, membership status, and password.</p>
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
        <p>Member ID</p>
        <h2 class="accent">{{ p.member_id }}</h2>
      </div>
      <div class="card">
        <p>Membership valid until</p>
        <h3>
          @if (p.membership_end_date; as endDate) {
            {{ endDate | date: 'd MMM y' }}
          } @else {
            No active plan
          }
        </h3>
      </div>
      <div class="card">
        <p>Wallet balance</p>
        <h3>{{ wallet()?.balance_kzt ?? 0 }} <small class="muted">KZT</small></h3>
      </div>
      <div class="card">
        <p>Finished sessions</p>
        <h3>{{ stats()?.total_sessions ?? 0 }} <small class="muted">({{ stats()?.total_hours ?? 0 }} h)</small></h3>
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
          <label for="pf-name">Full name</label>
          <input id="pf-name" name="full_name" [(ngModel)]="form.full_name" required />

          <label for="pf-phone">Phone</label>
          <input id="pf-phone" name="phone" [(ngModel)]="form.phone" required />

          <label for="pf-email">Email</label>
          <input id="pf-email" name="email" type="email" [(ngModel)]="form.email" required />

          @if (profileError()) {
            <div class="alert alert-error mt-s">{{ profileError() }}</div>
          }

          <div class="row mt" style="justify-content: space-between;">
            <button class="btn btn-primary" [disabled]="savingProfile()">
              {{ savingProfile() ? 'Saving…' : 'Save changes' }}
            </button>
            <a class="btn" routerLink="/wallet">Manage wallet →</a>
          </div>
        </form>
      </div>

      <!-- 2. Парольді ауыстыру -->
      <div class="card">
        <h3>Change password</h3>
        <p class="muted" style="font-size: .9rem;">Keep your account secure with a strong password.</p>

        <form (ngSubmit)="updatePassword()">
          <label for="old-pw">Current password</label>
          <input
            id="old-pw"
            name="old_password"
            [type]="showPwd() ? 'text' : 'password'"
            [(ngModel)]="oldPassword"
            required
          />

          <label for="new-pw">New password</label>
          <div class="pwd-wrap">
            <input
              id="new-pw"
              name="new_password"
              [type]="showPwd() ? 'text' : 'password'"
              [(ngModel)]="newPassword"
              required
            />
            <button type="button" class="btn btn-sm" (click)="showPwd.set(!showPwd())">
              {{ showPwd() ? 'Hide' : 'Show' }}
            </button>
          </div>

          <label for="conf-pw">Confirm new password</label>
          <input
            id="conf-pw"
            name="confirm_password"
            [type]="showPwd() ? 'text' : 'password'"
            [(ngModel)]="confirmPassword"
            required
          />

          <div class="pwd-rules mt-s">
            <ul>
              <li [class.valid]="rules.minLength">{{ rules.minLength ? '✔' : '○' }} 8–64 characters</li>
              <li [class.valid]="rules.hasUpper">{{ rules.hasUpper ? '✔' : '○' }} At least 1 uppercase letter (A–Z)</li>
              <li [class.valid]="rules.hasLower">{{ rules.hasLower ? '✔' : '○' }} At least 1 lowercase letter (a–z)</li>
              <li [class.valid]="rules.hasDigit">{{ rules.hasDigit ? '✔' : '○' }} At least 1 digit (0–9)</li>
              <li [class.valid]="rules.hasSpecial">{{ rules.hasSpecial ? '✔' : '○' }} At least 1 special character (!&#64;#$%...)</li>
              <li [class.valid]="rules.notPersonal">{{ rules.notPersonal ? '✔' : '○' }} Does not contain your email or name</li>
            </ul>
          </div>

          @if (pwdError()) {
            <div class="alert alert-error mt-s">{{ pwdError() }}</div>
          }

          <button class="btn btn-primary mt" style="width: 100%;" [disabled]="savingPwd() || !canChangePassword">
            {{ savingPwd() ? 'Updating…' : 'Update password' }}
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
        this.toast.show('Profile updated', 'success');
      },
      error: (e: HttpErrorResponse) => {
        this.savingProfile.set(false);
        const body = e.error as ProfileErrorResponse | null;
        this.profileError.set(
          body?.message || body?.detail || body?.email?.[0] || 'Could not update profile.'
        );
      },
    });
  }

  updatePassword() {
    this.pwdError.set('');
    if (this.newPassword !== this.confirmPassword) {
      this.pwdError.set('New passwords do not match.');
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
        this.toast.show('Password updated successfully', 'success');
      },
      error: (e: HttpErrorResponse) => {
        this.savingPwd.set(false);
        const body = e.error as ProfileErrorResponse | null;
        const msg =
          body?.old_password?.[0] ||
          body?.new_password?.[0] ||
          body?.message ||
          body?.detail ||
          'Could not change password.';
        this.pwdError.set(msg);
      },
    });
  }
}