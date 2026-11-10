from django.urls import path
from . import views as v

urlpatterns = [
    path("login/", v.LoginView.as_view()),
    path("register/", v.RegisterView.as_view()),
    path("trainers/", v.TrainerListView.as_view()),
    path("trainers/<str:trainer_id>/slots/", v.TrainerSlotsView.as_view()),
    path("trainers/<str:trainer_id>/reviews/", v.TrainerReviewsView.as_view()),
    path("bookings/", v.BookingCreateView.as_view()),
    path("bookings/my/", v.MyBookingsView.as_view()),
    path("bookings/<str:booking_id>/cancel/", v.CancelBookingView.as_view()),
    path("bookings/<str:booking_id>/review/", v.BookingReviewView.as_view()),
    path("stats/my/", v.MyStatsView.as_view()),
    path("wallet/", v.WalletView.as_view()),
    path("wallet/topup/", v.WalletTopUpView.as_view()),
    path("wallet/subscribe/", v.WalletSubscribeView.as_view()),
    path("admin/bookings/", v.AdminBookingsView.as_view()),
    path("admin/members/", v.AdminMembersView.as_view()),
    path("admin/members/<str:member_id>/status/", v.AdminMemberStatusView.as_view()),
    path("admin/busiest-trainers/", v.AdminBusiestView.as_view()),
    path("admin/summary/", v.AdminSummaryView.as_view()),
]
