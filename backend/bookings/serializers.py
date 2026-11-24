from django.db.models import Avg, Count
from rest_framework import serializers
from .models import Booking, Member, Notification, Review, Trainer, TrainerCertificate, WalletTransaction
from .services import can_cancel, can_review


class CertificateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainerCertificate
        fields = ['id', 'title', 'issuer', 'year', 'credential_id']


class TrainerSerializer(serializers.ModelSerializer):
    avg_rating = serializers.SerializerMethodField()
    reviews_count = serializers.SerializerMethodField()
    rating_breakdown = serializers.SerializerMethodField()
    certificates = CertificateSerializer(many=True, read_only=True)
    class Meta:
        model = Trainer
        fields = ['trainer_id', 'full_name', 'specialization', 'working_hours', 'phone', 'photo',
                  'bio', 'experience_years', 'avg_rating', 'reviews_count', 'rating_breakdown', 'certificates']
    def get_avg_rating(self, obj):
        value = getattr(obj, 'avg_rating', None)
        if value is None:
            value = obj.reviews.aggregate(a=Avg('rating'))['a']
        return round(value, 1) if value else None
    def get_reviews_count(self, obj):
        return getattr(obj, 'reviews_count', obj.reviews.count())
    def get_rating_breakdown(self, obj):
        counts = {i: 0 for i in range(1, 6)}
        for x in obj.reviews.values('rating').annotate(n=Count('id')):
            counts[x['rating']] = x['n']
        return counts


class ReviewSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source='member.full_name', read_only=True)
    class Meta:
        model = Review
        fields = ['id', 'booking_id', 'member_name', 'rating', 'comment', 'created_at']


class MemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = Member
        fields = ['member_id', 'full_name', 'phone', 'email', 'membership_status', 'membership_end_date']


class BookingSerializer(serializers.ModelSerializer):
    trainer_name = serializers.CharField(source='trainer.full_name', read_only=True)
    specialization = serializers.CharField(source='trainer.specialization', read_only=True)
    member_name = serializers.CharField(source='member.full_name', read_only=True)
    amount_kzt = serializers.DecimalField(source='payment.amount_kzt', max_digits=10, decimal_places=2, read_only=True, default=None)
    payment_status = serializers.CharField(source='payment.payment_status', read_only=True, default=None)
    payment_method = serializers.CharField(source='payment.payment_method', read_only=True, default=None)
    can_cancel = serializers.SerializerMethodField()
    can_review = serializers.SerializerMethodField()
    review = serializers.SerializerMethodField()
    class Meta:
        model = Booking
        fields = ['booking_id', 'member_id', 'member_name', 'trainer_id', 'trainer_name', 'specialization',
                  'session_start', 'status', 'training_type', 'amount_kzt', 'payment_status', 'payment_method',
                  'can_cancel', 'can_review', 'review']
    def get_can_cancel(self, obj):
        return can_cancel(obj)
    def get_can_review(self, obj):
        return can_review(obj)
    def get_review(self, obj):
        r = getattr(obj, 'review', None)
        return {'rating': r.rating, 'comment': r.comment} if r else None


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'title', 'message', 'notif_type', 'is_read', 'created_at', 'booking_id']


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WalletTransaction
        fields = ['id', 'kind', 'amount_kzt', 'description', 'balance_after', 'created_at']

class TrainerSelfUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trainer
        fields = ['working_hours', 'phone', 'bio', 'experience_years', 'photo']

class CertificateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainerCertificate
        fields = ['id', 'title', 'issuer', 'year', 'credential_id', 'file']