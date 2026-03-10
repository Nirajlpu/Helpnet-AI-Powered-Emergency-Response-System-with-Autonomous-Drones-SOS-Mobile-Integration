from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/dashboard/$', consumers.DashboardConsumer.as_asgi()),
    re_path(r'ws/incident/(?P<incident_id>[^/]+)/$', consumers.IncidentConsumer.as_asgi()),
    re_path(r'ws/video/(?P<incident_id>[^/]+)/$', consumers.VideoSignalingConsumer.as_asgi()),
    re_path(r'ws/audio/(?P<incident_id>[^/]+)/$', consumers.AudioStreamConsumer.as_asgi()),
]