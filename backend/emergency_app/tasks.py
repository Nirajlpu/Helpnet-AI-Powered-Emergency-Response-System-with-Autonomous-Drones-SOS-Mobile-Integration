from celery import shared_task
from django.core.cache import cache
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .models import Incident, Drone
from .ai_modules.routing_optimization import get_router

@shared_task
def auto_dispatch_drone(incident_id):
    try:
        incident = Incident.objects.get(id=incident_id)
        
        available = Drone.objects.filter(
            status='IDLE',
            battery_level__gte=25
        )
        
        router = get_router()
        best_drone = router.optimize_dispatch(incident, available)
        
        if best_drone:
            best_drone.status = 'EN_ROUTE'
            best_drone.current_incident = incident
            best_drone.save()
            
            incident.status = 'DISPATCHED'
            incident.save()
            
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                "dispatch_updates",
                {
                    'type': 'dispatch_notification',
                    'message': {
                        'incident_id': str(incident_id),
                        'drone_id': str(best_drone.id),
                        'eta': router.calculate_eta(best_drone.current_location, incident.location)
                    }
                }
            )
            
            return f"Dispatched drone {best_drone.name} to incident {incident_id}"
        
        return "No available drones"
        
    except Incident.DoesNotExist:
        return "Incident not found"

@shared_task
def process_drone_video(drone_id, video_chunk):
    pass

@shared_task
def predict_incident_hotspots():
    from .ai_modules.incident_prediction import HotspotPredictor
    
    predictor = HotspotPredictor()
    hotspots = predictor.predict()
    
    cache.set('incident_hotspots', hotspots, 3600)
    return hotspots