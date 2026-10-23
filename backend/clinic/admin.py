from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Appointment, Clinic, Invoice, MedicalRecord, Pet, User


@admin.register(User)
class ClinicUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("Clinic access", {"fields": ("role", "clinic", "phone")}),)
    list_display = ["username", "email", "role", "clinic", "is_active"]
    list_filter = ["role", "clinic", "is_active"]


admin.site.register(Clinic)
admin.site.register(Pet)
admin.site.register(Appointment)
admin.site.register(MedicalRecord)
admin.site.register(Invoice)
