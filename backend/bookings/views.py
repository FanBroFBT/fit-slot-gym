from datetime import date, datetime, timedelta
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db.models import Avg, Count, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from .clock import now_local

from . import services
from .models import Booking, Member, Payment, Profile, Review, Trainer
from .permissions import IsAdminRole, IsMemberRole, role_of
from .serializers import (BookingSerializer, MemberSerializer, ReviewSerializer, TrainerSerializer,
                          TransactionSerializer)


def auth_payload(user):
    token, _ = Token.objects.get_or_create(user=user)
    profile = user.profile
    name = profile.member.full_name if profile.member else "Administrator"
    return {"token": token.key, "role": profile.role, "name": name,
            "member_id": profile.member_id}


def error(code, message, http_status, **extra):
    return Response({"error": code, "message": message, **extra}, status=http_status)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        user = authenticate(username=request.data.get("email", ""), password=request.data.get("password", ""))
        if not user or not hasattr(user, "profile"):
            return error("invalid_credentials", "Wrong email or password.", 401)
        return Response(auth_payload(user))


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        password = str(request.data.get("password", ""))
        name = str(request.data.get("full_name", "")).strip()
        phone = str(request.data.get("phone", "")).strip()
        if not (email and name and phone) or "@" not in email:
            return error("invalid_data", "Name, phone and a valid email are required.", 422)
        if len(password) < 6:
            return error("invalid_data", "Password must have at least 6 characters.", 422)
        if User.objects.filter(username=email).exists():
            return error("email_taken", "This email is already registered.", 409)
        member = Member.objects.create(full_name=name, phone=phone, email=email, membership_status="Active",
                                       membership_end_date=date.today() + timedelta(days=365))
        user = User.objects.create_user(username=email, email=email, password=password)
        Profile.objects.create(user=user, role="member", member=member)
        return Response(auth_payload(user), status=201)


class TrainerListView(APIView):
    def get(self, request):
        qs = Trainer.objects.annotate(avg_rating=Avg("reviews__rating"), reviews_count=Count("reviews")).order_by("trainer_id")
        return Response(TrainerSerializer(qs, many=True).data)


class TrainerReviewsView(APIView):
    def get(self, request, trainer_id):
        trainer = get_object_or_404(Trainer, pk=trainer_id)
        reviews = Review.objects.filter(trainer=trainer).select_related("member")[:50]
        avg, count = services.trainer_rating(trainer)
        return Response({"trainer_id": trainer.trainer_id, "avg_rating": avg, "reviews_count": count,
                         "reviews": ReviewSerializer(reviews, many=True).data})


class TrainerSlotsView(APIView):
    def get(self, request, trainer_id):
        trainer = get_object_or_404(Trainer, pk=trainer_id)
        try:
            day = datetime.strptime(request.query_params.get("date", ""), "%Y-%m-%d").date()
        except ValueError:
            return error("invalid_date", "Use date=YYYY-MM-DD.", 422)
        return Response({"trainer_id": trainer.trainer_id, "date": day.isoformat(),
                         "slots": services.slots_for_day(trainer, day)})


class BookingCreateView(APIView):
    permission_classes = [IsMemberRole]

    def post(self, request):
        trainer = Trainer.objects.filter(pk=request.data.get("trainer_id")).first()
        if not trainer:
            return error("trainer_not_found", "Trainer not found.", 404)
        try:
            start = datetime.strptime(str(request.data.get("session_start", "")), "%Y-%m-%d %H:%M")
        except ValueError:
            return error("invalid_time", "Use session_start=YYYY-MM-DD HH:MM.", 422)
        try:
            booking = services.create_booking(
                request.user.profile.member, trainer, start,
                method=str(request.data.get("payment_method", "Card"))[:20],
                simulate_payment_failure=bool(request.data.get("simulate_payment_failure", False)))
        except services.BookingError as e:
            return Response(e.payload(), status=e.http_status)
        return Response(BookingSerializer(booking).data, status=201)


class MyBookingsView(APIView):
    permission_classes = [IsMemberRole]

    def get(self, request):
        qs = Booking.objects.filter(member=request.user.profile.member).select_related("trainer", "member", "payment", "review").order_by("-session_start")
        return Response(BookingSerializer(qs, many=True).data)


class BookingReviewView(APIView):
    """Member rates the trainer (1-5 stars + comment) after the session has finished."""
    permission_classes = [IsMemberRole]

    def post(self, request, booking_id):
        booking = get_object_or_404(Booking, pk=booking_id)
        if booking.member_id != request.user.profile.member_id:
            return error("forbidden", "This is not your booking.", 403)
        try:
            services.create_review(booking, request.data.get("rating"), request.data.get("comment"))
        except services.BookingError as e:
            return Response(e.payload(), status=e.http_status)
        booking = Booking.objects.select_related("trainer", "member", "payment", "review").get(pk=booking_id)
        return Response(BookingSerializer(booking).data, status=201)


