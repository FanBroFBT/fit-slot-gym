"""python manage.py seed_extras : demo wallet money + demo reviews for finished sessions.
Safe to run many times (it only fills what is still empty). Also works on a database made before wallet/reviews existed."""
import random
from datetime import timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone
from bookings.models import Booking, Payment, Profile, Review, Trainer, WalletTransaction
from bookings.services import is_finished
from bookings.clock import now_local

COMMENTS = {
    5: ["Excellent trainer, I see progress every week!", "Very professional and motivating. Highly recommend.",
        "Best session I have had. Clear explanations."],
    4: ["Great workout, a little crowded in the hall.", "Good program, friendly attitude.", "Nice session, will come again."],
    3: ["Normal session, nothing special.", "Okay, but I expected a bit more attention."],
}


def add_demo_extras(out=None):
    rnd = random.Random(7)
    # 1) demo wallet for the demo account (only if it is still empty)
    profile = Profile.objects.filter(user__username="member@gym.kz").select_related("member").first()
    demo = profile.member if profile else None
    if demo and demo.balance_kzt == 0 and not demo.transactions.exists():
        demo.balance_kzt = Decimal("25000")
        demo.save(update_fields=["balance_kzt"])
        WalletTransaction.objects.create(member=demo, kind="topup", amount_kzt=Decimal("25000"),
                                         description="Welcome bonus (demo)", balance_after=demo.balance_kzt,
                                         created_at=now_local() - timedelta(days=3))
    # 1b) older finished sessions for the demo member, so the charts on the Stats page have something to show
    if demo and Booking.objects.filter(member=demo, status="Completed").count() < 6:
        trainers = list(Trainer.objects.order_by("trainer_id"))
        weights = [5, 3, 2, 4, 1, 1][:len(trainers)]
        now, made = now_local(), 0
        for _ in range(60):
            if made >= 14 or not trainers:
                break
            t = rnd.choices(trainers, weights + [1] * (len(trainers) - len(weights)))[0]
            a, b_ = t.hours()
            day = (now - timedelta(days=rnd.randint(3, 150))).date()
            start = timezone.datetime(day.year, day.month, day.day, rnd.randint(a.hour, b_.hour - 1))
            if Booking.objects.filter(trainer=t, session_start=start).exclude(status="Cancelled").exists():
                continue
            bk = Booking.objects.create(member=demo, trainer=t, session_start=start, status="Completed",
                                        created_at=start - timedelta(days=1))
            Payment.objects.create(booking=bk, amount_kzt=5000, payment_method=rnd.choice(["Card", "Kaspi"]),
                                   payment_status="Paid", paid_at=bk.created_at)
            made += 1
    # 2) reviews for about 2 of 3 finished sessions that have no review yet
    created = 0
    for b in Booking.objects.exclude(status="Cancelled").select_related("member", "trainer"):
        if not is_finished(b) or hasattr(b, "review") or rnd.random() > 0.7:
            continue
        rating = rnd.choices([5, 4, 3], [6, 3, 1])[0]
        Review.objects.create(booking=b, member=b.member, trainer=b.trainer, rating=rating,
                              comment=rnd.choice(COMMENTS[rating]), created_at=b.session_start + timedelta(hours=2))
        created += 1
    if out:
        out.write(f"Demo extras: {created} reviews added.")


class Command(BaseCommand):
    def handle(self, *args, **options):
        add_demo_extras(self.stdout)
