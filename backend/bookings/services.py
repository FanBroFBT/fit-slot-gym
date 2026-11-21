from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from django.db import IntegrityError, transaction
from django.db.models import Avg, Count
from .clock import now_local
from .models import Booking, Member, Notification, Payment, Review, Trainer, WalletTransaction

SESSION_PRICE = Decimal('5000.00')
GROUP_PRICE = Decimal('2500.00')
GROUP_CAPACITY = 6
SESSION_HOURS = 1
CANCEL_BEFORE_HOURS = 2
FREE_REFUND_HOURS = 24
PLANS = {
    'month': {'name': 'Monthly', 'days': 30, 'price': Decimal('45000.00')},
    'quarter': {'name': '3 months', 'days': 90, 'price': Decimal('120000.00')},
}
MIN_TOPUP, MAX_TOPUP = Decimal('1000.00'), Decimal('500000.00')


class BookingError(Exception):
    def __init__(self, code, message, http_status, extra=None):
        super().__init__(message)
        self.code, self.message, self.http_status, self.extra = code, message, http_status, extra or {}

    def payload(self):
        return {'error': self.code, 'message': self.message, **self.extra}


def notify(member, title, message, kind, booking=None):
    return Notification.objects.create(member=member, title=title, message=message, notif_type=kind, booking=booking)


def day_slots(trainer, day):
    start, end = trainer.hours()
    at, limit = datetime.combine(day, start), datetime.combine(day, end)
    result = []
    while at + timedelta(hours=SESSION_HOURS) <= limit:
        result.append(at)
        at += timedelta(hours=1)
    return result


def slot_state(trainer, start):
    active = Booking.objects.filter(trainer=trainer, session_start=start).exclude(status='Cancelled')
    types = list(active.values_list('training_type', flat=True))
    n = len(types)
    mode = 'individual' if 'individual' in types else ('group' if n else None)
    capacity = 1 if mode == 'individual' else GROUP_CAPACITY if mode == 'group' else GROUP_CAPACITY
    return {'slot_mode': mode, 'spots_taken': n, 'max_capacity': capacity, 'remaining_spots': max(0, capacity - n)}


def taken_slots(trainer, day):
    return set(Booking.objects.filter(trainer=trainer, session_start__date=day).exclude(status='Cancelled').values_list('session_start', flat=True))


def slots_for_day(trainer, day, training_type='individual'):
    if training_type not in ('individual', 'group'):
        raise BookingError('invalid_training_type', 'Use individual or group.', 422)
    now = now_local()
    rows = []
    for start in day_slots(trainer, day):
        state = slot_state(trainer, start)
        mode = state['slot_mode']
        available = (start > now and (mode is None or (training_type == 'group' and mode == 'group' and state['spots_taken'] < GROUP_CAPACITY)))
        rows.append({'time': start.strftime('%H:%M'), 'available': available, **state})
    return rows


def nearest_free(trainer, start, limit=3, training_type='individual'):
    found = []
    for delta in range(7):
        day = start.date() + timedelta(days=delta)
        for slot in slots_for_day(trainer, day, training_type):
            candidate = datetime.strptime(f"{day.isoformat()} {slot['time']}", '%Y-%m-%d %H:%M')
            if slot['available'] and candidate > start:
                found.append(candidate.strftime('%Y-%m-%d %H:%M'))
                if len(found) == limit:
                    return found
    return found


def _wallet_move(member, kind, amount, description):
    member.balance_kzt = Decimal(member.balance_kzt) + amount
    member.save(update_fields=['balance_kzt'])
    return WalletTransaction.objects.create(member=member, kind=kind, amount_kzt=amount,
                                            description=description, balance_after=member.balance_kzt)


def _check_member_time_uniqueness(member, start, exclude_booking_id=None):
    qs = Booking.objects.filter(member=member,
        session_start__lt=start + timedelta(hours=SESSION_HOURS),
        session_start__gt=start - timedelta(hours=SESSION_HOURS)).exclude(status='Cancelled')
    if exclude_booking_id:
        qs = qs.exclude(pk=exclude_booking_id)
    if qs.exists():
        raise BookingError('member_busy', 'You already have a workout during this time.', 409)


def _validate_time(trainer, start):
    if start <= now_local():
        raise BookingError('past_time', 'Choose a future time.', 422)
    if start.minute or start.second or start.microsecond:
        raise BookingError('invalid_time', 'Sessions start on a full hour.', 422)
    begin, end = trainer.hours()
    if start.time() < begin or (start + timedelta(hours=1)).time() > end or start.date() != (start + timedelta(hours=1)).date():
        raise BookingError('outside_hours', f'Trainer works {trainer.working_hours}.', 422)


def _validate_capacity(trainer, start, training_type, exclude_booking_id=None):
    qs = Booking.objects.filter(trainer=trainer, session_start=start).exclude(status='Cancelled')
    if exclude_booking_id:
        qs = qs.exclude(pk=exclude_booking_id)
    modes = list(qs.values_list('training_type', flat=True))
    if modes and (training_type == 'individual' or 'individual' in modes or len(modes) >= GROUP_CAPACITY):
        raise BookingError('slot_taken', 'This slot cannot accept more bookings.', 409,
                           {'alternatives': nearest_free(trainer, start, training_type=training_type)})


