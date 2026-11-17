from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import Booking, Member, Review, Trainer, WalletTransaction
from .services import can_cancel, can_review


class TrainerSerializer(serializers.ModelSerializer):
    # avg_rating / reviews_count are annotated in the view (one SQL query for all trainers)
    avg_rating = serializers.SerializerMethodField()
    reviews_count = serializers.SerializerMethodField()

    class Meta:
        model = Trainer
        fields = [
            "trainer_id", "full_name", "specialization", "working_hours",
            "phone", "photo", "avg_rating", "reviews_count",
        ]

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
    amount_kzt = serializers.DecimalField(
        source="payment.amount_kzt", max_digits=10, decimal_places=2, read_only=True, default=None
    )
    payment_status = serializers.CharField(source="payment.payment_status", read_only=True, default=None)
    payment_method = serializers.CharField(source="payment.payment_method", read_only=True, default=None)
    can_cancel = serializers.SerializerMethodField()
    can_review = serializers.SerializerMethodField()
    review = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            "booking_id", "member_id", "member_name", "trainer_id", "trainer_name",
            "specialization", "session_start", "status", "amount_kzt",
            "payment_status", "payment_method", "can_cancel", "can_review", "review",
        ]

    def get_can_review(self, obj):
        return can_review(obj)

    def get_review(self, obj):
        r = getattr(obj, "review", None)
        return {"rating": r.rating, "comment": r.comment} if r else None

    def get_can_cancel(self, obj):
        return can_cancel(obj)


# --- WEEK 12: SECURITY, PASSWORD POLICY & PROFILE SERIALIZERS ---

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)
    full_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    phone = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "password", "password_confirm", "full_name", "phone"]

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Парольдер сәйкес келмейді."})

        temp_user = User(
            username=attrs.get("username", ""),
            email=attrs.get("email", ""),
        )
        validate_password(attrs["password"], user=temp_user)
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        full_name = validated_data.pop("full_name", "") or validated_data["username"]
        phone = validated_data.pop("phone", "")
        raw_password = validated_data.pop("password")

        # create_user парольді PASSWORD_HASHERS арқылы хэштелген күйде сақтайды
        user = User.objects.create_user(password=raw_password, **validated_data)

        # Егер жобада Member моделі User-мен байланыстырылса, автоматты жасау:
        member_fields = {f.name for f in Member._meta.get_fields()}
        if "user" in member_fields:
            Member.objects.get_or_create(
                user=user,
                defaults={
                    "full_name": full_name,
                    "email": user.email,
                    "phone": phone,
                },
            )
        return user


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)
    new_password_confirm = serializers.CharField(write_only=True, required=False)

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Ескі пароль қате енгізілді.")
        return value

    def validate(self, attrs):
        confirm = attrs.get("new_password_confirm")
        if confirm is not None and attrs["new_password"] != confirm:
            raise serializers.ValidationError({"new_password_confirm": "Жаңа парольдер сәйкес келмейді."})

        user = self.context["request"].user
        validate_password(attrs["new_password"], user=user)
        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user


class MemberProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Member
        fields = ["full_name", "phone", "email"]