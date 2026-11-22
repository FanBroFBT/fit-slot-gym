import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ApiError } from '../core/models';
import { ToastService } from '../core/toast.service';
import { ThemeService } from '../core/theme.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
  <section class="login-layout">
    <div class="login-intro">
      <div class="hero-kicker">✦ FITSLOT · TRAIN SMARTER</div>
      <h1>Your next workout <span class="accent">starts here.</span></h1>
      <p class="login-lead">Find a trainer, choose your time, and book in minutes. One place for every step of your fitness journey.</p>
      <div class="login-benefits">
        <span>✓ Live training slots</span><span>✓ Flexible booking</span><span>✓ Personal AI coach</span>
      </div>
      <div class="login-mascot-wrap">
        <div class="login-mascot-orbit" aria-hidden="true"></div>
        <img [src]="themeSvc.current() === 'neon' ? '/mascot/fitslot-neon.webp' : '/mascot/fitslot-default.webp'"
          alt="FitSlot tiger mascot wearing a training outfit" width="380" height="507" fetchpriority="high" />
        <div class="login-mascot-hello"><strong>Meet our mascot!</strong><span>Your friendly workout companion.</span></div>
      </div>
    </div>
    <div class="card login-card">
      <div class="login-card-top"><span class="brand-dot">F</span><span class="muted">WELCOME TO FITSLOT</span></div>
      <h2>{{ mode() === 'login' ? 'Welcome back' : 'Join FitSlot' }}</h2>
      <p>{{ mode() === 'login' ? 'Log in to book your next session.' : 'Create your account and start training.' }}</p>
      <div class="row login-tabs">
        <button type="button" class="chip" [class.on]="mode() === 'login'" (click)="mode.set('login')">Log in</button>
        <button type="button" class="chip" [class.on]="mode() === 'register'" (click)="mode.set('register')">Sign up</button>
      </div>
      <form (ngSubmit)="submit()">
        @if (mode() === 'register') {
          <label for="n">Full name</label><input id="n" name="n" [(ngModel)]="fullName" required autocomplete="name" />
          <label for="p">Phone</label><input id="p" name="p" [(ngModel)]="phone" required autocomplete="tel" />
        }
        <label for="e">Email</label><input id="e" name="e" type="email" [(ngModel)]="email" required autocomplete="username" />
        <label for="pw">Password</label><input id="pw" name="pw" type="password" [(ngModel)]="password" required [attr.autocomplete]="mode() === 'login' ? 'current-password' : 'new-password'" />
        @if (error()) { <div class="alert alert-error mt-s" role="alert">{{ error() }}</div> }
        <button class="btn btn-primary mt login-submit" [disabled]="busy()">{{ mode() === 'login' ? 'Log in' : 'Create account' }}</button>
      </form>
      <div class="login-demo"><p class="muted">Demo accounts:</p>
        <div class="row"><button class="btn btn-sm" type="button" (click)="demo('member@gym.kz', 'member123')">Member</button>
        <button class="btn btn-sm" type="button" (click)="demo('admin@gym.kz', 'admin123')">Admin</button></div>
      </div>
    </div>
  </section>`,
  styles: `
    .login-layout{display:grid;grid-template-columns:minmax(0,1.18fr) minmax(320px,.82fr);gap:clamp(18px,5vw,72px);align-items:center;min-height:calc(100vh - 185px)}
    .login-intro{position:relative;min-height:620px;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-start;padding-top:35px}
    .hero-kicker{display:inline-block;color:var(--primary);font-weight:850;letter-spacing:.17em;font-size:.75rem;margin-bottom:17px}
    .login-intro h1{max-width:640px;font-size:clamp(2.3rem,4.7vw,4.6rem);line-height:1.06}
    .login-lead{font-size:1.07rem;max-width:580px;margin:14px 0 19px}
    .login-benefits{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:15px}
    .login-benefits span{border:1px solid var(--border);background:var(--surface);border-radius:100px;padding:8px 11px;color:var(--text);font-size:.78rem;font-weight:700}
    .login-mascot-wrap{position:relative;align-self:center;width:min(100%,630px);height:315px;margin-top:12px;display:flex;justify-content:center;align-items:flex-end}
    .login-mascot-orbit{position:absolute;bottom:0;width:min(460px,90%);height:235px;border-radius:55% 55% 8% 8%;background:radial-gradient(ellipse at 50% 80%,var(--glow),transparent 72%);border-bottom:2px solid var(--primary);opacity:.65}
    .login-mascot-wrap img{position:relative;max-width:345px;width:55%;height:338px;object-fit:contain;object-position:bottom;filter:drop-shadow(0 24px 27px rgba(0,0,0,.22))}
    .login-mascot-hello{position:absolute;right:0;bottom:67px;display:grid;gap:3px;padding:12px 17px;background:var(--surface);border:1px solid var(--border);border-radius:14px;box-shadow:var(--shadow);font-size:.84rem}
    .login-mascot-hello strong{color:var(--primary)}.login-mascot-hello span{color:var(--muted)}
    .login-card{padding:clamp(22px,3.5vw,38px);box-shadow:var(--shadow);border-radius:24px}
    .login-card h2{font-size:2rem;margin:14px 0 4px}
    .login-card-top{display:flex;align-items:center;gap:11px;font-size:.77rem;font-weight:800;letter-spacing:.1em}
    .brand-dot{display:grid;place-items:center;width:36px;height:36px;background:var(--primary);color:var(--primary-ink);border-radius:11px;font-weight:950;font-size:1.4rem}
    .login-tabs{margin:26px 0 18px}.login-tabs .chip{flex:1}.login-submit{width:100%;min-height:46px}
    .login-demo{margin-top:25px;border-top:1px solid var(--border);padding-top:15px}
    @media(max-width:850px){.login-layout{grid-template-columns:1fr;gap:15px}.login-intro{min-height:0;padding-top:10px}.login-mascot-wrap{height:250px}.login-mascot-wrap img{height:260px}.login-card{max-width:640px;width:100%;margin:0 auto}}
    @media(max-width:520px){.login-intro h1{font-size:2.25rem}.login-lead{font-size:.94rem}.login-mascot-wrap{height:170px}.login-mascot-wrap img{height:195px}.login-mascot-hello{font-size:.7rem;right:0;bottom:30px;padding:7px}.login-benefits{gap:5px}.login-benefits span{font-size:.7rem;padding:6px}.login-card{padding:21px}}
  `
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);
  themeSvc = inject(ThemeService);
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
