from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from .models import Incident, Drone, Suspect, Evidence, Responder, UserProfile, FamilyRelation


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = 'User Profile'
    fk_name = 'user'


class UserAdmin(BaseUserAdmin):
    inlines = [UserProfileInline]


# Re-register User with the inline
admin.site.unregister(User)
admin.site.register(User, UserAdmin)


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
    list_display = ('user', 'first_name', 'last_name', 'role', 'is_verified', 'is_volunteer')
    list_filter = ('is_verified', 'role', 'is_volunteer')
    search_fields = ('first_name', 'last_name', 'email', 'phone', 'user_id_code')

    class FamilyInline(admin.TabularInline):
        model = FamilyRelation
        fk_name = 'from_user'
        extra = 1
        autocomplete_fields = ['to_user']
        verbose_name = 'Family Member'
        verbose_name_plural = 'Family Members'

    inlines = [FamilyInline]


@admin.register(FamilyRelation)
class FamilyRelationAdmin(admin.ModelAdmin):
    list_display = ('from_user', 'relation', 'to_user')
    list_filter = ('relation',)
    search_fields = ('from_user__first_name', 'from_user__last_name', 'to_user__first_name', 'to_user__last_name')
    autocomplete_fields = ['from_user', 'to_user']
