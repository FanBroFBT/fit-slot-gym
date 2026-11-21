import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { I18nService } from '../core/i18n.service';
import { ApiError } from '../core/models';
import { ToastService } from '../core/toast.service';
@Component({
  selector: 'app-profile', imports: [FormsModule],
  template: `
    <h2>{{i18n.t('My profile')}}</h2>
    <div class="grid grid-3 mt">
      <form class="card profile-form" (ngSubmit)="save()">
        <h3>{{i18n.t('Personal information')}}</h3>
        <label>{{i18n.t('Full name')}}</label><input [(ngModel)]="name" name="name" required maxlength="100" />
        <label>Email</label><input [(ngModel)]="email" name="email" type="email" required />
        <label>{{i18n.t('Phone')}}</label><input [(ngModel)]="phone" name="phone" required />
        <button class="btn btn-primary mt" type="submit" [disabled]="busy()">{{i18n.t('Save changes')}}</button>
      </form>
      <form class="card profile-form" (ngSubmit)="changePassword()">
        <h3>{{i18n.t('Change password')}}</h3>
        <label>{{i18n.t('Old password')}}</label><input [(ngModel)]="oldPassword" name="old" type="password" required />
        <label>{{i18n.t('New password')}}</label><input [(ngModel)]="newPassword" name="new" type="password" required minlength="8" maxlength="64" />
        <label>{{i18n.t('Confirm password')}}</label><input [(ngModel)]="confirm" name="confirm" type="password" required />
        <button class="btn btn-primary mt" type="submit" [disabled]="busy()">{{i18n.t('Update password')}}</button>
      </form>
    </div>
  `,
  styles: `.profile-form{display:block}.profile-form input{max-width:100%}`
})
export class ProfileComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  i18n = inject(I18nService);
  busy = signal(false);
  name='';phone='';email='';oldPassword='';newPassword='';confirm='';
  ngOnInit(){this.api.myProfile().subscribe({next:m=>{this.name=m.full_name;this.phone=m.phone;this.email=m.email??'';}});}
  save(){
    this.busy.set(true);
    this.api.updateProfile({full_name:this.name,phone:this.phone,email:this.email}).subscribe({next:()=>{this.busy.set(false);this.toast.show(this.i18n.t('Profile updated'),'success');},error:(e:HttpErrorResponse)=>this.failed(e)});
  }
  changePassword(){
    if(this.newPassword!==this.confirm){this.toast.show(this.i18n.t('Passwords do not match'),'error');return;}
    this.busy.set(true);
    this.api.changePassword({old_password:this.oldPassword,new_password:this.newPassword,new_password_confirm:this.confirm}).subscribe({
      next:()=>{this.busy.set(false);this.oldPassword='';this.newPassword='';this.confirm='';this.toast.show(this.i18n.t('Password updated'),'success');},
      error:(e:HttpErrorResponse)=>this.failed(e)
    });
  }
  private failed(e:HttpErrorResponse){this.busy.set(false);this.toast.show((e.error as ApiError)?.message??this.i18n.t('Operation failed'),'error');}
}
