"""Business rules for booking. Views only call these functions."""
from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal
from django.db import IntegrityError, transaction
from django.db.models import Avg, Count
from django.utils import timezone
from .models import Booking, Member, Payment, Review, WalletTransaction
from .clock import now_local

SESSION_PRICE = Decimal("5000")
CANCEL_BEFORE_HOURS = 2
SESSION_HOURS = 1            # every session lasts one hour

# Membership plans: a member pays from the wallet and then books sessions for free until the end date.
PLANS = {
    "month":   {"name": "Monthly",   "days": 30, "price": Decimal("45000")},
    "quarter": {"name": "3 months",  "days": 90, "price": Decimal("120000")},
}
MIN_TOPUP, MAX_TOPUP = Decimal("1000"), Decimal("500000")


class BookingError(Exception):
    def __init__(self, code, message, http_status, extra=None):
        super().__init__(message)
        self.code, self.message, self.http_status, self.extra = code, message, http_status, extra or {}

    def payload(self):
        return {"error": self.code, "message": self.message, **self.extra}


def day_slots(trainer, day):
    """Hourly slot start times inside the trainer's working hours."""
    start_t, end_t = trainer.hours()
    cur, end = datetime.combine(day, start_t), datetime.combine(day, end_t)
    slots = []
    while cur + timedelta(hours=1) <= end:
        slots.append(cur)
        cur += timedelta(hours=1)
    return slots


def taken_slots(trainer, day):
    qs = Booking.objects.filter(trainer=trainer, session_start__date=day).exclude(status="Cancelled")
    return {b.session_start for b in qs}


def slots_for_day(trainer, day):
    """List of {time, available} for one day."""
    now, taken = now_local(), taken_slots(trainer, day)
    return [{"time": s.strftime("%H:%M"), "available": s not in taken and s > now} for s in day_slots(trainer, day)]


def nearest_free(trainer, start, limit=3):
    now, found, day = now_local(), [], start.date()
    for _ in range(7):
        taken = taken_slots(trainer, day)
        for s in day_slots(trainer, day):
            if s > start and s > now and s not in taken:
                found.append(s.strftime("%Y-%m-%d %H:%M"))
                if len(found) == limit:
                    return found
        day += timedelta(days=1)
    return found


def _wallet_move(member, kind, amount, description):
    """Change the balance and write one line to the transaction history."""
    member.balance_kzt = member.balance_kzt + amount
    member.save(update_fields=["balance_kzt"])
    return WalletTransaction.objects.create(member=member, kind=kind, amount_kzt=amount,
                                            description=description, balance_after=member.balance_kzt)


@transaction.atomic
def create_booking(member, trainer, start, method="Card", simulate_payment_failure=False):
    """Booking + payment in ONE transaction. Any error undoes everything.
    method: Card / Kaspi / Cash (pay now), Wallet (pay from balance), Membership (free with a subscription)."""
    member = Member.objects.select_for_update().get(pk=member.pk)
    if member.membership_status != "Active":
        raise BookingError("membership_inactive", "Your membership is not active.", 403)
    if start <= now_local():
        raise BookingError("past_time", "Choose a time in the future.", 422)
    if start.minute or start.second:
        raise BookingError("invalid_time", "Sessions start at a full hour.", 422)
    t_start, t_end = trainer.hours()
    if start.time() < t_start or start + timedelta(hours=1) > datetime.combine(start.date(), t_end):
        raise BookingError("outside_hours", f"Trainer works {trainer.working_hours}.", 422)
    if method == "Membership" and not member.has_subscription(start.date()):
        raise BookingError("no_subscription", "You have no active subscription for this date.", 402)
    if method == "Wallet" and member.balance_kzt < SESSION_PRICE:
        raise BookingError("insufficient_funds",
                           f"Not enough money in the wallet. Balance: {member.balance_kzt} KZT, price: {SESSION_PRICE} KZT.",
                           402, {"balance_kzt": float(member.balance_kzt)})
    if Booking.objects.filter(member=member, session_start=start).exclude(status="Cancelled").exists():
        raise BookingError("member_busy", "You already have a booking at this time.", 409)

    try:
        with transaction.atomic():
            booking = Booking.objects.create(member=member, trainer=trainer, session_start=start, status="Confirmed")
    except IntegrityError:
        raise BookingError("slot_taken", "This time is already booked. Pick another slot.", 409,
                           {"alternatives": nearest_free(trainer, start)})
    amount = Decimal("0") if method == "Membership" else SESSION_PRICE
    if method == "Wallet":
        _wallet_move(member, "payment", -SESSION_PRICE, f"Session with {trainer.full_name} ({booking.booking_id})")
    Payment.objects.create(booking=booking, amount_kzt=amount, payment_method=method,
                           payment_status="Paid", paid_at=now_local())
    if simulate_payment_failure:     # demo of an atomic transaction: booking and wallet payment are rolled back
        raise BookingError("payment_failed", "Payment failed. Booking was rolled back.", 402)
    return booking


def can_cancel(booking):
    return booking.status == "Confirmed" and booking.session_start - now_local() >= timedelta(hours=CANCEL_BEFORE_HOURS)


