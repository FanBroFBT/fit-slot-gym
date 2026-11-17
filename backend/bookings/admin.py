from django.contrib import admin
from .models import Booking, Member, News, Payment, Profile, Review, Trainer, WalletTransaction

for m in (Member, Trainer, Booking, Payment, Profile, News, WalletTransaction, Review):
    admin.site.register(m)
