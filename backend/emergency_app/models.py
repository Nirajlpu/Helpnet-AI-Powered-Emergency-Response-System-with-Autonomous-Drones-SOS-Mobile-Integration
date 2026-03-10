from django.db import models
from django.contrib.gis.db import models as gis_models
from django.contrib.auth.models import User
import uuid
from django.utils import timezone

class UserProfile(models.Model):
    ROLE_CHOICES = [
        ('CIVILIAN', 'Civilian'),
        ('VOLUNTEER', 'Volunteer'),
        ('RESPONDER', 'Responder'),
        ('POLICE_STATION', 'Police Station Level Operator'),
        ('DISTRICT', 'District Level Operator'),
        ('STATE', 'State Level Operator'),
        ('CENTRAL', 'Central Level Operator'),
        ('ADMIN', 'Admin'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    user_id_code = models.CharField(max_length=20, unique=True, help_text="Unique user ID like HN-20260307-001")
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    is_volunteer = models.BooleanField(default=False)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='CIVILIAN')
    phone = models.CharField(max_length=15, blank=True)
    email = models.EmailField(unique=True)
    age = models.IntegerField()
    gender = models.CharField(max_length=10, choices=[('MALE', 'Male'), ('FEMALE', 'Female'), ('OTHER', 'Other')], default='MALE')
    is_verified = models.BooleanField(default=False)
    aadhar_card = models.ImageField(upload_to='aadhar_cards/', blank=True)
    pan_card = models.ImageField(upload_to='pan_cards/', blank=True)
    driving_licence = models.ImageField(upload_to='driving_licences/', blank=True)
    passport = models.ImageField(upload_to='passports/', blank=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True)
    village_city = models.CharField(max_length=100, blank=True)
    district = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    pincode = models.CharField(max_length=10, blank=True)
    location_coordinates = gis_models.PointField(geography=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    family_members = models.ManyToManyField('self', through='FamilyRelation', blank=True, symmetrical=False, help_text="Family members who are also registered users")
    
    def __str__(self):
        return f"{self.user.username} - {self.role}"

class FamilyRelation(models.Model):
    RELATION_CHOICES = [
        ('SPOUSE', 'Spouse'),
        ('FATHER', 'Father'),
        ('MOTHER', 'Mother'),
        ('SON', 'Son'),
        ('DAUGHTER', 'Daughter'),
        ('BROTHER', 'Brother'),
        ('SISTER', 'Sister'),
        ('GRANDFATHER', 'Grandfather'),
        ('GRANDMOTHER', 'Grandmother'),
        ('UNCLE', 'Uncle'),
        ('AUNT', 'Aunt'),
        ('COUSIN', 'Cousin'),
        ('OTHER', 'Other'),
    ]

    from_user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='relations_from')
    to_user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='relations_to')
    relation = models.CharField(max_length=20, choices=RELATION_CHOICES)

    class Meta:
        unique_together = ('from_user', 'to_user')

    def __str__(self):
        return f"{self.from_user.first_name} → {self.relation} → {self.to_user.first_name}"






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
    ]

    ACTION_TAKEN_STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('UNDER_REVIEW', 'Under Review'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('FALSE_ALARM', 'False Alarm'),
    ]

    INCIDENT_TYPE_CHOICES = [
        ('MEDICAL', 'Medical'),
        ('FIRE', 'Fire'),
        ('ACCIDENT', 'Accident'),
        ('CRIME', 'Crime'),
        ('TERRORIST_ATTACK', 'Terrorist Attack'),
        ('BOMB_THREAT', 'Bomb Threat'),
        ('NATURAL_DISASTER', 'Natural Disaster'),
        ('FLOOD', 'Flood'),
        ('EARTHQUAKE', 'Earthquake'),
        ('LANDSLIDE', 'Landslide'),
        ('STORM', 'Storm'),
        ('TSUNAMI', 'Tsunami'),
        ('WILDFIRE', 'Wildfire'),
        ('CHEMICAL_SPILL', 'Chemical Spill'),
        ('INDUSTRIAL_ACCIDENT', 'Industrial Accident'),
        ('ROAD_ACCIDENT', 'Road Accident'),
        ('NUCLEAR_LEAK', 'Nuclear Leak'),
        ('BIOLOGICAL_HAZARD', 'Biological Hazard'),
        ('OTHER', 'Other'),
    ]

    REPORTED_MEDIUM_CHOICES = [
        ('SOS_BUTTON', 'SOS Button'),
        ('INSTANT_BUTTON', 'Instant Button'),
        ('FORM_SUBMISSION', 'Form Submission'),
        ('PHONE_CALL', 'Phone Call'),
        ('EMAIL', 'Email'),
        ('OTHER', 'Other'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    reported_medium=models.CharField(max_length=20, choices=REPORTED_MEDIUM_CHOICES, default='APP')
    action_taken_by_authority = models.CharField(max_length=20, choices=ACTION_TAKEN_STATUS_CHOICES, default='ACTIVE')
    which_authority_took_action = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='authority_actions')
    reporter_profile = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='profile_reported_incidents')
    reporter = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reported_incidents')
    family_members_notified = models.ManyToManyField(UserProfile, blank=True, related_name='notified_incidents')
    is_live_streaming=models.BooleanField(default=False)
    location_coordinates = gis_models.PointField(geography=True)
    address = models.CharField(max_length=255, blank=True)
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='MEDIUM')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    ai_classification = models.JSONField(default=dict, help_text="AI analysis results")
    incident_type=models.CharField(max_length=20, choices=INCIDENT_TYPE_CHOICES, default='MEDICAL')
    responders_assigned = models.ManyToManyField(User, blank=True, related_name='assigned_incidents')
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    phone_video=models.FileField(upload_to='phone_videos/', blank=True)
    phone_video_url=models.URLField(blank=True)
    drone_video=models.FileField(upload_to='drone_videos/', blank=True)
    drone_video_url=models.URLField(blank=True)
    
    blockchain_hash = models.CharField(max_length=128, blank=True, help_text="Evidence integrity hash")
    
    class Meta:
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['status', 'severity']),
            gis_models.Index(fields=['location_coordinates']),
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
    destination_location = gis_models.PointField(geography=True, null=True, blank=True)
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
    image=models.ImageField(upload_to='suspects/', blank=True)
    name = models.CharField(max_length=100, blank=True)
    known_aliases = models.JSONField(default=list)
    risk_level = models.CharField(max_length=10, choices=[('LOW', 'Low'), ('MEDIUM', 'Medium'), ('HIGH', 'High')], default='LOW')
    warrants = models.JSONField(default=list, help_text="Active warrants/flags")
    last_seen_location = gis_models.PointField(geography=True, null=True, blank=True)
    last_seen_timestamp = models.DateTimeField(null=True, blank=True)
    by_whom=models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    
    def __str__(self):
        return f"Suspect {self.name or 'Unknown'} - Risk: {self.risk_level}"

class Evidence(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident = models.ForeignKey(Incident, on_delete=models.CASCADE, related_name='evidence_items')
    file_type = models.CharField(max_length=20, choices=[('VIDEO', 'Video'), ('AUDIO', 'Audio'), ('IMAGE', 'Image'), ('TELEMETRY', 'Telemetry')])
    file_url = models.URLField()
    phone_video_url=models.URLField(blank=True)
    drone_video_url=models.URLField(blank=True)
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