from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

from django.utils import timezone
from django.test import override_settings
from rest_framework.test import APITestCase

from .models import Appointment, Clinic, Invoice, MedicalRecord, Pet, User


class ClinicApiTests(APITestCase):
    def setUp(self):
        self.clinic = Clinic.objects.create(name="Northside Veterinary", slug="northside")
        self.other_clinic = Clinic.objects.create(name="Lakeside Veterinary", slug="lakeside")
        self.owner = User.objects.create_user(
            username="owner", email="owner@example.com", password="Strong-pass-2026", role=User.Role.OWNER
        )
        self.other_owner = User.objects.create_user(
            username="other-owner", email="other@example.com", password="Strong-pass-2026", role=User.Role.OWNER
        )
        self.vet = User.objects.create_user(
            username="vet", email="vet@example.com", password="Strong-pass-2026",
            role=User.Role.VETERINARIAN, clinic=self.clinic
        )
        self.admin = User.objects.create_user(
            username="admin", email="admin@example.com", password="Strong-pass-2026",
            role=User.Role.ADMIN, clinic=self.clinic
        )
        self.pet = Pet.objects.create(clinic=self.clinic, owner=self.owner, name="Milo", species="Cat")
        self.other_pet = Pet.objects.create(
            clinic=self.other_clinic, owner=self.other_owner, name="Nori", species="Dog"
        )

    def test_owner_pet_list_is_limited_to_the_authenticated_owner(self):
        self.client.force_authenticate(self.owner)

        response = self.client.get("/api/pets/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([pet["name"] for pet in response.data["results"]], ["Milo"])

    def test_owner_cannot_read_another_owners_pet_by_id(self):
        self.client.force_authenticate(self.owner)

        response = self.client.get(f"/api/pets/{self.other_pet.id}/")

        self.assertEqual(response.status_code, 404)

    def test_pet_owner_sees_only_their_finalized_medical_records(self):
        draft = MedicalRecord.objects.create(
            clinic=self.clinic, pet=self.pet, veterinarian=self.vet, status=MedicalRecord.Status.DRAFT
        )
        final = MedicalRecord.objects.create(
            clinic=self.clinic, pet=self.pet, veterinarian=self.vet, status=MedicalRecord.Status.FINALIZED
        )
        MedicalRecord.objects.create(
            clinic=self.other_clinic, pet=self.other_pet, veterinarian=self.vet, status=MedicalRecord.Status.FINALIZED
        )
        self.client.force_authenticate(self.owner)

        response = self.client.get("/api/records/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([record["id"] for record in response.data["results"]], [final.id])
        self.assertNotEqual(draft.id, final.id)

    def test_veterinarian_records_are_limited_to_assigned_or_authored_records(self):
        other_vet = User.objects.create_user(
            username="other-vet", email="other-vet@example.com", password="Strong-pass-2026",
            role=User.Role.VETERINARIAN, clinic=self.clinic
        )
        own_record = MedicalRecord.objects.create(
            clinic=self.clinic, pet=self.pet, veterinarian=self.vet
        )
        MedicalRecord.objects.create(
            clinic=self.clinic, pet=self.pet, veterinarian=other_vet
        )
        self.client.force_authenticate(self.vet)

        response = self.client.get("/api/records/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([record["id"] for record in response.data["results"]], [own_record.id])

    def test_overlapping_veterinarian_appointments_are_rejected(self):
        self.client.force_authenticate(self.owner)
        start = timezone.now() + timedelta(days=1)
        first = {
            "clinic": self.clinic.id,
            "pet": self.pet.id,
            "veterinarian": self.vet.id,
            "starts_at": start.isoformat(),
            "duration_minutes": 30,
            "reason": "Check-up",
        }
        first_response = self.client.post("/api/appointments/", first, format="json")
        conflicting = {**first, "starts_at": (start + timedelta(minutes=15)).isoformat()}

        second_response = self.client.post("/api/appointments/", conflicting, format="json")

        self.assertEqual(first_response.status_code, 201)
        self.assertEqual(second_response.status_code, 400)
        self.assertIn("overlapping", str(second_response.data).lower())

    def test_owner_cannot_book_another_owners_pet(self):
        self.client.force_authenticate(self.owner)

        response = self.client.post(
            "/api/appointments/",
            {
                "clinic": self.other_clinic.id,
                "pet": self.other_pet.id,
                "veterinarian": self.vet.id,
                "starts_at": (timezone.now() + timedelta(days=1)).isoformat(),
                "duration_minutes": 30,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_registration_cannot_assign_an_elevated_role(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "new-owner",
                "email": "new-owner@example.com",
                "password": "Safe-password-2026",
                "first_name": "New",
                "last_name": "Owner",
                "role": User.Role.ADMIN,
                "clinic": self.clinic.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        created = User.objects.get(username="new-owner")
        self.assertEqual(created.role, User.Role.OWNER)
        self.assertIsNone(created.clinic_id)

    def test_clinic_owner_directory_is_not_public(self):
        self.client.force_authenticate(self.owner)

        response = self.client.get(f"/api/clinics/{self.clinic.id}/owners/")

        self.assertEqual(response.status_code, 403)

    def test_staff_cannot_read_another_clinics_owner_directory(self):
        self.client.force_authenticate(self.admin)

        response = self.client.get(f"/api/clinics/{self.other_clinic.id}/owners/")

        self.assertEqual(response.status_code, 403)

    def test_login_returns_short_lived_access_token_and_httponly_refresh_cookie(self):
        response = self.client.post(
            "/api/auth/login/",
            {"username": "owner", "password": "Strong-pass-2026"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertNotIn("refresh", response.data)
        self.assertTrue(response.cookies["vet_refresh"]["httponly"])

    def test_refresh_rotates_cookie_and_logout_revokes_it(self):
        login = self.client.post(
            "/api/auth/login/",
            {"username": "owner", "password": "Strong-pass-2026"},
            format="json",
        )
        original_refresh = login.cookies["vet_refresh"].value

        refreshed = self.client.post("/api/auth/refresh/")

        self.assertEqual(refreshed.status_code, 200)
        self.assertNotEqual(refreshed.cookies["vet_refresh"].value, original_refresh)
        logout = self.client.post("/api/auth/logout/")
        self.assertEqual(logout.status_code, 204)
        self.assertEqual(self.client.post("/api/auth/refresh/").status_code, 401)

    @override_settings(OPENAI_API_KEY="")
    def test_emergency_triage_escalates_without_ai_provider(self):
        self.client.force_authenticate(self.owner)

        response = self.client.post(
            "/api/ai/triage/",
            {"symptoms": "My cat is struggling to breathe"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["urgency"], "emergency")
        self.assertEqual(response.data["source"], "emergency-safety-screen")

    @override_settings(OPENAI_API_KEY="")
    def test_non_emergency_triage_uses_local_guidance_without_ai_provider(self):
        self.client.force_authenticate(self.owner)

        response = self.client.post(
            "/api/ai/triage/",
            {"symptoms": "My cat has been sneezing twice today"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["source"], "local-safety-screen")
        self.assertEqual(response.data["urgency"], "same_day")

    @override_settings(OPENAI_API_KEY="placeholder")
    def test_non_emergency_triage_requires_explicit_provider_consent(self):
        self.client.force_authenticate(self.owner)

        response = self.client.post(
            "/api/ai/triage/",
            {"symptoms": "My cat has been sneezing twice today"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("agree", response.data["detail"])

    @override_settings(OPENAI_API_KEY="placeholder")
    def test_clinical_note_draft_requires_explicit_provider_consent(self):
        self.client.force_authenticate(self.vet)

        response = self.client.post(
            "/api/ai/note-draft/",
            {"notes": "Bright, alert, normal appetite"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("agree", response.data["detail"])

    def test_pet_owner_cannot_request_clinical_note_draft(self):
        self.client.force_authenticate(self.owner)

        response = self.client.post("/api/ai/note-draft/", {"notes": "Wellness check"}, format="json")

        self.assertEqual(response.status_code, 403)

    def test_owner_cannot_issue_an_invoice(self):
        self.client.force_authenticate(self.owner)

        response = self.client.post(
            "/api/invoices/",
            {
                "clinic": self.clinic.id,
                "owner": self.owner.id,
                "pet": self.pet.id,
                "description": "Wellness exam",
                "amount_cents": 8500,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_staff_can_issue_invoice_and_owner_can_list_it(self):
        self.client.force_authenticate(self.admin)
        created = self.client.post(
            "/api/invoices/",
            {
                "clinic": self.clinic.id,
                "owner": self.owner.id,
                "pet": self.pet.id,
                "description": "Wellness exam",
                "amount_cents": 8500,
            },
            format="json",
        )

        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["status"], Invoice.Status.OPEN)
        self.client.force_authenticate(self.owner)

        listed = self.client.get("/api/invoices/")

        self.assertEqual(listed.status_code, 200)
        self.assertEqual([item["id"] for item in listed.data["results"]], [created.data["id"]])

    @override_settings(STRIPE_SECRET_KEY="")
    def test_checkout_is_unavailable_without_stripe_configuration(self):
        invoice = Invoice.objects.create(
            clinic=self.clinic,
            owner=self.owner,
            pet=self.pet,
            description="Wellness exam",
            amount_cents=8500,
        )
        self.client.force_authenticate(self.owner)

        response = self.client.post(f"/api/invoices/{invoice.id}/checkout/", {}, format="json")

        self.assertEqual(response.status_code, 503)

    @override_settings(STRIPE_SECRET_KEY="sk_test_configured")
    def test_checkout_uses_the_stored_invoice_amount(self):
        invoice = Invoice.objects.create(
            clinic=self.clinic,
            owner=self.owner,
            pet=self.pet,
            description="Wellness exam",
            amount_cents=8500,
        )
        self.client.force_authenticate(self.owner)
        with patch(
            "clinic.views.stripe.checkout.Session.create",
            return_value=SimpleNamespace(id="cs_test_invoice", url="https://checkout.stripe.test/session"),
        ) as create_session:
            response = self.client.post(f"/api/invoices/{invoice.id}/checkout/", {}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["checkout_url"], "https://checkout.stripe.test/session")
        self.assertEqual(create_session.call_args.kwargs["line_items"][0]["price_data"]["unit_amount"], 8500)
        invoice.refresh_from_db()
        self.assertEqual(invoice.stripe_checkout_session_id, "cs_test_invoice")

    @override_settings(DEBUG=True, PAYMENTS_DEMO_MODE=True)
    def test_demo_payment_is_labeled_and_does_not_claim_a_stripe_payment(self):
        invoice = Invoice.objects.create(
            clinic=self.clinic,
            owner=self.owner,
            pet=self.pet,
            description="Wellness exam",
            amount_cents=8500,
        )
        self.client.force_authenticate(self.owner)

        response = self.client.post(f"/api/invoices/{invoice.id}/demo-pay/", {}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], Invoice.Status.DEMO_PAID)
        self.assertEqual(response.data["status"], "demo_paid")

    @override_settings(DEBUG=False, PAYMENTS_DEMO_MODE=True)
    def test_demo_payment_is_disabled_outside_debug_mode(self):
        invoice = Invoice.objects.create(
            clinic=self.clinic,
            owner=self.owner,
            pet=self.pet,
            description="Wellness exam",
            amount_cents=8500,
        )
        self.client.force_authenticate(self.owner)

        response = self.client.post(f"/api/invoices/{invoice.id}/demo-pay/", {}, format="json")

        self.assertEqual(response.status_code, 404)
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, Invoice.Status.OPEN)

    @override_settings(STRIPE_WEBHOOK_SECRET="whsec_test_configured")
    def test_verified_stripe_completion_marks_invoice_paid(self):
        invoice = Invoice.objects.create(
            clinic=self.clinic,
            owner=self.owner,
            pet=self.pet,
            description="Wellness exam",
            amount_cents=8500,
            stripe_checkout_session_id="cs_test_invoice",
        )
        event = {
            "type": "checkout.session.completed",
            "data": {"object": {
                "id": "cs_test_invoice",
                "payment_status": "paid",
                "metadata": {"invoice_id": str(invoice.id)},
            }},
        }
        with patch("clinic.views.stripe.Webhook.construct_event", return_value=event):
            response = self.client.generic(
                "POST",
                "/api/billing/stripe/webhook/",
                b"{}",
                content_type="application/json",
                HTTP_STRIPE_SIGNATURE="test-signature",
            )

        self.assertEqual(response.status_code, 200)
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, Invoice.Status.PAID)
        self.assertIsNotNone(invoice.paid_at)
