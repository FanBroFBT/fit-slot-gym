from rest_framework.permissions import BasePermission


def role_of(user):
    profile = getattr(user, "profile", None)
    return profile.role if profile else None


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and role_of(request.user) == "admin")


class IsMemberRole(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and role_of(request.user) == "member")


class IsOwnerOrAdmin(BasePermission):
    """IDOR қорғанысы: қолданушы тек өз деректеріне (Booking, Wallet, Profile) қол жеткізе алады."""

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return False
        if role_of(request.user) == "admin" or request.user.is_staff:
            return True

        # 1. Егер объектінің өзі User болса
        if obj == request.user:
            return True

        # 2. Егер объектіде тікелей `user` өрісі болса
        if getattr(obj, "user", None) == request.user:
            return True

        # 3. Егер объект `Member` болса (profile.member немесе member.user арқылы тексеру)
        user_profile = getattr(request.user, "profile", None)
        user_member = getattr(user_profile, "member", None) or getattr(request.user, "member", None)

        if user_member and obj == user_member:
            return True

        # 4. Егер объект `Booking` немесе `WalletTransaction` (ішінде `member` бар) болса
        obj_member = getattr(obj, "member", None)
        if obj_member:
            if user_member and obj_member == user_member:
                return True
            if getattr(obj_member, "user", None) == request.user:
                return True

        return False