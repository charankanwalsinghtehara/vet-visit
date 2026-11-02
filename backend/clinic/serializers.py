from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers

from .models import Appointment, Clinic, Invoice, MedicalRecord, Pet, User


class ClinicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Clinic
        fields = ["id", "name", "slug", "email", "phone", "address", "business_hours"]


class UserSerializer(serializers.ModelSerializer):
    clinic_name = serializers.CharField(source="clinic.name", read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "phone", "role", "clinic", "clinic_name"]


class VeterinarianSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "first_name", "last_name"]


class ClinicOwnerSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "first_name", "last_name", "email", "phone"]


class RegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ["username", "email", "password", "first_name", "last_name", "phone"]

    def create(self, validated_data):
        return User.objects.create_user(role=User.Role.OWNER, **validated_data)


class PetSerializer(serializers.ModelSerializer):
    owner_name = serializers.SerializerMethodField()
    clinic_name = serializers.CharField(source="clinic.name", read_only=True)
    owner = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=User.Role.OWNER), required=False
    )

    class Meta:
        model = Pet
        fields = [
            "id", "clinic", "clinic_name", "owner", "owner_name", "name", "species", "breed",
            "date_of_birth", "sex", "weight_kg", "allergies", "existing_conditions", "created_at",
        ]
        read_only_fields = ["created_at"]

    def get_owner_name(self, obj):
        return obj.owner.get_full_name() or obj.owner.username

    def validate_clinic(self, clinic):
        request = self.context["request"]
        if not clinic.is_active:
            raise serializers.ValidationError("This clinic is not accepting new records.")
        if self.instance and self.instance.clinic_id != clinic.id:
            raise serializers.ValidationError("A pet cannot be reassigned to a different clinic.")
        if request.user.role != User.Role.OWNER and request.user.clinic_id != clinic.id:
            raise serializers.ValidationError("You cannot add pets to another clinic.")
        return clinic

    def create(self, validated_data):
        request = self.context["request"]
        if request.user.role == User.Role.OWNER:
            validated_data["owner"] = request.user
        if not validated_data.get("owner"):
            raise serializers.ValidationError({"owner": "Select an owner for this pet."})
        return super().create(validated_data)

    def validate_owner(self, owner):
        request = self.context["request"]
        if request.user.role == User.Role.OWNER and owner != request.user:
            raise serializers.ValidationError("You can only manage your own pets.")
        if request.user.role != User.Role.OWNER and owner.role != User.Role.OWNER:
            raise serializers.ValidationError("A pet must be assigned to a pet owner.")
        return owner

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context["request"]
        owner = attrs.get("owner", getattr(self.instance, "owner", None))
        clinic = attrs.get("clinic", getattr(self.instance, "clinic", None))
        if (
            request.user.role != User.Role.OWNER
            and owner
            and clinic
            and not (self.instance and self.instance.owner_id == owner.id)
            and not owner.pets.filter(clinic=clinic).exists()
        ):
            raise serializers.ValidationError({"owner": "Select an owner already registered with this clinic."})
        return attrs


class AppointmentSerializer(serializers.ModelSerializer):
    pet_name = serializers.CharField(source="pet.name", read_only=True)
    veterinarian_name = serializers.SerializerMethodField()
    owner_name = serializers.SerializerMethodField()
    clinic_name = serializers.CharField(source="clinic.name", read_only=True)

    class Meta:
        model = Appointment
        fields = [
            "id", "clinic", "clinic_name", "pet", "pet_name", "owner_name", "veterinarian",
            "veterinarian_name", "starts_at", "duration_minutes", "reason", "status", "created_at",
        ]
        read_only_fields = ["created_at"]

    def get_veterinarian_name(self, obj):
        return obj.veterinarian.get_full_name() or obj.veterinarian.username

    def get_owner_name(self, obj):
        return obj.pet.owner.get_full_name() or obj.pet.owner.username

    def validate(self, attrs):
        request = self.context["request"]
        clinic = attrs.get("clinic", getattr(self.instance, "clinic", None))
        pet = attrs.get("pet", getattr(self.instance, "pet", None))
        veterinarian = attrs.get("veterinarian", getattr(self.instance, "veterinarian", None))
        if clinic and pet and pet.clinic_id != clinic.id:
            raise serializers.ValidationError({"pet": "The pet must belong to the selected clinic."})
        starts_at = attrs.get("starts_at")
        if starts_at and starts_at <= timezone.now():
            raise serializers.ValidationError({"starts_at": "Appointments must be scheduled in the future."})
        if clinic and veterinarian and (
            veterinarian.role != User.Role.VETERINARIAN or veterinarian.clinic_id != clinic.id or not veterinarian.is_active
        ):
            raise serializers.ValidationError({"veterinarian": "Select an active veterinarian from this clinic."})
        if request.user.role == User.Role.OWNER and pet and pet.owner_id != request.user.id:
            raise serializers.ValidationError({"pet": "You can only book appointments for your own pets."})
        if request.user.role != User.Role.OWNER and clinic and request.user.clinic_id != clinic.id:
            raise serializers.ValidationError({"clinic": "You cannot schedule appointments at another clinic."})
        return attrs


