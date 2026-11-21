
from datetime import date, datetime, timedelta
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.throttling import ScopedRateThrottle
from django.db.models import Avg, Count, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services, ai_coach
from .models import Booking, Member, Notification, Payment, Profile, Review, Trainer
from .permissions import IsAdminRole, IsMemberRole, role_of
from .serializers import BookingSerializer, MemberSerializer, NotificationSerializer, ReviewSerializer, TrainerSerializer, TransactionSerializer


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
    throttle_scope = 'login'
    throttle_classes = [ScopedRateThrottle]

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
        try:
            validate_password(password, user=User(username=email, email=email, first_name=name))
        except DjangoValidationError as exc:
            return error('weak_password', exc.messages[0], 422)
        if User.objects.filter(username=email).exists():
            return error("email_taken", "This email is already registered.", 409)
        member = Member.objects.create(full_name=name, phone=phone, email=email, membership_status="Active",
                                       membership_end_date=date.today() + timedelta(days=365))
        user = User.objects.create_user(username=email, email=email, password=password)
        Profile.objects.create(user=user, role="member", member=member)
        return Response(auth_payload(user), status=201)


class TrainerListView(APIView):
    def get(self, request):
        trainers = Trainer.objects.prefetch_related('certificates', 'reviews').annotate(
            avg_rating=Avg('reviews__rating'), reviews_count=Count('reviews')).order_by('trainer_id')
        return Response(TrainerSerializer(trainers, many=True).data)


class TrainerDetailView(APIView):
    def get(self, request, trainer_id):
        trainer = get_object_or_404(Trainer.objects.prefetch_related('certificates', 'reviews'), pk=trainer_id)
        result = TrainerSerializer(trainer).data
        result['reviews'] = ReviewSerializer(trainer.reviews.select_related('member'), many=True).data
        return Response(result)


class TrainerReviewsView(APIView):
    def get(self, request, trainer_id):
        trainer = get_object_or_404(Trainer, pk=trainer_id)
        avg, count = services.trainer_rating(trainer)
        return Response({'trainer_id': trainer.pk, 'avg_rating': avg, 'reviews_count': count,
                         'reviews': ReviewSerializer(trainer.reviews.select_related('member'), many=True).data})


class TrainerSlotsView(APIView):
    def get(self, request, trainer_id):
        trainer = get_object_or_404(Trainer, pk=trainer_id)
        try:
            day = datetime.strptime(request.query_params.get("date", ""), "%Y-%m-%d").date()
        except ValueError:
            return error("invalid_date", "Use date=YYYY-MM-DD.", 422)
        try:
            slots = services.slots_for_day(trainer, day, request.query_params.get('training_type', 'individual'))
        except services.BookingError as e:
            return Response(e.payload(), status=e.http_status)
        return Response({'trainer_id': trainer.trainer_id, 'date': day.isoformat(), 'slots': slots})


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
                simulate_payment_failure=request.data.get("simulate_payment_failure") is True,
                training_type=str(request.data.get("training_type", "individual")))
        except services.BookingError as e:
            return Response(e.payload(), status=e.http_status)
        return Response(BookingSerializer(booking).data, status=201)


class MyBookingsView(APIView):
    permission_classes = [IsMemberRole]

    def get(self, request):
        qs = Booking.objects.filter(member=request.user.profile.member).select_related("trainer", "member", "payment").order_by("-session_start")
        return Response(BookingSerializer(qs, many=True).data)


class CancelBookingView(APIView):
    def post(self, request, booking_id):
        booking = get_object_or_404(Booking, pk=booking_id)
        is_admin = role_of(request.user) == "admin"
        if not is_admin and booking.member_id != request.user.profile.member_id:
            return error("forbidden", "This is not your booking.", 403)
        try:
            if request.data.get('choice') == 'reschedule':
                try:
                    start = datetime.strptime(str(request.data.get('new_session_start', '')), '%Y-%m-%d %H:%M')
                except ValueError:
                    return error('invalid_time', 'Use new_session_start=YYYY-MM-DD HH:MM.', 422)
                booking = services.reschedule_booking(booking, start)
                return Response(BookingSerializer(booking).data)
            booking, refund_info = services.cancel_booking(booking)
        except services.BookingError as e:
            return Response(e.payload(), status=e.http_status)
        payload = BookingSerializer(booking).data
        payload['refund_info'] = refund_info
        return Response(payload)


class AdminBookingsView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        qs = Booking.objects.select_related("trainer", "member", "payment").order_by("-session_start")
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
        now = timezone.now()
        try:
            year, month = int(request.query_params.get("year", now.year)), int(request.query_params.get("month", now.month))
            return Response(busiest(year, month))
        except ValueError:
            return error("invalid_data", "year and month must be numbers.", 422)


class AdminSummaryView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        now = timezone.now()
        today = Booking.objects.filter(session_start__date=now.date()).exclude(status="Cancelled").count()
        month_qs = Booking.objects.filter(session_start__year=now.year, session_start__month=now.month)
        total, cancelled = month_qs.count(), month_qs.filter(status="Cancelled").count()
        revenue = Payment.objects.filter(payment_status="Paid", booking__session_start__year=now.year,
                                         booking__session_start__month=now.month).aggregate(s=Sum("amount_kzt"))["s"] or 0
        return Response({"bookings_today": today, "active_members": Member.objects.filter(membership_status="Active").count(),
                         "revenue_month_kzt": float(revenue),
                         "cancellation_rate": round(cancelled / total * 100, 1) if total else 0,
                         "busiest_trainers": busiest(now.year, now.month)})


