"""Database design from Task 9: members, trainers, bookings, payments (+ profile for login roles)."""
from datetime import time
from django.contrib.auth.models import User
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone
from .clock import now_local


def next_id(model, prefix, width, start):
    """Next readable ID such as M-1001, T-01, BK-0001, P-0001."""
    last = model.objects.order_by("-pk").first()
    number = int(last.pk.split("-")[1]) + 1 if last else start
    return f"{prefix}{str(number).zfill(width)}"

class News(models.Model):
    title = models.CharField(max_length=200)
    content = models.TextField()
    image_url = models.URLField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title
    
class Member(models.Model):
    STATUSES = [("Active", "Active"), ("Frozen", "Frozen"), ("Expired", "Expired")]
    member_id = models.CharField(max_length=10, primary_key=True, blank=True,
                                 validators=[RegexValidator(r"^M-\d{4}$")])
    full_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=20)
    email = models.EmailField(unique=True, null=True, blank=True)
    membership_status = models.CharField(max_length=10, choices=STATUSES, default="Active")
    membership_end_date = models.DateField(null=True, blank=True)
    # Wallet: prepaid balance in KZT. Subscription: free sessions until this date.
    balance_kzt = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    subscription_until = models.DateField(null=True, blank=True)

    def has_subscription(self, on=None):
        on = on or now_local().date()
        return bool(self.subscription_until and self.subscription_until >= on)

    def save(self, *args, **kwargs):
        if not self.member_id:
            self.member_id = next_id(Member, "M-", 4, 1001)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.member_id} {self.full_name}"


class Trainer(models.Model):
    trainer_id = models.CharField(max_length=10, primary_key=True, blank=True,
                                  validators=[RegexValidator(r"^T-\d{2}$")])
    full_name = models.CharField(max_length=100)
    photo = models.URLField(blank=True, null=True)
    specialization = models.CharField(max_length=50)
    phone = models.CharField(max_length=20, blank=True)
    working_hours = models.CharField(max_length=11, default="07:00-22:00",
                                     validators=[RegexValidator(r"^\d{2}:\d{2}-\d{2}:\d{2}$")])

    def save(self, *args, **kwargs):
        if not self.trainer_id:
            self.trainer_id = next_id(Trainer, "T-", 2, 1)
        super().save(*args, **kwargs)

    def hours(self):
        a, b = self.working_hours.split("-")
        return time.fromisoformat(a), time.fromisoformat(b)

    def __str__(self):
        return f"{self.trainer_id} {self.full_name}"


class Booking(models.Model):
    STATUSES = [("Confirmed", "Confirmed"), ("Cancelled", "Cancelled"), ("Completed", "Completed")]
    booking_id = models.CharField(max_length=10, primary_key=True, blank=True,
                                  validators=[RegexValidator(r"^BK-\d{4}$")])
    member = models.ForeignKey(Member, on_delete=models.PROTECT, related_name="bookings")
    trainer = models.ForeignKey(Trainer, on_delete=models.PROTECT, related_name="bookings")
    session_start = models.DateTimeField()
    status = models.CharField(max_length=10, choices=STATUSES, default="Confirmed")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            # One trainer cannot have two ACTIVE bookings at the same time.
            # Cancelled bookings are ignored, so a cancelled slot can be booked again.
            models.UniqueConstraint(fields=["trainer", "session_start"],
                                    condition=~Q(status="Cancelled"), name="uq_trainer_slot"),
            models.UniqueConstraint(fields=["member", "session_start"],
                        condition=~Q(status="Cancelled"), name="uq_member_slot"),
        ]

    def save(self, *args, **kwargs):
        if not self.booking_id:
            self.booking_id = next_id(Booking, "BK-", 4, 1)
        super().save(*args, **kwargs)


class Payment(models.Model):
    STATUSES = [("Paid", "Paid"), ("Failed", "Failed"), ("Pending", "Pending"), ("Refunded", "Refunded")]
    payment_id = models.CharField(max_length=10, primary_key=True, blank=True,
                                  validators=[RegexValidator(r"^P-\d{4}$")])
    booking = models.OneToOneField(Booking, on_delete=models.PROTECT, related_name="payment")
    amount_kzt = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0.01)])
    payment_method = models.CharField(max_length=20)
    payment_status = models.CharField(max_length=10, choices=STATUSES)
    paid_at = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.payment_id:
            self.payment_id = next_id(Payment, "P-", 4, 1)
        super().save(*args, **kwargs)


class Profile(models.Model):
    """Links a login account to a role (member or admin)."""
    ROLES = [("member", "member"), ("admin", "admin")]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=10, choices=ROLES, default="member")
    member = models.OneToOneField(Member, null=True, blank=True, on_delete=models.PROTECT)


class WalletTransaction(models.Model):
    """Every change of the wallet balance (and subscription purchase) is stored here."""
    KINDS = [("topup", "topup"), ("payment", "payment"), ("refund", "refund"), ("subscription", "subscription")]
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name="transactions")
    kind = models.CharField(max_length=15, choices=KINDS)
    amount_kzt = models.DecimalField(max_digits=10, decimal_places=2)   # + adds money, - spends money
    description = models.CharField(max_length=120, blank=True)
    balance_after = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]


class Review(models.Model):
    """One review per finished booking: 1-5 stars and a comment. Builds the trainer rating."""
    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, related_name="review")
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name="reviews")
    trainer = models.ForeignKey(Trainer, on_delete=models.CASCADE, related_name="reviews")
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField(blank=True, max_length=1000)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [models.CheckConstraint(condition=Q(rating__gte=1, rating__lte=5), name="ck_review_rating_1_5")]
