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

class IsTrainerRole(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and role_of(request.user) == "trainer")

class IsMemberOrTrainerRole(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and role_of(request.user) in ("member", "trainer"))