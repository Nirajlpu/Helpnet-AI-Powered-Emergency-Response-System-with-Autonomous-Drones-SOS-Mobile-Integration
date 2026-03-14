from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'profiles', views.UserProfileViewSet)
router.register(r'incidents', views.IncidentViewSet)
router.register(r'drones', views.DroneViewSet)
router.register(r'suspects', views.SuspectViewSet)
router.register(r'evidence', views.EvidenceViewSet)
router.register(r'responders', views.ResponderViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('sos/', views.trigger_sos, name='trigger_sos'),
    
]
