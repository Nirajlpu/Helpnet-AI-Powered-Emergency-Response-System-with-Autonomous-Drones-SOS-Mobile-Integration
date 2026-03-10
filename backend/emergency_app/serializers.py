from rest_framework import serializers
from rest_framework_gis.serializers import GeoModelSerializer
from django.contrib.auth.models import User
from .models import Incident, Drone, Suspect, Evidence, Responder, UserProfile, FamilyRelation


# ── UserProfile & Family ──

class FamilyRelationSerializer(serializers.ModelSerializer):
    to_user_name = serializers.SerializerMethodField()
    to_user_phone = serializers.SerializerMethodField()

    class Meta:
        model = FamilyRelation
        fields = ['id', 'from_user', 'to_user', 'relation', 'to_user_name', 'to_user_phone']

    def get_to_user_name(self, obj):
        return f"{obj.to_user.first_name} {obj.to_user.last_name}"

    def get_to_user_phone(self, obj):
        return obj.to_user.phone


class UserProfileSerializer(GeoModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    family_relations = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = [
            'id', 'user', 'username', 'user_id_code', 'first_name', 'last_name',
            'is_volunteer', 'role', 'phone', 'email', 'age', 'gender',
            'is_verified', 'aadhar_card', 'pan_card', 'driving_licence', 'passport',
            'avatar', 'village_city', 'district', 'state', 'pincode',
            'location_coordinates', 'created_at', 'family_relations',
        ]
        geo_field = 'location_coordinates'
        read_only_fields = ['user_id_code', 'created_at']

    def get_family_relations(self, obj):
        relations = FamilyRelation.objects.filter(from_user=obj)
        return FamilyRelationSerializer(relations, many=True).data

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        # Keep Django User first_name / last_name in sync
        user = instance.user
        changed = False
        if user.first_name != instance.first_name:
            user.first_name = instance.first_name
            changed = True
        if user.last_name != instance.last_name:
            user.last_name = instance.last_name
            changed = True
        if user.email != instance.email:
            user.email = instance.email
            changed = True
        if changed:
            user.save(update_fields=['first_name', 'last_name', 'email'])
        return instance


class UserProfileMinimalSerializer(serializers.ModelSerializer):
    """Lightweight serializer for nested display (e.g. reporter in incident)."""
    name = serializers.SerializerMethodField()
    family_members = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = ['id', 'user_id_code', 'name', 'phone', 'email', 'role', 'avatar',
                  'village_city', 'district', 'state', 'pincode', 'location_coordinates', 'family_members']

    def get_name(self, obj):
        return f"{obj.first_name} {obj.last_name}"

    def get_family_members(self, obj):
        relations = FamilyRelation.objects.filter(from_user=obj).select_related('to_user')
        return [
            {
                'name': f"{rel.to_user.first_name} {rel.to_user.last_name}",
                'user_id_code': rel.to_user.user_id_code,
                'relation': rel.relation,
                'phone': rel.to_user.phone,
                'to_user_phone': rel.to_user.phone,
            }
            for rel in relations
        ]


# ── Incident ──

class IncidentSerializer(GeoModelSerializer):
    distance = serializers.FloatField(read_only=True, required=False)
    assigned_drones = serializers.StringRelatedField(many=True, read_only=True)
    reporter_profile_detail = serializers.SerializerMethodField()
    authority_detail = UserProfileMinimalSerializer(source='which_authority_took_action', read_only=True)

    class Meta:
        model = Incident
        fields = '__all__'
        geo_field = 'location_coordinates'

    def get_reporter_profile_detail(self, obj):
        profile = obj.reporter_profile or getattr(obj.reporter, 'profile', None)
        if profile:
            return UserProfileMinimalSerializer(profile).data
        return None


# ── Drone ──

class DroneSerializer(GeoModelSerializer):
    class Meta:
        model = Drone
        fields = '__all__'
        geo_field = 'current_location'


# ── Suspect ──

class SuspectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Suspect
        fields = [
            'id', 'image', 'name', 'known_aliases', 'risk_level',
            'warrants', 'last_seen_location', 'last_seen_timestamp', 'by_whom',
        ]


# ── Evidence ──

class EvidenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Evidence
        fields = '__all__'


# ── Responder ──

class ResponderSerializer(GeoModelSerializer):
    class Meta:
        model = Responder
        fields = [
            'id', 'user', 'is_verified', 'current_location',
            'is_available', 'specializations', 'rating', 'response_count',
        ]
        geo_field = 'current_location'


# ── SOS Request ──

class SOSRequestSerializer(serializers.Serializer):
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    accuracy = serializers.FloatField(required=False, default=10.0)
    timestamp = serializers.DateTimeField(required=False)
    device_id = serializers.CharField(max_length=100)
    emergency_type = serializers.CharField(max_length=50, required=False, allow_blank=True)
    audio_data = serializers.CharField(required=False, allow_blank=True)
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    incident_type = serializers.CharField(max_length=20, required=False, default='OTHER')
    reported_medium = serializers.CharField(max_length=20, required=False, default='SOS_BUTTON')