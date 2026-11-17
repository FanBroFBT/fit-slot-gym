"""python manage.py seed : demo data (6 trainers with photos, 12 members, about 25 bookings, 2 demo accounts)."""
import random
from datetime import date, datetime, timedelta
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.utils import timezone
from bookings.management.commands.seed_extras import add_demo_extras
from bookings.models import Booking, Member, Payment, Profile, Trainer
from bookings.clock import now_local

# Тренерлердің аты, бағыты, жұмыс уақыты және аттарына сәйкес сапалы фото сілтемелері
CROP = "?w=600&h=600&fit=crop&crop=faces,center&auto=format&q=80"
TRAINERS = [
    ("Arman Bekov", "Strength", "07:00-15:00", "https://images.unsplash.com/photo-1534438327276-14e5300c3a48" + CROP),
    ("Dana Seitkali", "Cardio", "09:00-17:00", "https://images.unsplash.com/photo-1540497077202-7c8a3999166f" + CROP),
    ("Aliya Nurlanova", "Yoga", "08:00-14:00", "https://images.unsplash.com/photo-1518611012118-696072aa579a" + CROP),
    ("Timur Nurlan", "Boxing", "10:00-20:00", "https://images.unsplash.com/photo-1567013127542-490d757e51fc" + CROP),
    ("Madina Serik", "CrossFit", "06:00-14:00", "https://images.unsplash.com/photo-1594381898411-846e7d193883" + CROP),
    ("Sofia Ibragim", "Pilates", "09:00-18:00", "https://images.unsplash.com/photo-1518310383802-640c2de311b2" + CROP)
]

MEMBERS = [
    ("Ali Bekov", "Active"), ("Dana Kassym", "Active"), ("Sara Abenova", "Active"), ("Nurzhan Tolegen", "Active"),
    ("Aida Mukhan", "Active"), ("Ruslan Zhaksy", "Active"), ("Amina Daurenova", "Active"), ("Yerlan Akhmet", "Active"),
    ("Laura Sultan", "Active"), ("Marat Bolat", "Expired"), ("Zhanar Kaiyr", "Expired"), ("Asel Nurmat", "Frozen")
]


class Command(BaseCommand):
    def handle(self, *args, **options):
        if Trainer.objects.exists():
            self.stdout.write("Database already has data. Delete gym.sqlite3 to reseed.")
            return
        
        rnd, now = random.Random(42), now_local()
        
        # Тренерлерді базаға фотоларымен қосу
        trainers = [
            Trainer.objects.create(
                full_name=n, 
                specialization=s, 
                working_hours=h, 
                phone="+7 700 111 00%02d" % i,
                photo=p  # Тренер фотосы
            )
            for i, (n, s, h, p) in enumerate(TRAINERS, 1)
        ]
        
        members = []
        for i, (name, st) in enumerate(MEMBERS, 1):
            members.append(Member.objects.create(
                full_name=name, membership_status=st, phone="+7 700 000 00%02d" % i,
                email=f"member{i}@gym.kz", membership_end_date=date.today() + timedelta(days=200 if st == "Active" else -10)
            ))
            
        admin = User.objects.create_user("admin@gym.kz", "admin@gym.kz", "admin123")
        Profile.objects.create(user=admin, role="admin")
        
        demo = User.objects.create_user("member@gym.kz", "member@gym.kz", "member123")
        Profile.objects.create(user=demo, role="member", member=members[0])
        
        active, weights, used = [m for m in members if m.membership_status == "Active"], [5, 3, 2, 2, 1, 1], set()
        created = 0
        
        while created < 26:
            t = rnd.choices(trainers, weights)[0]
            day = (now + timedelta(days=rnd.randint(-10, 10))).date()
            a, b = t.hours()
            hour = rnd.randint(a.hour, b.hour - 1)
            start = datetime(day.year, day.month, day.day, hour)
            
            if (t.pk, start) in used:
                continue
            used.add((t.pk, start))
            
            past = start < now
            status = "Completed" if past else "Confirmed"
            if rnd.random() < 0.12:
                status = "Cancelled"
                
            booking = Booking.objects.create(member=rnd.choice(active), trainer=t, session_start=start, status=status)
            Payment.objects.create(
                booking=booking, amount_kzt=5000, payment_method=rnd.choice(["Card", "Kaspi"]),
                payment_status="Paid", paid_at=booking.created_at
            )
            created += 1
            
        add_demo_extras(self.stdout)      # demo wallet + trainer reviews
        self.stdout.write(self.style.SUCCESS("Seeded with photos! Accounts: admin@gym.kz / admin123 and member@gym.kz / member123"))
