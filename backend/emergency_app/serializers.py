from rest_framework import serializers
from rest_framework_gis.serializers import GeoModelSerializer
from .models import Incident, Drone, Suspect, Evidence, Responder

class IncidentSerializer(GeoModelSerializer):
    distance = serializers.FloatField(read_only=True, required=False)
    assigned_drones = serializers.StringRelatedField(many=True, read_only=True)
    
    class Meta:
        model = Incident
        fields = '__all__'
        geo_field = 'location'

class DroneSerializer(GeoModelSerializer):
    class Meta:
        model = Drone
        fields = '__all__'
        geo_field = 'current_location'

class SuspectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Suspect
        fields = ['id', 'name', 'risk_level', 'last_seen_location', 'last_seen_timestamp']

class EvidenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Evidence
        fields = '__all__'

class ResponderSerializer(GeoModelSerializer):
    class Meta:
        model = Responder
        fields = ['id', 'user', 'is_verified', 'current_location', 'is_available', 'specializations', 'rating']
        geo_field = 'current_location'

class SOSRequestSerializer(serializers.Serializer):
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    accuracy = serializers.FloatField(required=False, default=10.0)
    timestamp = serializers.DateTimeField(required=False)
    device_id = serializers.CharField(max_length=100)
    emergency_type = serializers.CharField(max_length=50, required=False, allow_blank=True)
    audio_data = serializers.CharField(required=False, allow_blank=True)