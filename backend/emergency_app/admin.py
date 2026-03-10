from django.contrib import admin
from .models import Incident, Drone, Suspect, Evidence, Responder,UserProfile

@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = ('id', 'severity', 'status', 'created_at', 'reporter')
    list_filter = ('severity', 'status', 'created_at')
    search_fields = ('id', 'description', 'address')
    date_hierarchy = 'created_at'
    readonly_fields = ('created_at', 'resolved_at', 'blockchain_hash')

@admin.register(Drone)
class DroneAdmin(admin.ModelAdmin):
    list_display = ('name', 'status', 'battery_level', 'current_incident', 'last_seen')
    list_filter = ('status', 'has_thermal', 'has_lidar')
    search_fields = ('name',)

@admin.register(Suspect)
class SuspectAdmin(admin.ModelAdmin):
    list_display = ('name', 'risk_level', 'last_seen_timestamp')
    list_filter = ('risk_level',)
    search_fields = ('name', 'known_aliases')

@admin.register(Evidence)
class EvidenceAdmin(admin.ModelAdmin):
    list_display = ('incident', 'file_type', 'captured_at', 'is_redacted')
    list_filter = ('file_type', 'is_redacted')

@admin.register(Responder)
class ResponderAdmin(admin.ModelAdmin):
    list_display = ('user', 'is_verified', 'is_available', 'rating')
    list_filter = ('is_verified', 'is_available', 'specializations')


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'is_verified', 'is_volunteer')
    list_filter = ('is_verified', 'role', 'is_volunteer')