class NotificationListView(APIView):
    permission_classes = [IsMemberRole]
    def get(self, request):
        member = request.user.profile.member
        services.create_upcoming_reminders(member)
        qs = Notification.objects.filter(member=member)
        return Response({'notifications': NotificationSerializer(qs[:100], many=True).data,
                         'unread_count': qs.filter(is_read=False).count()})


class NotificationReadView(APIView):
    permission_classes = [IsMemberRole]
    def post(self, request):
        qs = Notification.objects.filter(member=request.user.profile.member, is_read=False)
        notification_id = request.data.get('id')
        if notification_id is not None:
            if not str(notification_id).isdigit():
                return error('invalid_id', 'Notification id must be an integer.', 422)
            qs = qs.filter(pk=notification_id)
            if not Notification.objects.filter(member=request.user.profile.member, pk=notification_id).exists():
                return error('not_found', 'Notification not found.', 404)
        count = qs.update(is_read=True)
        return Response({'marked_read': count, 'unread_count': Notification.objects.filter(
            member=request.user.profile.member, is_read=False).count()})


class AIChatView(APIView):
    permission_classes = [IsMemberRole]

    def post(self, request):
        if not isinstance(request.data, dict):
            return error('invalid_request', 'Expected a JSON object.', 422)
        message = request.data.get('message', '')
        if not isinstance(message, str) or not message.strip() or len(message) > 2000:
            return error('invalid_message', 'Message length must be 1–2000 characters.', 422)
        history = request.data.get('history', [])
        lang = request.data.get('lang', 'en')
        try:
            result = ai_coach.chat(
                message, member=request.user.profile.member,
                lang=lang, history=history,
            )
        except ValueError as exc:
            return error('invalid_history', str(exc), 422)
        return Response(result)


class BookingReviewView(APIView):
    permission_classes = [IsMemberRole]
    def post(self, request, booking_id):
        booking = get_object_or_404(Booking, pk=booking_id)
        if booking.member_id != request.user.profile.member_id:
            return error('forbidden', 'This is not your booking.', 403)
        try:
            services.create_review(booking, request.data.get('rating'), request.data.get('comment'))
        except services.BookingError as e:
            return Response(e.payload(), status=e.http_status)
        return Response(BookingSerializer(booking).data, status=201)


class MyStatsView(APIView):
    permission_classes = [IsMemberRole]
    def get(self, request):
        return Response(services.member_stats(request.user.profile.member))


def wallet_payload(member):
    member.refresh_from_db()
    return {'balance_kzt': float(member.balance_kzt), 'subscription_until': member.subscription_until,
            'has_subscription': member.has_subscription(),
            'plans': [{'key': k, 'name': v['name'], 'days': v['days'], 'price_kzt': float(v['price'])}
                      for k, v in services.PLANS.items()],
            'session_price_kzt': float(services.SESSION_PRICE),
            'transactions': TransactionSerializer(member.transactions.all()[:30], many=True).data}


class WalletView(APIView):
    permission_classes = [IsMemberRole]
    def get(self, request):
        return Response(wallet_payload(request.user.profile.member))


class WalletTopUpView(APIView):
    permission_classes = [IsMemberRole]
    def post(self, request):
        try:
            services.top_up(request.user.profile.member, request.data.get("amount"),
                            str(request.data.get('payment_method', 'Card'))[:20])
        except services.BookingError as e:
            return Response(e.payload(), status=e.http_status)
        return Response(wallet_payload(request.user.profile.member), status=201)


class WalletSubscribeView(APIView):
    permission_classes = [IsMemberRole]
    def post(self, request):
        try:
            services.buy_subscription(request.user.profile.member, request.data.get('plan'))
        except services.BookingError as e:
            return Response(e.payload(), status=e.http_status)
        return Response(wallet_payload(request.user.profile.member), status=201)


class ProfileView(APIView):
    permission_classes = [IsMemberRole]
    def get(self, request):
        return Response(MemberSerializer(request.user.profile.member).data)
    def patch(self, request):
        from django.db import transaction
        member = request.user.profile.member
        updates = {}
        for key, max_len in (('full_name', 100), ('phone', 20)):
            if key in request.data:
                value = str(request.data[key]).strip()
                if not value or len(value) > max_len:
                    return error('invalid_data', f'Invalid {key}.', 422)
                updates[key] = value
        if 'email' in request.data:
            email = str(request.data['email']).strip().lower()
            if '@' not in email or User.objects.exclude(pk=request.user.pk).filter(username=email).exists():
                return error('invalid_email', 'Email invalid or already registered.', 422)
            updates['email'] = email
        with transaction.atomic():
            for key, value in updates.items():
                setattr(member, key, value)
            if updates:
                member.save(update_fields=list(updates))
            if 'email' in updates:
                request.user.username = updates['email']
                request.user.email = updates['email']
                request.user.save(update_fields=['username', 'email'])
        return Response(MemberSerializer(member).data)


class ChangePasswordView(APIView):
    permission_classes = [IsMemberRole]
    def post(self, request):
        old = request.data.get('old_password', '')
        new = request.data.get('new_password', '')
        confirm = request.data.get('new_password_confirm', '')
        if not request.user.check_password(old):
            return error('invalid_password', 'Current password is incorrect.', 400)
        if not isinstance(new, str) or new != confirm:
            return error('invalid_password', 'Password confirmation does not match.', 400)
        try:
            validate_password(new, user=request.user)
        except DjangoValidationError as exc:
            return error('weak_password', exc.messages[0], 422)
        request.user.set_password(new)
        request.user.save(update_fields=['password'])
        return Response({'message': 'Password updated successfully.'})
