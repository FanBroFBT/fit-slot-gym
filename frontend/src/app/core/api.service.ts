import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AuthInfo, Booking, CreateBookingBody, Member, MembershipStatus, SlotsResponse, Summary, Trainer, BusiestTrainer,
  MyStats, TrainerReviews, Wallet
} from './models';

/** All API requests of the website are here. Components never call HttpClient directly. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = '/api';

  login(email: string, password: string): Observable<AuthInfo> {
    return this.http.post<AuthInfo>(`${this.base}/login/`, { email, password });
  }
  register(body: { full_name: string; phone: string; email: string; password: string }): Observable<AuthInfo> {
    return this.http.post<AuthInfo>(`${this.base}/register/`, body);
  }
  trainers(): Observable<Trainer[]> {
    return this.http.get<Trainer[]>(`${this.base}/trainers/`);
  }
  slots(trainerId: string, date: string): Observable<SlotsResponse> {
    return this.http.get<SlotsResponse>(`${this.base}/trainers/${trainerId}/slots/`, { params: { date } });
  }
  createBooking(body: CreateBookingBody): Observable<Booking> {
    return this.http.post<Booking>(`${this.base}/bookings/`, body);
  }
  myBookings(): Observable<Booking[]> {
    return this.http.get<Booking[]>(`${this.base}/bookings/my/`);
  }
  cancelBooking(id: string): Observable<Booking> {
    return this.http.post<Booking>(`${this.base}/bookings/${id}/cancel/`, {});
  }
  adminBookings(filters: { trainer?: string; status?: string } = {}): Observable<Booking[]> {
    let params = new HttpParams();
    if (filters.trainer) params = params.set('trainer', filters.trainer);
    if (filters.status) params = params.set('status', filters.status);
    return this.http.get<Booking[]>(`${this.base}/admin/bookings/`, { params });
  }
  adminMembers(): Observable<Member[]> {
    return this.http.get<Member[]>(`${this.base}/admin/members/`);
  }
  setMemberStatus(id: string, membership_status: MembershipStatus): Observable<Member> {
    return this.http.patch<Member>(`${this.base}/admin/members/${id}/status/`, { membership_status });
  }
  adminSummary(): Observable<Summary> {
    return this.http.get<Summary>(`${this.base}/admin/summary/`);
  }
  busiest(year: number, month: number): Observable<BusiestTrainer[]> {
    return this.http.get<BusiestTrainer[]>(`${this.base}/admin/busiest-trainers/`, { params: { year, month } });
  }

  // --- wallet & membership
  wallet(): Observable<Wallet> { return this.http.get<Wallet>(`${this.base}/wallet/`); }
  topUp(amount: number, payment_method: string): Observable<Wallet> {
    return this.http.post<Wallet>(`${this.base}/wallet/topup/`, { amount, payment_method });
  }
  subscribe(plan: string): Observable<Wallet> { return this.http.post<Wallet>(`${this.base}/wallet/subscribe/`, { plan }); }
  // --- reviews & statistics
  trainerReviews(id: string): Observable<TrainerReviews> { return this.http.get<TrainerReviews>(`${this.base}/trainers/${id}/reviews/`); }
  reviewBooking(id: string, rating: number, comment: string): Observable<Booking> {
    return this.http.post<Booking>(`${this.base}/bookings/${id}/review/`, { rating, comment });
  }
  myStats(): Observable<MyStats> { return this.http.get<MyStats>(`${this.base}/stats/my/`); }
}
