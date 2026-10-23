from rest_framework.permissions import BasePermission, SAFE_METHODS

from .models import User


def is_clinic_staff(user):
    return user.is_authenticated and user.role in {
        User.Role.ADMIN,
        User.Role.VETERINARIAN,
        User.Role.RECEPTIONIST,
    }


class IsClinicStaff(BasePermission):
    def has_permission(self, request, view):
        return is_clinic_staff(request.user) and request.user.clinic_id is not None


class IsVeterinarianOrClinicAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in {
            User.Role.ADMIN,
            User.Role.VETERINARIAN,
        } and request.user.clinic_id is not None
