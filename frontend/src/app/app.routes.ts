import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', loadComponent: () => import('./pages/login').then(m => m.LoginComponent) },
  { path: 'book', canActivate: [roleGuard('member')], loadComponent: () => import('./pages/book').then(m => m.BookComponent) },
  { path: 'my-bookings', canActivate: [roleGuard('member')], loadComponent: () => import('./pages/my-bookings').then(m => m.MyBookingsComponent) },
  { path: 'admin', canActivate: [roleGuard('admin')], loadComponent: () => import('./pages/admin').then(m => m.AdminComponent) },
  { path: 'stats', canActivate: [roleGuard('member')], loadComponent: () => import('./pages/stats').then(m => m.StatsComponent) },
  { path: 'wallet', canActivate: [roleGuard('member')], loadComponent: () => import('./pages/wallet').then(m => m.WalletComponent) },

  // Жаңадан қосылған News беті (жүйеге кірген мүшелер немесе кез келген авторизацияланған қолданушы үшін)
  { path: 'news', canActivate: [authGuard], loadComponent: () => import('./pages/news').then(m => m.NewsComponent) },

  { path: '**', canActivate: [authGuard], loadComponent: () => import('./pages/not-found').then(m => m.NotFoundComponent) },
];