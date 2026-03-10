from django.db.models.signals import post_save
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Incident
from .serializers import IncidentSerializer

@receiver(post_save, sender=Incident)
def notify_new_incident(sender, instance, created, **kwargs):
    channel_layer = get_channel_layer()
    serializer = IncidentSerializer(instance)
    if created:
        async_to_sync(channel_layer.group_send)(
            "dashboard_updates",
            {
                'type': 'new_incident',
                'incident': serializer.data
            }
        )
    else:
        async_to_sync(channel_layer.group_send)(
            "dashboard_updates",
            {
                'type': 'incident_update',
                'incident': serializer.data
            }
        )