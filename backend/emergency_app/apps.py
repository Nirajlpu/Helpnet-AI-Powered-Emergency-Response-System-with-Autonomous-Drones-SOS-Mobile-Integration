from django.apps import AppConfig

class EmergencyAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'emergency_app'
    verbose_name = 'Emergency Response System'

    def ready(self):
        import emergency_app.signals