from datetime import datetime, timedelta
from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.test import APITestCase
from .models import Booking, Member, Payment, Profile, Trainer
from .clock import now_local


def future(days=2, hour=18):
    d = now_local() + timedelta(days=days)
    return datetime(d.year, d.month, d.day, hour)


def fmt(dt):
    return dt.strftime("%Y-%m-%d %H:%M")


class ApiBase(APITestCase):
    """Shared users and helpers (no tests here)."""
    def setUp(self):
        self.trainer = Trainer.objects.create(full_name="Aigerim", specialization="Strength", working_hours="07:00-22:00")
        self.member = Member.objects.create(full_name="Ali", phone="1", membership_status="Active")
        self.other = Member.objects.create(full_name="Dana", phone="2", membership_status="Active")
        self.expired = Member.objects.create(full_name="Marat", phone="3", membership_status="Expired")
        self.users = {}
        for key, m, role, pw in (("ali", self.member, "member", "pass123"), ("dana", self.other, "member", "pass123"),
                                 ("marat", self.expired, "member", "pass123"), ("admin", None, "admin", "admin123")):
            u = User.objects.create_user(f"{key}@gym.kz", password=pw)
            Profile.objects.create(user=u, role=role, member=m)
            self.users[key] = u

    def login(self, key):
        r = self.client.post("/api/login/", {"email": f"{key}@gym.kz", "password": "admin123" if key == "admin" else "pass123"}, format="json")
        self.client.credentials(HTTP_AUTHORIZATION="Token " + r.data["token"])

    def book(self, start, **extra):
        return self.client.post("/api/bookings/", {"trainer_id": self.trainer.pk, "session_start": fmt(start), **extra}, format="json")


class ApiTests(ApiBase):
    def test_api01_trainers_list(self):
        self.login("ali")
        r = self.client.get("/api/trainers/")
        self.assertEqual((r.status_code, len(r.data)), (200, 1))

    def test_api02_login_ok(self):
        r = self.client.post("/api/login/", {"email": "ali@gym.kz", "password": "pass123"}, format="json")
        self.assertEqual((r.status_code, r.data["role"]), (200, "member"))

    def test_api03_login_wrong_password(self):
        r = self.client.post("/api/login/", {"email": "ali@gym.kz", "password": "bad"}, format="json")
        self.assertEqual(r.status_code, 401)

    def test_api04_valid_booking_creates_booking_and_payment(self):
        self.login("ali")
        r = self.book(future())
        self.assertEqual(r.status_code, 201)
        self.assertEqual((r.data["booking_id"], r.data["payment_status"]), ("BK-0001", "Paid"))

    def test_api05_double_booking_rejected_with_alternatives(self):
        self.login("ali"); self.book(future())
        self.login("dana")
        r = self.book(future())
        self.assertEqual(r.status_code, 409)
        self.assertEqual((r.data["error"], len(r.data["alternatives"])), ("slot_taken", 3))

    def test_api06_booking_needs_login(self):
        self.assertEqual(self.book(future()).status_code, 401)

    def test_api07_past_time_rejected(self):
        self.login("ali")
        self.assertEqual(self.book(future(days=-1)).status_code, 422)

    def test_api08_expired_member_cannot_book(self):
        self.login("marat")
        self.assertEqual(self.book(future()).status_code, 403)

    def test_api09_cancel_own_then_slot_free_again(self):
        self.login("ali")
        bid = self.book(future()).data["booking_id"]
        self.assertEqual(self.client.post(f"/api/bookings/{bid}/cancel/").status_code, 200)
        self.login("dana")
        self.assertEqual(self.book(future()).status_code, 201)

    def test_api10_member_cannot_use_admin_endpoint(self):
        self.login("ali")
        self.assertEqual(self.client.get("/api/admin/bookings/").status_code, 403)

    def test_api11_payment_failure_rolls_back_booking(self):
        self.login("ali")
        r = self.book(future(), simulate_payment_failure=True)
        self.assertEqual(r.status_code, 402)
        self.assertEqual((Booking.objects.count(), Payment.objects.count()), (0, 0))

    def test_api12_cannot_cancel_other_members_booking(self):
        self.login("ali")
        bid = self.book(future()).data["booking_id"]
        self.login("dana")
        self.assertEqual(self.client.post(f"/api/bookings/{bid}/cancel/").status_code, 403)

    def test_api13_cancel_too_late(self):
        soon = now_local() + timedelta(hours=1)
        b = Booking.objects.create(member=self.member, trainer=self.trainer, session_start=datetime(soon.year, soon.month, soon.day, soon.hour))
        self.login("ali")
        self.assertEqual(self.client.post(f"/api/bookings/{b.pk}/cancel/").status_code, 403)

    def test_api14_admin_sees_all_and_busiest(self):
        self.login("ali"); self.book(future())
        self.login("admin")
        self.assertEqual(len(self.client.get("/api/admin/bookings/").data), 1)
        self.assertEqual(self.client.get("/api/admin/summary/").status_code, 200)

    def test_api15_member_cannot_book_two_trainers_same_time(self):
        t2 = Trainer.objects.create(full_name="Bota", specialization="Cardio", working_hours="07:00-22:00")
        self.login("ali"); self.book(future())
        r = self.client.post("/api/bookings/", {"trainer_id": t2.pk, "session_start": fmt(future())}, format="json")
        self.assertEqual((r.status_code, r.data["error"]), (409, "member_busy"))

    def test_api16_server_time_is_almaty(self):
        from datetime import timezone as tz
        expected = (datetime.now(tz.utc) + timedelta(hours=5)).replace(tzinfo=None)
        self.assertLess(abs((now_local() - expected).total_seconds()), 5)

    def test_api17_cancel_marks_payment_refunded(self):
        self.login("ali")
        bid = self.book(future()).data["booking_id"]
        self.client.post(f"/api/bookings/{bid}/cancel/")
        self.assertEqual(Payment.objects.get(booking_id=bid).payment_status, "Refunded")


