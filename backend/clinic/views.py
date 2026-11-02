from datetime import timedelta
import json
import re

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from openai import OpenAI, OpenAIError
import stripe
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Appointment, Clinic, Invoice, MedicalRecord, Pet, User
from .permissions import IsClinicStaff, IsVeterinarianOrClinicAdmin, is_clinic_staff
from .serializers import (
    AppointmentSerializer,
    ClinicOwnerSerializer,
    ClinicSerializer,
    InvoiceSerializer,
    MedicalRecordSerializer,
    PetSerializer,
    RegistrationSerializer,
    UserSerializer,
    VeterinarianSummarySerializer,
)

REFRESH_COOKIE = "vet_refresh"
COOKIE_SECURE = not settings.DEBUG


class APIHomeView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "ok", "api": "/api/"})


def set_refresh_cookie(response, token):
    response.set_cookie(
        REFRESH_COOKIE,
        str(token),
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="Lax",
        path="/api/auth/",
        max_age=7 * 24 * 60 * 60,
    )
    return response


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = TokenObtainPairSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        response = Response(
            {"access": serializer.validated_data["access"], "user": UserSerializer(serializer.user).data}
        )
        return set_refresh_cookie(response, serializer.validated_data["refresh"])


class RefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.COOKIES.get(REFRESH_COOKIE)
        if not token:
            return Response({"detail": "Refresh session is missing."}, status=status.HTTP_401_UNAUTHORIZED)
        serializer = TokenRefreshSerializer(data={"refresh": token})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError:
            response = Response({"detail": "Refresh session is invalid or expired."}, status=status.HTTP_401_UNAUTHORIZED)
            response.delete_cookie(REFRESH_COOKIE, path="/api/auth/")
            return response
        response = Response({"access": serializer.validated_data["access"]})
        if "refresh" in serializer.validated_data:
            set_refresh_cookie(response, serializer.validated_data["refresh"])
        return response


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.COOKIES.get(REFRESH_COOKIE)
        if token:
            try:
                RefreshToken(token).blacklist()
            except TokenError:
                pass
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(REFRESH_COOKIE, path="/api/auth/")
        return response


class AIStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"available": bool(settings.OPENAI_API_KEY), "model": settings.OPENAI_MODEL})


EMERGENCY_SYMPTOMS = (
    "difficulty breathing", "struggling to breathe", "trouble breathing", "not breathing", "gasping",
    "unconscious", "unresponsive", "seizure", "convulsion", "collapsed", "collapse",
    "uncontrolled bleeding", "bleeding heavily", "hit by a car", "hit by car", "suspected poisoning",
    "ate poison", "swallowed poison", "bloated abdomen", "swollen abdomen", "unable to urinate",
    "cannot urinate", "can't urinate", "straining to urinate with no", "severe trauma",
)


class TriageView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        symptoms = str(request.data.get("symptoms", "")).strip()
        if not symptoms or len(symptoms) > 3000:
            return Response(
                {"detail": "Describe the symptoms in 1 to 3,000 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        normalized = re.sub(r"\s+", " ", symptoms.lower())
        emergency_sign = next((sign for sign in EMERGENCY_SYMPTOMS if sign in normalized), None)
        if emergency_sign:
            return Response({
                "urgency": "emergency",
                "summary": "This may be a life-threatening emergency.",
                "next_steps": [
                    "Go to the nearest emergency veterinarian now or call them while you are on the way.",
                    "Do not wait for an online response. Keep your pet as calm and still as possible.",
                    "Do not give food, medication, or induce vomiting unless a veterinarian instructs you.",
                ],
                "red_flags": [emergency_sign],
                "source": "emergency-safety-screen",
            })

        if not settings.OPENAI_API_KEY:
            return Response({
                "urgency": "same_day",
                "summary": "No emergency phrase was detected, but this screen cannot rule out an urgent problem.",
                "next_steps": [
                    "Call your regular veterinarian today and describe the symptoms and when they began.",
                    "Seek emergency care now if your pet worsens, seems severely unwell, or develops any emergency sign listed on this page.",
                    "Keep your pet comfortable and do not give medication unless a veterinarian directs you.",
                ],
                "red_flags": [],
                "source": "local-safety-screen",
            })
        if request.data.get("consent_to_ai") is not True:
            return Response(
                {"detail": "Confirm that you agree to send this symptom description to the configured AI provider, or contact your veterinarian directly."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        context = {
            "species": str(request.data.get("species", ""))[:80],
            "age": str(request.data.get("age", ""))[:80],
            "symptoms": symptoms,
        }
        try:
            client = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=20.0, max_retries=1)
            completion = client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                response_format={"type": "json_object"},
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a cautious veterinary intake assistant, not a veterinarian. Do not diagnose, "
                            "recommend medication or doses, or replace an examination. Determine only a conservative "
                            "urgency level: emergency, same_day, or routine. If any severe sign may be present, use "
                            "emergency and tell the owner to contact an emergency veterinarian immediately. Return "
                            "JSON with urgency, summary, next_steps (array), and red_flags (array). Keep steps practical "
                            "and safe; do not advise inducing vomiting or giving medication."
                        ),
                    },
                    {"role": "user", "content": json.dumps(context)},
                ],
            )
            result = json.loads(completion.choices[0].message.content or "{}")
            urgency = result.get("urgency")
            if urgency not in {"emergency", "same_day", "routine"}:
                raise ValueError("Invalid triage urgency")
            next_steps = result.get("next_steps", [])
            red_flags = result.get("red_flags", [])
            if not isinstance(next_steps, list) or not isinstance(red_flags, list):
                raise ValueError("Invalid triage response lists")
            return Response({
                "urgency": urgency,
                "summary": str(result.get("summary", ""))[:800],
                "next_steps": [str(step)[:300] for step in next_steps[:5]],
                "red_flags": [str(flag)[:160] for flag in red_flags[:5]],
                "source": "ai-assisted-intake",
            })
        except (OpenAIError, ValueError, TypeError, IndexError, json.JSONDecodeError):
            return Response(
                {"detail": "The AI assistant is temporarily unavailable. Contact your veterinarian directly."},
                status=status.HTTP_502_BAD_GATEWAY,
            )


