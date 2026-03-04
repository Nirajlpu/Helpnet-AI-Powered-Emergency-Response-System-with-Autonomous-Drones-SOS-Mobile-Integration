from django.test import TestCase
from django.contrib.gis.geos import Point
from .models import Incident, Drone

class IncidentModelTest(TestCase):
    def test_create_incident(self):
        incident = Incident.objects.create(
            location=Point(-74.006, 40.7128),
            severity='HIGH',
            description='Test emergency'
        )
        self.assertEqual(incident.status, 'REPORTED')
        self.assertIsNotNone(incident.id)

class DroneModelTest(TestCase):
    def test_create_drone(self):
        drone = Drone.objects.create(
            name='Drone-001',
            home_location=Point(-74.006, 40.7128),
            battery_level=100
        )
        self.assertEqual(drone.status, 'IDLE')