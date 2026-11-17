import re
from django.core.exceptions import ValidationError


class StrongPasswordValidator:
    """Пароль күрделілігін тексеру валидаторы (кемінде 8 таңба, бас/кіші әріп, сан, арнайы таңба)."""

    def validate(self, password, user=None):
        if len(password) < 8 or len(password) > 64:
            raise ValidationError("Пароль ұзындығы 8 мен 64 таңба аралығында болуы керек.")
        if not re.search(r"[A-Z]", password):
            raise ValidationError("Парольде кемінде 1 бас әріп (A-Z) болуы керек.")
        if not re.search(r"[a-z]", password):
            raise ValidationError("Парольде кемінде 1 кіші әріп (a-z) болуы керек.")
        if not re.search(r"\d", password):
            raise ValidationError("Парольде кемінде 1 цифр (0-9) болуы керек.")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>_\-]", password):
            raise ValidationError("Парольде кемінде 1 арнайы таңба (!@#$%^&*...) болуы керек.")

        if user:
            username = getattr(user, "username", "") or ""
            email_prefix = (getattr(user, "email", "") or "").split("@")[0]
            if username and len(username) >= 3 and username.lower() in password.lower():
                raise ValidationError("Пароль қолданушы атын (username) қайталамауы керек.")
            if email_prefix and len(email_prefix) >= 3 and email_prefix.lower() in password.lower():
                raise ValidationError("Пароль email атауын қайталамауы керек.")

    def get_help_text(self):
        return (
            "Пароль кемінде 8 таңбадан тұруы, құрамында бас әріп, кіші әріп, "
            "цифр және арнайы таңба болуы шарт."
        )