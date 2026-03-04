from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance
import numpy as np
from typing import List, Optional, Tuple

class DroneRouter:
    def __init__(self):
        self.avg_drone_speed = 15
        self.max_flight_time = 45 * 60
    
    def calculate_eta(self, drone_location: Point, target_location: Point) -> Optional[int]:
        if not drone_location or not target_location:
            return None
        
        distance = drone_location.distance(target_location) * 1000
        time_seconds = distance / self.avg_drone_speed
        return int(time_seconds + 30)
    
    def optimize_dispatch(self, incident, available_drones: List) -> Optional:
        if not available_drones:
            return None
        
        scores = []
        incident_point = incident.location
        
        for drone in available_drones:
            score = 0
            
            distance = drone.current_location.distance(incident_point) if drone.current_location else float('inf')
            distance_score = 1 / (1 + distance * 100)
            score += distance_score * 0.4
            
            battery_score = drone.battery_level / 100
            score += battery_score * 0.3
            
            cap_score = 0
            if drone.has_thermal:
                cap_score += 0.15
            if drone.has_lidar:
                cap_score += 0.15
            score += cap_score
            
            scores.append((drone, score))
        
        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[0][0] if scores else None
    
    def calculate_swarm_formation(self, incident_location: Point, num_drones: int = 3) -> List[Point]:
        angles = np.linspace(0, 2*np.pi, num_drones, endpoint=False)
        radius = 0.001
        
        positions = []
        for angle in angles:
            lat = incident_location.y + radius * np.cos(angle)
            lng = incident_location.x + radius * np.sin(angle)
            positions.append(Point(lng, lat))
        
        return positions

_router = None

def get_router():
    global _router
    if _router is None:
        _router = DroneRouter()
    return _router

def calculate_eta(drone_location: Point, target_location: Point) -> Optional[int]:
    return get_router().calculate_eta(drone_location, target_location)