from django.contrib.auth.models import AbstractUser
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Clinic(models.Model):
    name = models.CharField(max_length=160)
    slug = models.SlugField(unique=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    address = models.TextField(blank=True)
    business_hours = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "admin", "Clinic administrator"
        VETERINARIAN = "veterinarian", "Veterinarian"
        RECEPTIONIST = "receptionist", "Clinic staff"
        OWNER = "owner", "Pet owner"

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.OWNER)
    clinic = models.ForeignKey(Clinic, on_delete=models.PROTECT, null=True, blank=True, related_name="members")
    phone = models.CharField(max_length=32, blank=True)

    def __str__(self):
        return self.get_full_name() or self.username


class Pet(models.Model):
    class Sex(models.TextChoices):
        FEMALE = "female", "Female"
        MALE = "male", "Male"
        UNKNOWN = "unknown", "Unknown"

    clinic = models.ForeignKey(Clinic, on_delete=models.PROTECT, related_name="pets")
    owner = models.ForeignKey(User, on_delete=models.PROTECT, related_name="pets")
    name = models.CharField(max_length=120)
    species = models.CharField(max_length=80)
    breed = models.CharField(max_length=120, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    sex = models.CharField(max_length=12, choices=Sex.choices, default=Sex.UNKNOWN)
    weight_kg = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)])
    allergies = models.TextField(blank=True)
    existing_conditions = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name", "id"]

    def __str__(self):
        return f"{self.name} ({self.species})"


class Appointment(models.Model):
    class Status(models.TextChoices):
        BOOKED = "booked", "Booked"
        CHECKED_IN = "checked_in", "Checked in"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    clinic = models.ForeignKey(Clinic, on_delete=models.PROTECT, related_name="appointments")
    pet = models.ForeignKey(Pet, on_delete=models.PROTECT, related_name="appointments")
    veterinarian = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="veterinary_appointments", limit_choices_to={"role": User.Role.VETERINARIAN}
    )
    starts_at = models.DateTimeField()
    duration_minutes = models.PositiveSmallIntegerField(
        default=30, validators=[MinValueValidator(10), MaxValueValidator(240)]
    )
    reason = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.BOOKED)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="created_appointments")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["starts_at"]
        indexes = [models.Index(fields=["clinic", "starts_at"]), models.Index(fields=["veterinarian", "starts_at"])]

    def __str__(self):
        return f"{self.pet.name} - {self.starts_at:%Y-%m-%d %H:%M}"


class MedicalRecord(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        REVIEWED = "reviewed", "Reviewed"
        FINALIZED = "finalized", "Finalized"

    clinic = models.ForeignKey(Clinic, on_delete=models.PROTECT, related_name="medical_records")
    pet = models.ForeignKey(Pet, on_delete=models.PROTECT, related_name="medical_records")
    appointment = models.ForeignKey(
        Appointment, on_delete=models.SET_NULL, null=True, blank=True, related_name="medical_records"
    )
    veterinarian = models.ForeignKey(User, on_delete=models.PROTECT, related_name="authored_records")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    chief_complaint = models.TextField(blank=True)
    examination = models.TextField(blank=True)
    assessment = models.TextField(blank=True)
    treatment_plan = models.TextField(blank=True)
    follow_up = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.pet.name} - {self.created_at:%Y-%m-%d}"


class Invoice(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        PAID = "paid", "Paid"
        DEMO_PAID = "demo_paid", "Demo paid (no charge)"
        VOID = "void", "Void"

    clinic = models.ForeignKey(Clinic, on_delete=models.PROTECT, related_name="invoices")
    owner = models.ForeignKey(User, on_delete=models.PROTECT, related_name="invoices")
    pet = models.ForeignKey(Pet, on_delete=models.PROTECT, related_name="invoices")
    appointment = models.ForeignKey(
        Appointment, on_delete=models.SET_NULL, null=True, blank=True, related_name="invoices"
    )
    description = models.CharField(max_length=240)
    amount_cents = models.PositiveIntegerField(validators=[MinValueValidator(50)])
    currency = models.CharField(max_length=3, default="inr")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.OPEN)
    stripe_checkout_session_id = models.CharField(max_length=255, unique=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Invoice #{self.pk} - {self.owner} - {self.amount_cents} {self.currency.upper()}"