class MyStatsView(APIView):
    """Workout history & analytics for the charts of the member's personal page."""
    permission_classes = [IsMemberRole]

    def get(self, request):
        return Response(services.member_stats(request.user.profile.member))


def wallet_payload(member):
    member.refresh_from_db()
    return {"balance_kzt": float(member.balance_kzt),
            "subscription_until": member.subscription_until,
            "has_subscription": member.has_subscription(),
            "plans": [{"key": k, "name": p["name"], "days": p["days"], "price_kzt": float(p["price"])}
                      for k, p in services.PLANS.items()],
            "session_price_kzt": float(services.SESSION_PRICE),
            "transactions": TransactionSerializer(member.transactions.all()[:30], many=True).data}


class WalletView(APIView):
    permission_classes = [IsMemberRole]

    def get(self, request):
        return Response(wallet_payload(request.user.profile.member))


class WalletTopUpView(APIView):
    permission_classes = [IsMemberRole]

    def post(self, request):
        member = request.user.profile.member
        try:
            services.top_up(member, request.data.get("amount"), str(request.data.get("payment_method", "Card"))[:20])
        except services.BookingError as e:
            return Response(e.payload(), status=e.http_status)
        return Response(wallet_payload(member), status=201)


class WalletSubscribeView(APIView):
    permission_classes = [IsMemberRole]

    def post(self, request):
        member = request.user.profile.member
        try:
            services.buy_subscription(member, request.data.get("plan"))
        except services.BookingError as e:
            return Response(e.payload(), status=e.http_status)
        return Response(wallet_payload(member), status=201)


class CancelBookingView(APIView):
    def post(self, request, booking_id):
        booking = get_object_or_404(Booking, pk=booking_id)
        is_admin = role_of(request.user) == "admin"
        if not is_admin and booking.member_id != request.user.profile.member_id:
            return error("forbidden", "This is not your booking.", 403)
        try:
            services.cancel_booking(booking)
        except services.BookingError as e:
            return Response(e.payload(), status=e.http_status)
        return Response(BookingSerializer(booking).data)


class AdminBookingsView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        qs = Booking.objects.select_related("trainer", "member", "payment", "review").order_by("-session_start")
        for param, field in (("trainer", "trainer_id"), ("status", "status")):
            if request.query_params.get(param):
                qs = qs.filter(**{field: request.query_params[param]})
        return Response(BookingSerializer(qs, many=True).data)


class AdminMembersView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        return Response(MemberSerializer(Member.objects.order_by("member_id"), many=True).data)


class AdminMemberStatusView(APIView):
    permission_classes = [IsAdminRole]

    def patch(self, request, member_id):
        member = get_object_or_404(Member, pk=member_id)
        new_status = request.data.get("membership_status")
        if new_status not in ("Active", "Frozen", "Expired"):
            return error("invalid_data", "Status must be Active, Frozen or Expired.", 422)
        member.membership_status = new_status
        member.save(update_fields=["membership_status"])
        return Response(MemberSerializer(member).data)


def busiest(year, month):
    """SQL idea from Task 9: confirmed bookings per trainer in one month."""
    start = datetime(year, month, 1)
    end = datetime(year + (month == 12), month % 12 + 1, 1)
    rows = (Booking.objects.filter(status="Confirmed", session_start__gte=start, session_start__lt=end)
            .values("trainer_id", "trainer__full_name").annotate(total_bookings=Count("booking_id"))
            .order_by("-total_bookings"))
    return [{"trainer_id": r["trainer_id"], "trainer_name": r["trainer__full_name"],
             "total_bookings": r["total_bookings"]} for r in rows]


class AdminBusiestView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        now = now_local()
        try:
            year, month = int(request.query_params.get("year", now.year)), int(request.query_params.get("month", now.month))
            return Response(busiest(year, month))
        except ValueError:
            return error("invalid_data", "year and month must be numbers.", 422)


class AdminSummaryView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        now = now_local()
        today = Booking.objects.filter(session_start__date=now.date()).exclude(status="Cancelled").count()
        month_qs = Booking.objects.filter(session_start__year=now.year, session_start__month=now.month)
        total, cancelled = month_qs.count(), month_qs.filter(status="Cancelled").count()
        revenue = Payment.objects.filter(payment_status="Paid", booking__session_start__year=now.year,
                                         booking__session_start__month=now.month).aggregate(s=Sum("amount_kzt"))["s"] or 0
        return Response({"bookings_today": today, "active_members": Member.objects.filter(membership_status="Active").count(),
                         "revenue_month_kzt": float(revenue),
                         "cancellation_rate": round(cancelled / total * 100, 1) if total else 0,
                         "busiest_trainers": busiest(now.year, now.month)})
