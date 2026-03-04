from django.db.models.signals import post_save
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Incident

@receiver(post_save, sender=Incident)
def notify_new_incident(sender, instance, created, **kwargs):
    if created:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            "dashboard_updates",
            {
                'type': 'new_incident',
                'incident_id': str(instance.id),
                'severity': instance.severity,
                'location': {
                    'lat': instance.location.y,
                    'lng': instance.location.x
                }
            }
        )