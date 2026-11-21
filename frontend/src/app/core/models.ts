export type Role = 'member' | 'admin';
export type TrainingType = 'individual' | 'group';
export type BookingStatus = 'Confirmed' | 'Cancelled' | 'Completed';
export type MembershipStatus = 'Active' | 'Frozen' | 'Expired';
export interface AuthInfo { token: string; role: Role; name: string; member_id: string | null; }
export interface Certificate { id: number; title: string; issuer: string; year: number; credential_id: string; }
export interface Trainer {
  trainer_id: string; full_name: string; specialization: string; working_hours: string;
  photo?: string; phone?: string; bio: string; experience_years: number;
  avg_rating: number | null; reviews_count: number;
  rating_breakdown: Record<string, number>; certificates: Certificate[];
  reviews?: Review[];
}
export interface Slot {
  time: string; available: boolean; spots_taken: number; max_capacity: number;
  remaining_spots: number; slot_mode: TrainingType | null;
}
export interface SlotsResponse { trainer_id: string; date: string; slots: Slot[]; }
export interface Booking {
  booking_id: string; member_id: string; member_name: string;
  trainer_id: string; trainer_name: string; specialization: string;
  session_start: string; status: BookingStatus; training_type: TrainingType;
  amount_kzt: string | null; payment_status: string | null; payment_method?: string | null;
  can_cancel: boolean; can_review?: boolean; review?: { rating: number; comment: string } | null;
  refund_info?: { refund_percent: number; refunded_kzt: number; payment_status: string | null };
}
export interface Member {
  member_id: string; full_name: string; phone: string; email: string | null;
  membership_status: MembershipStatus; membership_end_date: string | null;
}
export interface BusiestTrainer { trainer_id: string; trainer_name: string; total_bookings: number; }
export interface Summary {
  bookings_today: number; active_members: number; revenue_month_kzt: number;
  cancellation_rate: number; busiest_trainers: BusiestTrainer[];
}
export interface CreateBookingBody {
  trainer_id: string; session_start: string; payment_method: string;
  training_type: TrainingType; simulate_payment_failure: boolean;
}
export interface ApiError { error: string; message: string; alternatives?: string[]; }
export interface NotificationItem {
  id: number; title: string; message: string; notif_type: 'booking'|'refund'|'loyalty'|'reminder'|'system';
  is_read: boolean; created_at: string; booking_id: string | null;
}
export interface NotificationsResponse { notifications: NotificationItem[]; unread_count: number; }
export interface AIReply { reply: string; trainer_id: string | null; lang: 'kk'|'ru'|'en'; provider: string; provider_error: string | null; }
export interface Review { id: number; booking_id: string; member_name: string; rating: number; comment: string; created_at: string; }
export interface TrainerReviews { trainer_id: string; avg_rating: number | null; reviews_count: number; reviews: Review[]; }
export interface WalletTransaction { id: number; kind: string; amount_kzt: string; description: string; balance_after: string; created_at: string; }
export interface Plan { key: string; name: string; days: number; price_kzt: number; }
export interface Wallet {
  balance_kzt: number; subscription_until: string | null; has_subscription: boolean;
  plans: Plan[]; session_price_kzt: number; transactions: WalletTransaction[];
}
export interface MyStats {
  total_sessions: number; total_hours: number; upcoming: number; spent_kzt: number;
  favorite_trainer: string | null;
  by_trainer: { trainer_id: string; trainer_name: string; sessions: number; hours: number }[];
  by_month: { month: string; sessions: number }[];
  loyalty_progress: number; loyalty_remaining: number;
}