@transaction.atomic
def create_booking(member, trainer, start, method='Card', simulate_payment_failure=False, training_type='individual'):
    if training_type not in ('individual', 'group'):
        raise BookingError('invalid_training_type', 'Use individual or group.', 422)
    Trainer.objects.select_for_update().get(pk=trainer.pk)
    member = Member.objects.select_for_update().get(pk=member.pk)
    if member.membership_status != 'Active':
        raise BookingError('membership_inactive', 'Membership is inactive.', 403)
    _validate_time(trainer, start)
    price = GROUP_PRICE if training_type == 'group' else SESSION_PRICE
    if method == 'Membership' and not member.has_subscription(start.date()):
        raise BookingError('no_subscription', 'No subscription active for this day.', 402)
    if method == 'Wallet' and member.balance_kzt < price:
        raise BookingError('insufficient_funds', 'Not enough money in wallet.', 402,
                           {'balance_kzt': float(member.balance_kzt)})
    _check_member_time_uniqueness(member, start)
    _validate_capacity(trainer, start, training_type)
    try:
        with transaction.atomic():
            booking = Booking.objects.create(member=member, trainer=trainer, session_start=start,
                                             training_type=training_type, status='Confirmed')
    except IntegrityError:
        raise BookingError('slot_taken', 'This slot is occupied.', 409,
                           {'alternatives': nearest_free(trainer, start, training_type=training_type)})
    amount = Decimal('0') if method == 'Membership' else price
    if method == 'Wallet':
        _wallet_move(member, 'payment', -price, f'{training_type} session {booking.pk}')
    Payment.objects.create(booking=booking, amount_kzt=amount, payment_method=method,
                           payment_status='Paid', paid_at=now_local())
    if simulate_payment_failure:
        raise BookingError('payment_failed', 'Payment failed, transaction rolled back.', 402)
    notify(member, 'Booking confirmed', f'{trainer.full_name}: {start:%Y-%m-%d %H:%M} ({training_type})', 'booking', booking)
    if amount > 0:
        count = Booking.objects.filter(member=member, status__in=['Confirmed', 'Completed'], payment__amount_kzt__gt=0).count()
        if count % 5 == 0:
            bonus = (amount * Decimal('0.10')).quantize(Decimal('0.01'))
            _wallet_move(member, 'loyalty', bonus, f'Loyalty streak cashback for booking #{count}')
            notify(member, 'Loyalty streak reward', f'You earned {bonus} KZT cashback for workout #{count}!', 'loyalty', booking)
    return booking


def can_cancel(booking):
    return booking.status == 'Confirmed' and booking.session_start - now_local() >= timedelta(hours=CANCEL_BEFORE_HOURS)


@transaction.atomic
def reschedule_booking(booking, new_start):
    Trainer.objects.select_for_update().get(pk=booking.trainer_id)
    booking = Booking.objects.select_for_update().select_related('trainer', 'member').get(pk=booking.pk)
    if booking.status != 'Confirmed':
        raise BookingError('not_reschedulable', 'Only confirmed bookings can be rescheduled.', 422)
    if not can_cancel(booking):
        raise BookingError('cancel_too_late', 'Change time at least 2 hours before the session.', 403)
    if new_start == booking.session_start:
        raise BookingError('same_time', 'You already booked this slot.', 422)
    _validate_time(booking.trainer, new_start)
    _check_member_time_uniqueness(booking.member, new_start, booking.pk)
    _validate_capacity(booking.trainer, new_start, booking.training_type, booking.pk)
    booking.session_start = new_start
    try:
        with transaction.atomic():
            booking.save(update_fields=['session_start'])
    except IntegrityError:
        raise BookingError('slot_taken', 'The selected time is already occupied.', 409)
    notify(booking.member, 'Booking rescheduled', f'Your workout moved to {new_start:%Y-%m-%d %H:%M}.', 'booking', booking)
    return booking


@transaction.atomic
def cancel_booking(booking):
    booking = Booking.objects.select_for_update().get(pk=booking.pk)
    if booking.status != 'Confirmed':
        raise BookingError('not_cancellable', 'Only confirmed bookings can be cancelled.', 422)
    if not can_cancel(booking):
        raise BookingError('cancel_too_late', 'Cancel at least 2 hours before the workout.', 403)
    hours = (booking.session_start - now_local()).total_seconds() / 3600
    booking.status = 'Cancelled'
    booking.save(update_fields=['status'])
    payment = Payment.objects.filter(booking=booking).first()
    percent = 100 if hours >= FREE_REFUND_HOURS else 50
    refund = Decimal('0.00')
    if payment and payment.payment_status == 'Paid':
        refund = (payment.amount_kzt * Decimal(percent) / 100).quantize(Decimal('0.01'))
        payment.payment_status = ('Refunded' if percent == 100 else 'Partially Refunded') if refund else 'Cancelled'
        payment.save(update_fields=['payment_status'])
        if refund:
            member = Member.objects.select_for_update().get(pk=booking.member_id)
            _wallet_move(member, 'refund', refund, f'{percent}% refund for {booking.pk}')
    notify(booking.member, 'Booking cancelled', f'Refund: {refund} KZT ({percent}% of paid amount).', 'refund', booking)
    return booking, {'refund_percent': percent, 'refunded_kzt': float(refund),
                     'payment_status': payment.payment_status if payment else None}


