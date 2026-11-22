from django.db import migrations


def add_demo_certificates(apps, schema_editor):
    Trainer = apps.get_model('bookings', 'Trainer')
    Certificate = apps.get_model('bookings', 'TrainerCertificate')
    for index, trainer in enumerate(Trainer.objects.order_by('trainer_id'), start=1):
        updates = []
        if not trainer.bio:
            trainer.bio = f'{trainer.full_name} provides tailored {trainer.specialization.lower()} coaching at FitSlot in Almaty.'
            updates.append('bio')
        if not trainer.experience_years:
            trainer.experience_years = 3 + index
            updates.append('experience_years')
        if updates:
            trainer.save(update_fields=updates)
        Certificate.objects.get_or_create(trainer=trainer, title=f'{trainer.specialization} Coach (Demo)',
            defaults={'issuer': 'FitSlot Demo Academy', 'year': 2021 + index % 5,
                      'credential_id': f'DEMO-FS-{index:02d}-A'})
        Certificate.objects.get_or_create(trainer=trainer, title='First Aid & CPR (Demo)',
            defaults={'issuer': 'FitSlot Demo Academy', 'year': 2024,
                      'credential_id': f'DEMO-FS-{index:02d}-B'})


class Migration(migrations.Migration):
    dependencies = [('bookings', '0004_notification_review_trainercertificate_and_more')]
    operations = [migrations.RunPython(add_demo_certificates, migrations.RunPython.noop)]
