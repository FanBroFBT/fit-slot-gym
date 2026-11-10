from rest_framework import serializers
from .models import Booking, Member, Review, Trainer, WalletTransaction
from .services import can_cancel, can_review


class TrainerSerializer(serializers.ModelSerializer):
    # avg_rating / reviews_count are annotated in the view (one SQL query for all trainers)
    avg_rating = serializers.SerializerMethodField()
    reviews_count = serializers.SerializerMethodField()

    class Meta:
        model = Trainer
        fields = ['trainer_id', 'full_name', 'specialization', 'working_hours', 'phone', 'photo',
                  'avg_rating', 'reviews_count']

    def get_avg_rating(self, obj):
        value = getattr(obj, "avg_rating", None)
        return round(value, 1) if value else None

    def get_reviews_count(self, obj):
        return getattr(obj, "reviews_count", 0)


class ReviewSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source="member.full_name", read_only=True)

    class Meta:
        model = Review
        fields = ["id", "booking_id", "member_name", "rating", "comment", "created_at"]


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WalletTransaction
        fields = ["id", "kind", "amount_kzt", "description", "balance_after", "created_at"]

class MemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = Member
        fields = ["member_id", "full_name", "phone", "email", "membership_status", "membership_end_date"]


class BookingSerializer(serializers.ModelSerializer):
    trainer_name = serializers.CharField(source="trainer.full_name", read_only=True)
    specialization = serializers.CharField(source="trainer.specialization", read_only=True)
    member_name = serializers.CharField(source="member.full_name", read_only=True)
    amount_kzt = serializers.DecimalField(source="payment.amount_kzt", max_digits=10, decimal_places=2, read_only=True, default=None)
    payment_status = serializers.CharField(source="payment.payment_status", read_only=True, default=None)
    payment_method = serializers.CharField(source="payment.payment_method", read_only=True, default=None)
    can_cancel = serializers.SerializerMethodField()
    can_review = serializers.SerializerMethodField()
    review = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = ["booking_id", "member_id", "member_name", "trainer_id", "trainer_name", "specialization",
                  "session_start", "status", "amount_kzt", "payment_status", "payment_method",
                  "can_cancel", "can_review", "review"]

    def get_can_review(self, obj):
        return can_review(obj)

    def get_review(self, obj):
        r = getattr(obj, "review", None)
        return {"rating": r.rating, "comment": r.comment} if r else None

    def get_can_cancel(self, obj):
        return can_cancel(obj)