def cancel_booking(booking):
    if booking.status != "Confirmed":
        raise BookingError("not_cancellable", "Only confirmed bookings can be cancelled.", 422)
    if not can_cancel(booking):
        raise BookingError("cancel_too_late", f"Cancel at least {CANCEL_BEFORE_HOURS} hours before the session.", 403)
    with transaction.atomic():
        booking.status = "Cancelled"
        booking.save(update_fields=["status"])
        payment = getattr(booking, "payment", None)
        if payment and payment.payment_status == "Paid":
            if payment.payment_method == "Wallet":
                member = Member.objects.select_for_update().get(pk=booking.member_id)
                _wallet_move(member, "refund", payment.amount_kzt, f"Refund for cancelled booking {booking.booking_id}")
            payment.payment_status = "Refunded"          # новое
            payment.save(update_fields=["payment_status"])
    return booking


# ---------------------------------------------------------------- wallet & membership
def top_up(member, amount, method="Card"):
    try:
        amount = Decimal(str(amount)).quantize(Decimal("0.01"))
    except Exception:
        raise BookingError("invalid_data", "Amount must be a number.", 422)
    if amount < MIN_TOPUP or amount > MAX_TOPUP:
        raise BookingError("invalid_data", f"Top-up must be between {MIN_TOPUP} and {MAX_TOPUP} KZT.", 422)
    with transaction.atomic():
        member = Member.objects.select_for_update().get(pk=member.pk)
        _wallet_move(member, "topup", amount, f"Top-up by {method}")
    return member


def buy_subscription(member, plan_key):
    plan = PLANS.get(plan_key)
    if not plan:
        raise BookingError("invalid_data", "Unknown plan.", 422)
    with transaction.atomic():
        member = Member.objects.select_for_update().get(pk=member.pk)
        if member.membership_status != "Active":
            raise BookingError("membership_inactive", "Your membership is not active.", 403)
        if member.balance_kzt < plan["price"]:
            raise BookingError("insufficient_funds", f"Not enough money. The plan costs {plan['price']} KZT.", 402,
                               {"balance_kzt": float(member.balance_kzt)})
        today = now_local().date()
        base = member.subscription_until if member.has_subscription(today) else today   # extend, do not waste days
        member.subscription_until = base + timedelta(days=plan["days"])
        member.save(update_fields=["subscription_until"])
        _wallet_move(member, "subscription", -plan["price"], f"Subscription: {plan['name']}")
    return member


# ---------------------------------------------------------------- workout history
def is_finished(booking, now=None):
    now = now or now_local()
    ended = booking.session_start + timedelta(hours=SESSION_HOURS) <= now
    return booking.status == "Completed" or (booking.status == "Confirmed" and ended)


def member_stats(member, months=6):
    """Numbers for the charts: sessions and hours per trainer, sessions per month."""
    now = now_local()
    qs = Booking.objects.filter(member=member).exclude(status="Cancelled").select_related("trainer")
    done = [b for b in qs if is_finished(b, now)]
    per_trainer = defaultdict(lambda: {"sessions": 0, "hours": 0})
    for b in done:
        row = per_trainer[(b.trainer_id, b.trainer.full_name)]
        row["sessions"] += 1
        row["hours"] += SESSION_HOURS
    by_trainer = sorted(({"trainer_id": k[0], "trainer_name": k[1], **v} for k, v in per_trainer.items()),
                        key=lambda r: -r["sessions"])
    y, m = now.year, now.month
    keys = []
    for _ in range(months):
        keys.append((y, m))
        y, m = (y - 1, 12) if m == 1 else (y, m - 1)
    keys.reverse()
    month_count = {k: 0 for k in keys}
    for b in done:
        k = (b.session_start.year, b.session_start.month)
        if k in month_count:
            month_count[k] += 1
    spent = sum((b.payment.amount_kzt for b in done if hasattr(b, "payment")), Decimal("0"))
    return {
        "total_sessions": len(done),
        "total_hours": len(done) * SESSION_HOURS,
        "upcoming": qs.filter(status="Confirmed", session_start__gt=now).count(),
        "spent_kzt": float(spent),
        "favorite_trainer": by_trainer[0]["trainer_name"] if by_trainer else None,
        "by_trainer": by_trainer,
        "by_month": [{"month": f"{y}-{m:02d}", "sessions": n} for (y, m), n in month_count.items()],
    }


# ---------------------------------------------------------------- reviews
def can_review(booking):
    return is_finished(booking) and not hasattr(booking, "review")


def create_review(booking, rating, comment):
    if not is_finished(booking):
        raise BookingError("not_finished", "You can review a session only after it has finished.", 422)
    if hasattr(booking, "review"):
        raise BookingError("already_reviewed", "You have already reviewed this session.", 409)
    try:
        rating = int(rating)
    except (TypeError, ValueError):
        rating = 0
    if not 1 <= rating <= 5:
        raise BookingError("invalid_data", "Rating must be from 1 to 5 stars.", 422)
    return Review.objects.create(booking=booking, member=booking.member, trainer=booking.trainer,
                                 rating=rating, comment=str(comment or "").strip()[:1000])


def trainer_rating(trainer):
    agg = Review.objects.filter(trainer=trainer).aggregate(avg=Avg("rating"), n=Count("id"))
    return (round(agg["avg"], 1) if agg["avg"] else None), agg["n"]
