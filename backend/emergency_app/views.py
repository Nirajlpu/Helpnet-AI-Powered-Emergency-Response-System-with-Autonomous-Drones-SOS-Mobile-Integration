from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance
from django.utils import timezone
from django.db.models import Q
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import json

from .models import Incident, Drone, Suspect, Evidence, Responder
from .serializers import (
    IncidentSerializer, DroneSerializer, SuspectSerializer,
    EvidenceSerializer, ResponderSerializer, SOSRequestSerializer
)
from .ai_modules.emergency_classifier import classify_emergency
from .ai_modules.routing_optimization import calculate_eta
from .tasks import auto_dispatch_drone

class IncidentViewSet(viewsets.ModelViewSet):
    queryset = Incident.objects.all()
    serializer_class = IncidentSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = Incident.objects.all()
        
        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        severity = self.request.query_params.get('severity', None)
        if severity:
            queryset = queryset.filter(severity=severity)
        
        lat = self.request.query_params.get('lat', None)
        lng = self.request.query_params.get('lng', None)
        radius = self.request.query_params.get('radius', 5000)
        
        if lat and lng:
            point = Point(float(lng), float(lat), srid=4326)
            queryset = queryset.filter(
                location__distance_lte=(point, radius)
            ).annotate(distance=Distance('location', point)).order_by('distance')
        
        return queryset.select_related('assigned_drones')
    
    @action(detail=True, methods=['post'])
    def dispatch_drone(self, request, pk=None):
        incident = self.get_object()
        
        nearest_drone = Drone.objects.filter(
            status='IDLE',
            battery_level__gte=20
        ).annotate(
            distance=Distance('current_location', incident.location)
        ).order_by('distance').first()
        
        if not nearest_drone:
            return Response(
                {'error': 'No available drones'}, 
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        
        nearest_drone.status = 'EN_ROUTE'
        nearest_drone.current_incident = incident
        nearest_drone.save()
        
        incident.status = 'DISPATCHED'
        incident.save()
        
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"incident_{incident.id}",
            {
                'type': 'drone_dispatched',
                'drone_id': str(nearest_drone.id),
                'incident_id': str(incident.id)
            }
        )
        
        return Response({
            'drone': DroneSerializer(nearest_drone).data,
            'eta_seconds': calculate_eta(
                nearest_drone.current_location, 
                incident.location
            )
        })
    
    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        incident = self.get_object()
        incident.status = 'RESOLVED'
        incident.resolved_at = timezone.now()
        incident.save()
        
        incident.assigned_drones.update(status='RETURNING', current_incident=None)
        
        return Response({'status': 'resolved'})

class DroneViewSet(viewsets.ModelViewSet):
    queryset = Drone.objects.all()
    serializer_class = DroneSerializer
    permission_classes = [IsAuthenticated]
    
    @action(detail=True, methods=['post'])
    def telemetry(self, request, pk=None):
        drone = self.get_object()
        
        lat = request.data.get('latitude')
        lng = request.data.get('longitude')
        if lat and lng:
            drone.current_location = Point(float(lng), float(lat), srid=4326)
        
        drone.battery_level = request.data.get('battery_level', drone.battery_level)
        drone.telemetry_data = request.data.get('telemetry', {})
        drone.save()
        
        if drone.status == 'EN_ROUTE' and drone.current_incident:
            distance = drone.current_location.distance(drone.current_incident.location)
            if distance < 0.1:
                drone.status = 'ON_SCENE'
                drone.save()
                drone.current_incident.status = 'ON_SCENE'
                drone.current_incident.save()
        
        return Response({'status': 'updated'})

@api_view(['POST'])
@permission_classes([AllowAny])
def trigger_sos(request):
    serializer = SOSRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    data = serializer.validated_data
    
    point = Point(data['longitude'], data['latitude'], srid=4326)
    
    ai_result = {}
    if data.get('audio_data'):
        ai_result = classify_emergency(data['audio_data'])
    
    incident = Incident.objects.create(
        location=point,
        severity=ai_result.get('severity', 'HIGH'),
        ai_classification=ai_result,
        description=ai_result.get('transcription', 'Emergency SOS triggered')
    )
    
    if incident.severity in ['HIGH', 'CRITICAL']:
        auto_dispatch_drone.delay(incident.id)
    
    notify_nearby_responders(incident)
    
    return Response({
        'incident_id': str(incident.id),
        'status': 'REPORTED',
        'help_dispatched': incident.severity in ['HIGH', 'CRITICAL']
    }, status=status.HTTP_201_CREATED)

def notify_nearby_responders(incident):
    nearby = Responder.objects.filter(
        is_verified=True,
        is_available=True,
        current_location__distance_lte=(incident.location, 10000)
    )
    
    for responder in nearby:
        pass

class SuspectViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Suspect.objects.all()
    serializer_class = SuspectSerializer
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['post'])
    def identify(self, request):
        from .ai_modules.face_matching import match_face
        
        image_data = request.data.get('image')
        if not image_data:
            return Response({'error': 'No image provided'}, status=400)
        
        matches = match_face(image_data)
        return Response({'matches': matches})

class EvidenceViewSet(viewsets.ModelViewSet):
    queryset = Evidence.objects.all()
    serializer_class = EvidenceSerializer
    permission_classes = [IsAuthenticated]

class ResponderViewSet(viewsets.ModelViewSet):
    queryset = Responder.objects.all()
    serializer_class = ResponderSerializer
    permission_classes = [IsAuthenticated]