@transaction.atomic
def top_up(member, amount, method='Card'):
    try:
        amount = Decimal(str(amount)).quantize(Decimal('0.01'))
    except (ValueError, InvalidOperation):
        raise BookingError('invalid_data', 'Amount must be numeric.', 422)
    if not amount.is_finite() or not MIN_TOPUP <= amount <= MAX_TOPUP:
        raise BookingError('invalid_data', 'Top-up must be 1000–500000 KZT.', 422)
    member = Member.objects.select_for_update().get(pk=member.pk)
    _wallet_move(member, 'topup', amount, f'Top-up by {method}')
    return member


@transaction.atomic
def buy_subscription(member, plan_key):
    plan = PLANS.get(plan_key)
    if not plan:
        raise BookingError('invalid_data', 'Unknown subscription plan.', 422)
    member = Member.objects.select_for_update().get(pk=member.pk)
    if member.membership_status != 'Active':
        raise BookingError('membership_inactive', 'Membership is inactive.', 403)
    if member.balance_kzt < plan['price']:
        raise BookingError('insufficient_funds', 'Not enough money in wallet.', 402)
    today = now_local().date()
    member.subscription_until = (member.subscription_until if member.has_subscription(today) else today) + timedelta(days=plan['days'])
    member.save(update_fields=['subscription_until'])
    _wallet_move(member, 'subscription', -plan['price'], f'Subscription: {plan["name"]}')
    return member


def is_finished(booking, now=None):
    now = now or now_local()
    return booking.status == 'Completed' or (booking.status == 'Confirmed' and booking.session_start + timedelta(hours=1) <= now)


def member_stats(member, months=6):
    now = now_local()
    qs = Booking.objects.filter(member=member).exclude(status='Cancelled').select_related('trainer', 'payment')
    done = [b for b in qs if is_finished(b, now)]
    by_trainer = defaultdict(lambda: {'sessions': 0, 'hours': 0})
    for b in done:
        by_trainer[(b.trainer_id, b.trainer.full_name)]['sessions'] += 1
        by_trainer[(b.trainer_id, b.trainer.full_name)]['hours'] += SESSION_HOURS
    result = sorted([{'trainer_id': k[0], 'trainer_name': k[1], **v} for k, v in by_trainer.items()], key=lambda x: -x['sessions'])
    y, m = now.year, now.month
    months_list = []
    for _ in range(months):
        months_list.append((y, m))
        y, m = (y - 1, 12) if m == 1 else (y, m - 1)
    months_list.reverse()
    by_month = [{'month': f'{y}-{m:02d}', 'sessions': sum(b.session_start.year == y and b.session_start.month == m for b in done)} for y, m in months_list]
    spent = sum((b.payment.amount_kzt for b in done if hasattr(b, 'payment')), Decimal('0'))
    streak = Booking.objects.filter(member=member, status__in=['Confirmed', 'Completed'], payment__amount_kzt__gt=0).count()
    return {'total_sessions': len(done), 'total_hours': len(done), 'upcoming': qs.filter(status='Confirmed', session_start__gt=now).count(),
            'spent_kzt': float(spent), 'favorite_trainer': result[0]['trainer_name'] if result else None,
            'by_trainer': result, 'by_month': by_month, 'loyalty_progress': streak % 5, 'loyalty_remaining': 5 - streak % 5}


def can_review(booking):
    return is_finished(booking) and not hasattr(booking, 'review')


def create_review(booking, rating, comment):
    if not is_finished(booking):
        raise BookingError('not_finished', 'Review is possible after the session.', 422)
    if hasattr(booking, 'review'):
        raise BookingError('already_reviewed', 'This session already has a review.', 409)
    try:
        rating = int(rating)
    except (TypeError, ValueError):
        rating = 0
    if not 1 <= rating <= 5:
        raise BookingError('invalid_data', 'Rating must be 1–5.', 422)
    return Review.objects.create(booking=booking, member=booking.member, trainer=booking.trainer,
                                 rating=rating, comment=str(comment or '')[:1000])


def trainer_rating(trainer):
    data = Review.objects.filter(trainer=trainer).aggregate(avg=Avg('rating'), n=Count('id'))
    return (round(data['avg'], 1) if data['avg'] else None), data['n']


def create_upcoming_reminders(member):
    now = now_local()
    upcoming = Booking.objects.filter(member=member, status='Confirmed', session_start__gt=now,
                                      session_start__lte=now + timedelta(hours=24)).select_related('trainer')
    for booking in upcoming:
        Notification.objects.get_or_create(member=member, booking=booking, notif_type='reminder',
            defaults={'title': 'Upcoming workout', 'message': f'{booking.trainer.full_name} · {booking.session_start:%Y-%m-%d %H:%M}'})
