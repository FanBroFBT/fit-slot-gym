import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Role } from './models';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.user() ? true : inject(Router).parseUrl('/login');
};

export const roleGuard = (roles: Role | Role[]): CanActivateFn => () => {
  const auth = inject(AuthService);
  if (!auth.user()) return inject(Router).parseUrl('/login');
  const allowed = Array.isArray(roles) ? roles : [roles];
  return auth.role() && allowed.includes(auth.role()!) ? true : inject(Router).parseUrl(auth.home());
};