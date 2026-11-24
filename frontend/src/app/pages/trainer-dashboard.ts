import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { I18nService } from '../core/i18n.service';
import { ApiError, Booking, Certificate, Trainer } from '../core/models';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-trainer-dashboard',
  imports: [FormsModule],
  template: `
  <h2>{{ i18n.t('My trainer profile') }}</h2>

  <div class="grid grid-3 mt">
    <form class="card profile-form" (ngSubmit)="save()">
      <h3>{{ i18n.t('Working info') }}</h3>
      <label>{{ i18n.t('Working hours') }} (HH:MM-HH:MM)</label>
      <input [(ngModel)]="workingHours" name="workingHours" required placeholder="09:00-18:00" />
      <label>{{ i18n.t('Phone') }}</label>
      <input [(ngModel)]="phone" name="phone" />
      <label>{{ i18n.t('Experience (years)') }}</label>
      <input [(ngModel)]="experienceYears" name="experienceYears" type="number" min="0" />
      <label>{{ i18n.t('Photo URL') }}</label>
      <input [(ngModel)]="photo" name="photo" />
      <label>{{ i18n.t('Bio') }}</label>
      <textarea [(ngModel)]="bio" name="bio" rows="4"></textarea>
      <button class="btn btn-primary mt" type="submit" [disabled]="busy()">{{ i18n.t('Save changes') }}</button>
    </form>

    <div class="card">
      <h3>{{ i18n.t('Certificates') }}</h3>
      <div class="grid" style="gap: 8px; margin-top: 8px;">
        @for (c of certificates(); track c.id) {
          <div class="row between" style="border:1px solid var(--border); border-radius:8px; padding:8px;">
            <div>
              <strong>{{ c.title }}</strong>
              <p class="muted" style="margin:2px 0 0; font-size:.85rem;">{{ c.issuer }} · {{ c.year }}</p>
              @if (c.file) {
                <a [href]="c.file" target="_blank" style="font-size:.8rem;">{{ i18n.t('View file') }}</a>
              }
            </div>
            <button class="btn btn-danger btn-sm" (click)="removeCertificate(c.id)">✕</button>
          </div>
        } @empty { <p class="muted">{{ i18n.t('No certificates yet') }}</p> }
      </div>

      <form class="mt" (ngSubmit)="addCert()">
        <label>{{ i18n.t('Title') }}</label>
        <input [(ngModel)]="newTitle" name="newTitle" required />
        <label>{{ i18n.t('Issuer') }}</label>
        <input [(ngModel)]="newIssuer" name="newIssuer" required />
        <label>{{ i18n.t('Year') }}</label>
        <input [(ngModel)]="newYear" name="newYear" type="number" required />
        <label>{{ i18n.t('Credential ID') }}</label>
        <input [(ngModel)]="newCredentialId" name="newCredentialId" />
        <label>{{ i18n.t('Certificate file') }}</label>
        <input type="file" accept=".pdf,.jpg,.jpeg,.png" (change)="onFileSelected($event)" />
        <button class="btn btn-primary mt" type="submit" [disabled]="certBusy()">{{ i18n.t('Add certificate') }}</button>
      </form>
    </div>

    <div class="card">
      <h3>{{ i18n.t('My bookings') }}</h3>
      <div class="grid" style="gap: 8px; margin-top: 8px;">
        @for (b of bookings(); track b.booking_id) {
          <div style="border:1px solid var(--border); border-radius:8px; padding:8px;">
            <strong>{{ b.member_name }}</strong> <span class="badge b-{{ b.status }}">{{ b.status }}</span>
            <p class="muted" style="margin:2px 0 0; font-size:.85rem;">{{ b.session_start }}</p>
          </div>
        } @empty { <p class="muted">{{ i18n.t('No bookings yet') }}</p> }
      </div>
    </div>
  </div>
  `,
  styles: `.profile-form{display:block}.profile-form input,.profile-form textarea{max-width:100%;width:100%}`
})
export class TrainerDashboardComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  i18n = inject(I18nService);

  busy = signal(false);
  certBusy = signal(false);
  certificates = signal<Certificate[]>([]);
  bookings = signal<Booking[]>([]);

  workingHours = ''; phone = ''; bio = ''; experienceYears = 0; photo = '';
  newTitle = ''; newIssuer = ''; newYear = new Date().getFullYear(); newCredentialId = '';
  selectedFile: File | null = null;

  ngOnInit() {
    this.api.myTrainerProfile().subscribe((t: Trainer) => {
      this.workingHours = t.working_hours;
      this.phone = t.phone ?? '';
      this.bio = t.bio;
      this.experienceYears = t.experience_years;
      this.photo = t.photo ?? '';
      this.certificates.set(t.certificates);
    });
    this.api.trainerMyBookings().subscribe(b => this.bookings.set(b));
  }

  save() {
    this.busy.set(true);
    this.api.updateTrainerProfile({
      working_hours: this.workingHours, phone: this.phone, bio: this.bio,
      experience_years: this.experienceYears, photo: this.photo,
    }).subscribe({
      next: () => { this.busy.set(false); this.toast.show(this.i18n.t('Profile updated'), 'success'); },
      error: (e: HttpErrorResponse) => { this.busy.set(false); this.toast.show((e.error as ApiError)?.message ?? this.i18n.t('Operation failed'), 'error'); }
    });
  }

  onFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
  }

  addCert() {
    if (!this.newTitle || !this.newIssuer || !this.newYear) return;
    this.certBusy.set(true);
    this.api.addCertificate({
      title: this.newTitle, issuer: this.newIssuer, year: this.newYear, credential_id: this.newCredentialId,
    }, this.selectedFile ?? undefined).subscribe({
      next: (list) => {
        this.certBusy.set(false);
        this.certificates.set(list);
        this.newTitle = ''; this.newIssuer = ''; this.newCredentialId = ''; this.selectedFile = null;
        this.toast.show(this.i18n.t('Certificate added'), 'success');
      },
      error: (e: HttpErrorResponse) => { this.certBusy.set(false); this.toast.show((e.error as ApiError)?.message ?? this.i18n.t('Operation failed'), 'error'); }
    });
  }

  removeCertificate(id: number) {
    this.api.deleteCertificate(id).subscribe({
      next: () => this.certificates.update(list => list.filter(c => c.id !== id)),
      error: () => this.toast.show(this.i18n.t('Operation failed'), 'error')
    });
  }
}