class MedicalRecordSerializer(serializers.ModelSerializer):
    pet_name = serializers.CharField(source="pet.name", read_only=True)
    veterinarian_name = serializers.SerializerMethodField()

    class Meta:
        model = MedicalRecord
        fields = [
            "id", "clinic", "pet", "pet_name", "appointment", "veterinarian", "veterinarian_name",
            "status", "chief_complaint", "examination", "assessment", "treatment_plan", "follow_up",
            "created_at", "updated_at",
        ]
        read_only_fields = ["veterinarian", "created_at", "updated_at"]

    def get_veterinarian_name(self, obj):
        return obj.veterinarian.get_full_name() or obj.veterinarian.username

    def validate(self, attrs):
        clinic = attrs.get("clinic", getattr(self.instance, "clinic", None))
        pet = attrs.get("pet", getattr(self.instance, "pet", None))
        appointment = attrs.get("appointment", getattr(self.instance, "appointment", None))
        if clinic and pet and pet.clinic_id != clinic.id:
            raise serializers.ValidationError({"pet": "The pet must belong to the selected clinic."})
        if appointment and (appointment.clinic_id != clinic.id or appointment.pet_id != pet.id):
            raise serializers.ValidationError({"appointment": "The appointment must match the selected pet and clinic."})
        if clinic and self.context["request"].user.clinic_id != clinic.id:
            raise serializers.ValidationError({"clinic": "You cannot create records for another clinic."})
        user = self.context["request"].user
        if user.role == User.Role.VETERINARIAN and not (
            self.instance and self.instance.veterinarian_id == user.id
        ):
            if appointment and appointment.veterinarian_id != user.id:
                raise serializers.ValidationError({"appointment": "You can only document your assigned appointments."})
            if not Appointment.objects.filter(clinic=clinic, pet=pet, veterinarian=user).exists():
                raise serializers.ValidationError({"pet": "You can only document patients assigned to you."})
        return attrs


class InvoiceSerializer(serializers.ModelSerializer):
    clinic_name = serializers.CharField(source="clinic.name", read_only=True)
    owner_name = serializers.SerializerMethodField()
    pet_name = serializers.CharField(source="pet.name", read_only=True)

    class Meta:
        model = Invoice
        fields = [
            "id", "clinic", "clinic_name", "owner", "owner_name", "pet", "pet_name",
            "appointment", "description", "amount_cents", "currency", "status", "created_at", "paid_at",
        ]
        read_only_fields = ["status", "created_at", "paid_at"]

    def get_owner_name(self, obj):
        return obj.owner.get_full_name() or obj.owner.username

    def validate_currency(self, value):
        if value.lower() != "inr":
            raise serializers.ValidationError("Only INR invoices are supported in this prototype.")
        return "inr"

    def validate(self, attrs):
        request = self.context["request"]
        user = request.user
        clinic = attrs.get("clinic")
        owner = attrs.get("owner")
        pet = attrs.get("pet")
        appointment = attrs.get("appointment")
        if user.role != User.Role.RECEPTIONIST and user.role != User.Role.ADMIN:
            raise serializers.ValidationError("Only clinic administrators and receptionists can issue invoices.")
        if not user.clinic_id or clinic.id != user.clinic_id:
            raise serializers.ValidationError({"clinic": "You can only issue invoices for your clinic."})
        if pet.clinic_id != clinic.id or pet.owner_id != owner.id:
            raise serializers.ValidationError({"pet": "The selected pet must belong to this owner and clinic."})
        if appointment and (
            appointment.clinic_id != clinic.id or appointment.pet_id != pet.id
        ):
            raise serializers.ValidationError({"appointment": "The appointment must match the selected pet and clinic."})
        return attrs
