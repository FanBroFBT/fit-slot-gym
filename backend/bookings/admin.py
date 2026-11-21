from django.contrib import admin
from .models import Booking, Member, Payment, Profile, Trainer

for m in (Member, Trainer, Booking, Payment, Profile):
    admin.site.register(m)
