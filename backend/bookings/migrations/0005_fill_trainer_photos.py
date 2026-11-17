"""Fills the photo of every trainer that has none (the old database was created before the photo field existed)."""
from django.db import migrations

CROP = "?w=600&h=600&fit=crop&crop=faces,center&auto=format&q=80"
BASE = "https://images.unsplash.com/"
BY_SPECIALIZATION = {
    "strength": "photo-1534438327276-14e5300c3a48",
    "cardio": "photo-1540497077202-7c8a3999166f",
    "yoga": "photo-1518611012118-696072aa579a",
    "boxing": "photo-1567013127542-490d757e51fc",
    "crossfit": "photo-1594381898411-846e7d193883",
    "pilates": "photo-1518310383802-640c2de311b2",
}
DEFAULT = "photo-1571019613454-1cb2f99b2d8b"      # generic gym photo for any other specialization


def fill(apps, schema_editor):
    Trainer = apps.get_model("bookings", "Trainer")
    for t in Trainer.objects.filter(photo__isnull=True) | Trainer.objects.filter(photo=""):
        t.photo = BASE + BY_SPECIALIZATION.get(t.specialization.strip().lower(), DEFAULT) + CROP
        t.save(update_fields=["photo"])


class Migration(migrations.Migration):
    dependencies = [("bookings", "0004_wallet_reviews")]
    operations = [migrations.RunPython(fill, migrations.RunPython.noop)]
