
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from clinic.models import (
    Appointment,
    Clinic,
    Invoice,
    MedicalRecord,
    Pet,
    User,
)


class Command(BaseCommand):
    help = "Create fictional Indian clinic data and demo accounts."

    def handle(self, *args, **options):
        if not settings.DEBUG and not settings.ALLOW_DEMO_SEED:
            raise CommandError(
                "Demo seeding disabled. "
                "Set ALLOW_DEMO_SEED=true temporarily."
            )

        demo_password = settings.DEMO_PASSWORD

        if not demo_password or len(demo_password) < 12:
            raise CommandError(
                "Set a demo password of at least 12 characters."
            )

        with transaction.atomic():
            bengaluru, _ = Clinic.objects.update_or_create(
                slug="demo-bengaluru",
                defaults={
                    "name": "Demo Paws Veterinary Clinic",
                    "email": "bengaluru@demo.invalid",
                    "phone": "+91 80 5550 0101",
                    "address": (
                        "12 Example Road, Indiranagar, Bengaluru, "
                        "Karnataka 560038, India"
                    ),
                    "business_hours": {
                        "weekdays": "09:00-18:00",
                        "saturday": "09:00-14:00",
                    },
                    "is_active": True,
                },
            )

            pune, _ = Clinic.objects.update_or_create(
                slug="demo-pune",
                defaults={
                    "name": "Demo Companion Animal Care",
                    "email": "pune@demo.invalid",
                    "phone": "+91 20 5550 0102",
                    "address": (
                        "24 Example Lane, Koregaon Park, Pune, "
                        "Maharashtra 411001, India"
                    ),
                    "business_hours": {
                        "weekdays": "09:00-18:00",
                        "saturday": "09:00-14:00",
                    },
                    "is_active": True,
                },
            )

            owner = self.demo_user(
                "demo-owner",
                "owner@demo.invalid",
                "Pet Owner",
                User.Role.OWNER,
                demo_password,
            )

            vet = self.demo_user(
                "demo-vet",
                "vet@demo.invalid",
                "Veterinarian",
                User.Role.VETERINARIAN,
                demo_password,
                bengaluru,
            )

            self.demo_user(
                "demo-admin",
                "admin@demo.invalid",
                "Administrator",
                User.Role.ADMIN,
                demo_password,
                bengaluru,
            )

            self.demo_user(
                "demo-receptionist",
                "receptionist@demo.invalid",
                "Receptionist",
                User.Role.RECEPTIONIST,
                demo_password,
                bengaluru,
            )

            simba, _ = Pet.objects.update_or_create(
                clinic=bengaluru,
                owner=owner,
                name="Simba",
                defaults={
                    "species": "Cat",
                    "breed": "Indie",
                    "date_of_birth": (
                        timezone.localdate() - timedelta(days=900)
                    ),
                    "sex": Pet.Sex.MALE,
                    "weight_kg": "4.20",
                    "allergies": "",
                    "existing_conditions": "",
                },
            )

            coco, _ = Pet.objects.update_or_create(
                clinic=bengaluru,
                owner=owner,
                name="Coco",
                defaults={
                    "species": "Dog",
                    "breed": "Indian Pariah",
                    "date_of_birth": (
                        timezone.localdate() - timedelta(days=540)
                    ),
                    "sex": Pet.Sex.FEMALE,
                    "weight_kg": "12.50",
                    "allergies": "",
                    "existing_conditions": "",
                },
            )

            now = timezone.now()

            completed, _ = Appointment.objects.update_or_create(
                clinic=bengaluru,
                pet=simba,
                veterinarian=vet,
                reason="DEMO: routine wellness visit",
                defaults={
                    "starts_at": now - timedelta(days=7),
                    "duration_minutes": 30,
                    "status": Appointment.Status.COMPLETED,
                    "created_by": owner,
                },
            )

            Appointment.objects.update_or_create(
                clinic=bengaluru,
                pet=coco,
                veterinarian=vet,
                reason="DEMO: routine wellness visit",
                defaults={
                    "starts_at": now + timedelta(days=2),
                    "duration_minutes": 30,
                    "status": Appointment.Status.BOOKED,
                    "created_by": owner,
                },
            )

            MedicalRecord.objects.update_or_create(
                appointment=completed,
                defaults={
                    "clinic": bengaluru,
                    "pet": simba,
                    "veterinarian": vet,
                    "status": MedicalRecord.Status.FINALIZED,
                    "chief_complaint": (
                        "DEMO ONLY: fictional routine wellness visit."
                    ),
                    "examination": (
                        "DEMO ONLY: example record; "
                        "no real examination took place."
                    ),
                    "assessment": (
                        "DEMO ONLY: fictional sample, not a diagnosis."
                    ),
                    "treatment_plan": (
                        "DEMO ONLY: consult a licensed veterinarian "
                        "for actual care."
                    ),
                    "follow_up": "DEMO ONLY: sample follow-up entry.",
                },
            )

            MedicalRecord.objects.update_or_create(
                clinic=bengaluru,
                pet=coco,
                veterinarian=vet,
                status=MedicalRecord.Status.DRAFT,
                defaults={
                    "appointment": None,
                    "chief_complaint": (
                        "DEMO ONLY: fictional draft record."
                    ),
                    "examination": "",
                    "assessment": "",
                    "treatment_plan": "",
                    "follow_up": "",
                },
            )

            Invoice.objects.update_or_create(
                clinic=bengaluru,
                owner=owner,
                pet=simba,
                description="DEMO: routine wellness visit",
                defaults={
                    "appointment": completed,
                    "amount_cents": 125000,
                    "currency": "inr",
                    "status": Invoice.Status.OPEN,
                    "paid_at": None,
                },
            )

            Invoice.objects.update_or_create(
                clinic=bengaluru,
                owner=owner,
                pet=coco,
                description="DEMO: sample payment (no charge)",
                defaults={
                    "appointment": None,
                    "amount_cents": 55000,
                    "currency": "inr",
                    "status": Invoice.Status.DEMO_PAID,
                    "paid_at": now,
                },
            )

        self.stdout.write(
            self.style.SUCCESS(
                "Created fictional demo data for Bengaluru and Pune."
            )
        )
        self.stdout.write("Demo accounts created successfully.")

    @staticmethod
    def demo_user(
        username,
        email,
        last_name,
        role,
        demo_password,
        clinic=None,
    ):
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "email": email,
                "first_name": "Demo",
                "last_name": last_name,
                "role": role,
                "clinic": clinic,
            },
        )

        if not created and (
            user.email != email
            or user.first_name != "Demo"
            or user.last_name != last_name
        ):
            raise CommandError(
                f"Refusing to overwrite existing account {username!r}; "
                "its email or demo identity does not match."
            )

        user.email = email
        user.first_name = "Demo"
        user.last_name = last_name
        user.role = role
        user.clinic = clinic
        user.is_active = True
        user.set_password(demo_password)
        user.save()

        return user
