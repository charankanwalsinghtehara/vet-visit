from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings

from .models import Appointment, Clinic, Invoice, MedicalRecord, Pet, User


class SeedDemoCommandTests(TestCase):
    @override_settings(DEBUG=True)
    def test_seed_demo_populates_every_workflow_and_is_idempotent(self):
        call_command("seed_demo", stdout=StringIO())
        call_command("seed_demo", stdout=StringIO())

        self.assertEqual(Clinic.objects.count(), 2)
        self.assertEqual(User.objects.count(), 4)
        self.assertEqual(Pet.objects.count(), 2)
        self.assertEqual(Appointment.objects.count(), 2)
        self.assertEqual(MedicalRecord.objects.count(), 2)
        self.assertEqual(Invoice.objects.count(), 2)
        self.assertEqual(
            set(Clinic.objects.values_list("address", flat=True)),
            {
                "12 Example Road, Indiranagar, Bengaluru, Karnataka 560038, India",
                "24 Example Lane, Koregaon Park, Pune, Maharashtra 411001, India",
            },
        )
        self.assertEqual(set(Invoice.objects.values_list("currency", flat=True)), {"inr"})
        self.assertTrue(User.objects.get(username="demo-owner").check_password("VetCareDemo2026!"))

    @override_settings(DEBUG=False)
    def test_seed_demo_refuses_to_run_outside_debug(self):
        with self.assertRaisesMessage(CommandError, "DEBUG is enabled"):
            call_command("seed_demo", stdout=StringIO())
