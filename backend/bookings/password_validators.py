import re
from django.core.exceptions import ValidationError

class StrongPasswordValidator:
    def validate(self, password, user=None):
        if not 8 <= len(password) <= 64:
            raise ValidationError('Password must contain 8–64 characters.')
        if not all((re.search(r'[A-Z]', password), re.search(r'[a-z]', password),
                    re.search(r'\d', password), re.search(r'[^A-Za-z0-9]', password))):
            raise ValidationError('Password requires uppercase, lowercase, digit and special character.')
        if user:
            forbidden = [getattr(user, 'username', ''), getattr(user, 'email', ''),
                         getattr(user, 'first_name', ''), getattr(user, 'last_name', '')]
            for value in forbidden:
                if not value:
                    continue
                parts = [value, *re.split(r'[\s@._-]+', value)]
                if any(len(part) >= 3 and part.lower() in password.lower() for part in parts):
                    raise ValidationError('Password must not contain your name or email.')

    def get_help_text(self):
        return '8–64 characters, upper/lowercase, digit and special character; no name or email.'
