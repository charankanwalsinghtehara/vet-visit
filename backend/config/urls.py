from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from clinic.views import (
    AINoteDraftView,
    AIStatusView,
    AppointmentViewSet,
    ClinicViewSet,
    InvoiceViewSet,
    LoginView,
    LogoutView,
    MedicalRecordViewSet,
    PetViewSet,
    RefreshView,
    RegisterView,
    TriageView,
    billing_config,
    current_user,
    stripe_webhook,
)

router = DefaultRouter()
router.register("clinics", ClinicViewSet, basename="clinic")
router.register("pets", PetViewSet, basename="pet")
router.register("appointments", AppointmentViewSet, basename="appointment")
router.register("records", MedicalRecordViewSet, basename="record")
router.register("invoices", InvoiceViewSet, basename="invoice")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/register/", RegisterView.as_view(), name="register"),
    path("api/auth/login/", LoginView.as_view(), name="login"),
    path("api/auth/refresh/", RefreshView.as_view(), name="refresh"),
    path("api/auth/logout/", LogoutView.as_view(), name="logout"),
    path("api/auth/me/", current_user, name="current-user"),
    path("api/ai/status/", AIStatusView.as_view(), name="ai-status"),
    path("api/ai/triage/", TriageView.as_view(), name="ai-triage"),
    path("api/ai/note-draft/", AINoteDraftView.as_view(), name="ai-note-draft"),
    path("api/billing/config/", billing_config, name="billing-config"),
    path("api/billing/stripe/webhook/", stripe_webhook, name="stripe-webhook"),
    path("api/", include(router.urls)),
]