class DatabaseRuleTests(APITestCase):
    """Database rules from our Task 9 design are enforced by the database itself."""
    def setUp(self):
        self.t = Trainer.objects.create(full_name="T", specialization="S")
        self.m = Member.objects.create(full_name="M", phone="1")

    def test_same_trainer_same_time_rejected_but_cancelled_slot_reusable(self):
        start = future()
        first = Booking.objects.create(member=self.m, trainer=self.t, session_start=start)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Booking.objects.create(member=self.m, trainer=self.t, session_start=start)
        first.status = "Cancelled"; first.save()
        Booking.objects.create(member=self.m, trainer=self.t, session_start=start)

    def test_member_with_bookings_cannot_be_deleted(self):
        Booking.objects.create(member=self.m, trainer=self.t, session_start=future())
        from django.db.models import ProtectedError
        with self.assertRaises(ProtectedError):
            self.m.delete()


class WalletReviewStatsTests(ApiBase):
    """New features: wallet / subscription, trainer reviews, workout statistics."""
    def past_done(self, days=3, hour=10):
        d = now_local() - timedelta(days=days)
        return Booking.objects.create(member=self.member, trainer=self.trainer, status="Completed",
                                      session_start=datetime(d.year, d.month, d.day, hour))

    def test_w01_topup_and_pay_from_wallet(self):
        self.login("ali")
        self.assertEqual(self.client.post("/api/wallet/topup/", {"amount": 20000}, format="json").status_code, 201)
        r = self.book(future(), payment_method="Wallet")
        self.assertEqual((r.status_code, r.data["payment_method"]), (201, "Wallet"))
        self.assertEqual(self.client.get("/api/wallet/").data["balance_kzt"], 15000.0)

    def test_w02_wallet_without_money_rejected(self):
        self.login("ali")
        r = self.book(future(), payment_method="Wallet")
        self.assertEqual((r.status_code, r.data["error"]), (402, "insufficient_funds"))
        self.assertEqual(Booking.objects.count(), 0)

    def test_w03_cancel_wallet_booking_refunds(self):
        self.login("ali")
        self.client.post("/api/wallet/topup/", {"amount": 10000}, format="json")
        bid = self.book(future(), payment_method="Wallet").data["booking_id"]
        self.client.post(f"/api/bookings/{bid}/cancel/")
        self.assertEqual(self.client.get("/api/wallet/").data["balance_kzt"], 10000.0)

    def test_w04_wallet_payment_failure_rolls_back_money(self):
        self.login("ali")
        self.client.post("/api/wallet/topup/", {"amount": 10000}, format="json")
        self.assertEqual(self.book(future(), payment_method="Wallet", simulate_payment_failure=True).status_code, 402)
        self.assertEqual(self.client.get("/api/wallet/").data["balance_kzt"], 10000.0)

    def test_w05_subscription_gives_free_sessions(self):
        self.login("ali")
        self.client.post("/api/wallet/topup/", {"amount": 50000}, format="json")
        self.assertEqual(self.client.post("/api/wallet/subscribe/", {"plan": "month"}, format="json").status_code, 201)
        r = self.book(future(), payment_method="Membership")
        self.assertEqual((r.status_code, float(r.data["amount_kzt"])), (201, 0.0))

    def test_w06_membership_method_needs_subscription(self):
        self.login("ali")
        self.assertEqual(self.book(future(), payment_method="Membership").data["error"], "no_subscription")

    def test_w07_topup_limits(self):
        self.login("ali")
        self.assertEqual(self.client.post("/api/wallet/topup/", {"amount": 10}, format="json").status_code, 422)

    def test_r01_review_after_session_and_rating_average(self):
        b = self.past_done()
        self.login("ali")
        self.assertEqual(self.client.post(f"/api/bookings/{b.pk}/review/", {"rating": 4, "comment": "good"}, format="json").status_code, 201)
        t = self.client.get("/api/trainers/").data[0]
        self.assertEqual((t["avg_rating"], t["reviews_count"]), (4.0, 1))

    def test_r02_review_rules(self):
        b = self.past_done()
        self.login("ali")
        self.assertEqual(self.client.post(f"/api/bookings/{b.pk}/review/", {"rating": 6}, format="json").status_code, 422)
        self.client.post(f"/api/bookings/{b.pk}/review/", {"rating": 5}, format="json")
        self.assertEqual(self.client.post(f"/api/bookings/{b.pk}/review/", {"rating": 5}, format="json").status_code, 409)
        upcoming = self.book(future()).data["booking_id"]
        self.assertEqual(self.client.post(f"/api/bookings/{upcoming}/review/", {"rating": 5}, format="json").status_code, 422)
        self.login("dana")
        self.assertEqual(self.client.post(f"/api/bookings/{b.pk}/review/", {"rating": 5}, format="json").status_code, 403)

    def test_s01_stats_count_only_finished_sessions(self):
        self.past_done(3); self.past_done(4, 11)
        self.login("ali"); self.book(future())
        s = self.client.get("/api/stats/my/").data
        self.assertEqual((s["total_sessions"], s["total_hours"], s["upcoming"]), (2, 2, 1))
        self.assertEqual(s["by_trainer"][0]["sessions"], 2)