class AINoteDraftView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.role not in {User.Role.ADMIN, User.Role.VETERINARIAN} or not request.user.clinic_id:
            raise PermissionDenied("Only clinic administrators and veterinarians can draft clinical notes.")
        notes = str(request.data.get("notes", "")).strip()
        if not notes or len(notes) > 5000:
            return Response(
                {"detail": "Enter visit notes in 1 to 5,000 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not settings.OPENAI_API_KEY:
            return Response({"detail": "AI note drafting is not configured."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        if request.data.get("consent_to_ai") is not True:
            return Response(
                {"detail": "Confirm that you agree to send these visit notes to the configured AI provider."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            client = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=20.0, max_retries=1)
            completion = client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                response_format={"type": "json_object"},
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Organize only the clinician's supplied facts into a draft veterinary SOAP note. "
                            "Do not invent findings, diagnosis, medication, or treatment. Leave unsupported fields "
                            "empty. Return JSON with chief_complaint, examination, assessment, treatment_plan, follow_up."
                        ),
                    },
                    {"role": "user", "content": notes},
                ],
            )
            draft = json.loads(completion.choices[0].message.content or "{}")
            fields = ("chief_complaint", "examination", "assessment", "treatment_plan", "follow_up")
            return Response({field: str(draft.get(field, ""))[:2000] for field in fields})
        except (OpenAIError, ValueError, TypeError, json.JSONDecodeError):
            return Response({"detail": "AI note drafting is temporarily unavailable."}, status=status.HTTP_502_BAD_GATEWAY)


class InvoiceViewSet(viewsets.ModelViewSet):
    serializer_class = InvoiceSerializer
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        invoices = Invoice.objects.select_related("clinic", "owner", "pet", "appointment")
        if user.role == User.Role.OWNER:
            return invoices.filter(owner=user)
        if is_clinic_staff(user) and user.clinic_id:
            return invoices.filter(clinic_id=user.clinic_id)
        return Invoice.objects.none()

    def get_permissions(self):
        return [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        if request.user.role not in {User.Role.ADMIN, User.Role.RECEPTIONIST}:
            raise PermissionDenied("Only clinic administrators and receptionists can issue invoices.")
        if not request.user.clinic_id:
            raise PermissionDenied("Assign this account to a clinic before issuing invoices.")
        return super().create(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="checkout")
    def checkout(self, request, pk=None):
        if not settings.STRIPE_SECRET_KEY:
            return Response({"detail": "Online payments are not configured for this prototype."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        invoice = self.get_object()
        if invoice.owner_id != request.user.id:
            raise PermissionDenied("Only the invoice owner can pay this invoice.")
        if invoice.status != Invoice.Status.OPEN:
            return Response({"detail": "This invoice is not open for payment."}, status=status.HTTP_400_BAD_REQUEST)

        stripe.api_key = settings.STRIPE_SECRET_KEY
        try:
            session = stripe.checkout.Session.create(
                mode="payment",
                client_reference_id=str(invoice.pk),
                success_url=f"{settings.APP_BASE_URL}/payments?status=success&session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{settings.APP_BASE_URL}/payments?status=cancelled",
                metadata={"invoice_id": str(invoice.pk)},
                payment_intent_data={"metadata": {"invoice_id": str(invoice.pk)}},
                line_items=[{
                    "quantity": 1,
                    "price_data": {
                        "currency": invoice.currency,
                        "unit_amount": invoice.amount_cents,
                        "product_data": {"name": invoice.description},
                    },
                }],
            )
        except stripe.error.StripeError:
            return Response({"detail": "Stripe could not start checkout. Please try again later."}, status=status.HTTP_502_BAD_GATEWAY)

        invoice.stripe_checkout_session_id = session.id
        invoice.save(update_fields=["stripe_checkout_session_id"])
        return Response({"checkout_url": session.url})

    @action(detail=True, methods=["post"], url_path="demo-pay")
    def demo_pay(self, request, pk=None):
        if not settings.DEBUG or not settings.PAYMENTS_DEMO_MODE:
            return Response({"detail": "Demo payments are disabled."}, status=status.HTTP_404_NOT_FOUND)
        invoice = self.get_object()
        if invoice.owner_id != request.user.id:
            raise PermissionDenied("Only the invoice owner can pay this invoice.")
        if invoice.status != Invoice.Status.OPEN:
            return Response({"detail": "This invoice is not open for payment."}, status=status.HTTP_400_BAD_REQUEST)
        invoice.status = Invoice.Status.DEMO_PAID
        invoice.paid_at = timezone.now()
        invoice.save(update_fields=["status", "paid_at"])
        return Response(InvoiceSerializer(invoice).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def billing_config(request):
    return Response({
        "stripe_configured": bool(settings.STRIPE_SECRET_KEY and settings.STRIPE_WEBHOOK_SECRET),
        "demo_mode": bool(settings.DEBUG and settings.PAYMENTS_DEMO_MODE),
    })


@api_view(["POST"])
@permission_classes([AllowAny])
def stripe_webhook(request):
    if not settings.STRIPE_WEBHOOK_SECRET:
        return Response({"detail": "Stripe webhook is not configured."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    signature = request.headers.get("Stripe-Signature", "")
    try:
        event = stripe.Webhook.construct_event(request.body, signature, settings.STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.error.SignatureVerificationError):
        return Response({"detail": "Invalid Stripe webhook signature."}, status=status.HTTP_400_BAD_REQUEST)

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        invoice_id = session.get("metadata", {}).get("invoice_id")
        if invoice_id and session.get("payment_status") == "paid":
            updated = Invoice.objects.filter(
                pk=invoice_id,
                status=Invoice.Status.OPEN,
                stripe_checkout_session_id=session.get("id"),
            ).update(status=Invoice.Status.PAID, paid_at=timezone.now())
            if updated:
                return Response({"received": True})
    return Response({"received": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def current_user(request):
    return Response(UserSerializer(request.user).data)


class ClinicViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ClinicSerializer
    permission_classes = [AllowAny]
    queryset = Clinic.objects.filter(is_active=True).order_by("name")

    @action(detail=True, methods=["get"], permission_classes=[AllowAny])
    def veterinarians(self, request, pk=None):
        clinic = self.get_object()
        vets = User.objects.filter(
            clinic=clinic, role=User.Role.VETERINARIAN, is_active=True
        ).order_by("last_name", "first_name", "username")
        return Response(VeterinarianSummarySerializer(vets, many=True).data)

    @action(detail=True, methods=["get"], permission_classes=[IsClinicStaff])
    def owners(self, request, pk=None):
        clinic = self.get_object()
        if request.user.clinic_id != clinic.id:
            raise PermissionDenied("You cannot view owners registered with another clinic.")
        owners = User.objects.filter(role=User.Role.OWNER, pets__clinic=clinic).distinct().order_by(
            "last_name", "first_name", "username"
        )
        return Response(ClinicOwnerSerializer(owners, many=True).data)


class PetViewSet(viewsets.ModelViewSet):
    serializer_class = PetSerializer
    filterset_fields = ["clinic", "species"]
    search_fields = ["name", "species", "breed", "owner__email"]
    ordering_fields = ["name", "created_at"]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Pet.objects.none()
        queryset = Pet.objects.select_related("clinic", "owner")
        if user.role == User.Role.OWNER:
            return queryset.filter(owner=user)
        if is_clinic_staff(user):
            queryset = queryset.filter(clinic_id=user.clinic_id)
            if user.role == User.Role.VETERINARIAN:
                return queryset.filter(Q(appointments__veterinarian=user) | Q(medical_records__veterinarian=user)).distinct()
            return queryset
        return Pet.objects.none()

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticated()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user if self.request.user.role == User.Role.OWNER else serializer.validated_data.get("owner"))


class AppointmentViewSet(viewsets.ModelViewSet):
    serializer_class = AppointmentSerializer
    filterset_fields = ["status", "veterinarian", "pet"]
    search_fields = ["pet__name", "reason"]
    ordering_fields = ["starts_at", "created_at"]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Appointment.objects.none()
        queryset = Appointment.objects.select_related("clinic", "pet", "pet__owner", "veterinarian")
        if user.role == User.Role.OWNER:
            return queryset.filter(pet__owner=user)
        if user.role == User.Role.VETERINARIAN:
            return queryset.filter(clinic_id=user.clinic_id, veterinarian=user)
        if user.role in {User.Role.ADMIN, User.Role.RECEPTIONIST} and user.clinic_id:
            return queryset.filter(clinic_id=user.clinic_id)
        return Appointment.objects.none()

    def get_permissions(self):
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        start = serializer.validated_data["starts_at"]
        duration = serializer.validated_data["duration_minutes"]
        end = start + timedelta(minutes=duration)
        clinic = serializer.validated_data["clinic"]
        vet = serializer.validated_data["veterinarian"]
        with transaction.atomic():
            Clinic.objects.select_for_update().get(pk=clinic.pk)
            upcoming = Appointment.objects.filter(
                veterinarian=vet,
                status__in=[Appointment.Status.BOOKED, Appointment.Status.CHECKED_IN],
                starts_at__lt=end,
                starts_at__gt=start - timedelta(minutes=240),
            )
            for existing in upcoming:
                existing_end = existing.starts_at + timedelta(minutes=existing.duration_minutes)
                if existing_end > start:
                    from rest_framework.exceptions import ValidationError

                    raise ValidationError({"starts_at": "This veterinarian already has an overlapping appointment."})
            serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        user = self.request.user
        new_status = serializer.validated_data.get("status")
        appointment = self.get_object()
        if user.role == User.Role.OWNER:
            if new_status not in (None, Appointment.Status.CANCELLED):
                raise PermissionDenied("Pet owners may only cancel their own appointments.")
            if new_status == Appointment.Status.CANCELLED:
                if appointment.status != Appointment.Status.BOOKED:
                    raise ValidationError({"status": "Only booked appointments can be cancelled."})
                if appointment.starts_at <= timezone.now():
                    raise ValidationError({"status": "Past appointments cannot be cancelled."})
        elif user.role == User.Role.VETERINARIAN and new_status not in (
            None, Appointment.Status.CHECKED_IN, Appointment.Status.COMPLETED
        ):
            raise PermissionDenied("Veterinarians may only update appointment progress.")
        starts_at = serializer.validated_data.get("starts_at", appointment.starts_at)
        duration = serializer.validated_data.get("duration_minutes", appointment.duration_minutes)
        veterinarian = serializer.validated_data.get("veterinarian", appointment.veterinarian)
        new_status = serializer.validated_data.get("status", appointment.status)
        if new_status not in {Appointment.Status.BOOKED, Appointment.Status.CHECKED_IN}:
            serializer.save()
            return
        end = starts_at + timedelta(minutes=duration)
        with transaction.atomic():
            Clinic.objects.select_for_update().get(pk=appointment.clinic_id)
            upcoming = Appointment.objects.filter(
                veterinarian=veterinarian,
                status__in=[Appointment.Status.BOOKED, Appointment.Status.CHECKED_IN],
                starts_at__lt=end,
                starts_at__gt=starts_at - timedelta(minutes=240),
            ).exclude(pk=appointment.pk)
            for existing in upcoming:
                if existing.starts_at + timedelta(minutes=existing.duration_minutes) > starts_at:
                    raise ValidationError({"starts_at": "This veterinarian already has an overlapping appointment."})
            serializer.save()


class MedicalRecordViewSet(viewsets.ModelViewSet):
    serializer_class = MedicalRecordSerializer
    filterset_fields = ["pet", "status"]
    ordering_fields = ["created_at", "updated_at"]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return MedicalRecord.objects.none()
        records = MedicalRecord.objects.select_related("pet", "clinic", "veterinarian", "appointment")
        if user.role == User.Role.OWNER:
            return records.filter(pet__owner=user, status=MedicalRecord.Status.FINALIZED)
        if user.role == User.Role.ADMIN and user.clinic_id:
            return records.filter(clinic_id=user.clinic_id)
        if user.role == User.Role.VETERINARIAN and user.clinic_id:
            return records.filter(clinic_id=user.clinic_id).filter(
                Q(appointment__veterinarian=user) | Q(veterinarian=user)
            )
        return MedicalRecord.objects.none()

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [IsVeterinarianOrClinicAdmin()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(veterinarian=self.request.user)
