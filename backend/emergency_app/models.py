from django.db import models
from django.contrib.gis.db import models as gis_models
from django.contrib.auth.models import User
import uuid
from django.utils import timezone

class Incident(models.Model):
    SEVERITY_CHOICES = [
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
        ('CRITICAL', 'Critical'),
    ]
    STATUS_CHOICES = [
        ('REPORTED', 'Reported'),
        ('DISPATCHED', 'Dispatched'),
        ('EN_ROUTE', 'En Route'),
        ('ON_SCENE', 'On Scene'),
        ('RESOLVED', 'Resolved'),
        ('FALSE_ALARM', 'False Alarm'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reporter = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='reported_incidents')
    location = gis_models.PointField(geography=True)
    address = models.CharField(max_length=255, blank=True)
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='MEDIUM')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='REPORTED')
    description = models.TextField(blank=True)
    ai_classification = models.JSONField(default=dict, help_text="AI analysis results")
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    
    video_url = models.URLField(blank=True)
    audio_url = models.URLField(blank=True)
    blockchain_hash = models.CharField(max_length=128, blank=True, help_text="Evidence integrity hash")
    
    class Meta:
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['status', 'severity']),
            gis_models.Index(fields=['location']),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Incident {self.id} - {self.severity} at {self.created_at}"

class Drone(models.Model):
    STATUS_CHOICES = [
        ('IDLE', 'Idle'),
        ('EN_ROUTE', 'En Route'),
        ('ON_SCENE', 'On Scene'),
        ('RETURNING', 'Returning'),
        ('CHARGING', 'Charging'),
        ('MAINTENANCE', 'Maintenance'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='IDLE')
    current_location = gis_models.PointField(geography=True, null=True, blank=True)
    home_location = gis_models.PointField(geography=True)
    battery_level = models.IntegerField(default=100, help_text="Battery percentage")
    current_incident = models.ForeignKey(Incident, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_drones')
    last_seen = models.DateTimeField(auto_now=True)
    telemetry_data = models.JSONField(default=dict, help_text="Real-time telemetry")
    
    has_thermal = models.BooleanField(default=True)
    has_lidar = models.BooleanField(default=False)
    
    class Meta:
        indexes = [
            models.Index(fields=['status']),
            gis_models.Index(fields=['current_location']),
        ]
    
    def __str__(self):
        return f"Drone {self.name} - {self.status}"

class Suspect(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    face_encoding = models.BinaryField(help_text="Facial recognition embedding")
    name = models.CharField(max_length=100, blank=True)
    known_aliases = models.JSONField(default=list)
    risk_level = models.CharField(max_length=10, choices=[('LOW', 'Low'), ('MEDIUM', 'Medium'), ('HIGH', 'High')], default='LOW')
    warrants = models.JSONField(default=list, help_text="Active warrants/flags")
    last_seen_location = gis_models.PointField(geography=True, null=True, blank=True)
    last_seen_timestamp = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"Suspect {self.name or 'Unknown'} - Risk: {self.risk_level}"

class Evidence(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident = models.ForeignKey(Incident, on_delete=models.CASCADE, related_name='evidence_items')
    file_type = models.CharField(max_length=20, choices=[('VIDEO', 'Video'), ('AUDIO', 'Audio'), ('IMAGE', 'Image'), ('TELEMETRY', 'Telemetry')])
    file_url = models.URLField()
    captured_at = models.DateTimeField()
    captured_by = models.ForeignKey(Drone, on_delete=models.SET_NULL, null=True, blank=True)
    blockchain_hash = models.CharField(max_length=128)
    metadata = models.JSONField(default=dict, help_text="Resolution, coordinates, device info")
    is_redacted = models.BooleanField(default=False, help_text="AI privacy redaction applied")
    
    class Meta:
        ordering = ['-captured_at']

class Responder(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    is_verified = models.BooleanField(default=False)
    verification_docs = models.JSONField(default=dict)
    current_location = gis_models.PointField(geography=True, null=True, blank=True)
    is_available = models.BooleanField(default=True)
    specializations = models.JSONField(default=list, help_text="Medical, Fire, Police, etc.")
    rating = models.FloatField(default=5.0)
    response_count = models.IntegerField(default=0)
    
    def __str__(self):
        return f"Responder {self.user.username} - Verified: {self.is_verified}"