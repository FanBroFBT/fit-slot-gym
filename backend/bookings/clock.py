from django.utils import timezone

def now_local():
    return timezone.localtime() if timezone.is_aware(timezone.now()) else timezone.now()
