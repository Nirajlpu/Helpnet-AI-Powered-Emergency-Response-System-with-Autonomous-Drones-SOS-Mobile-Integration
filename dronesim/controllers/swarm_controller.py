from typing import List
from .drone_controller import DroneController

class SwarmController:
    def __init__(self, drone_names: List[str]):
        self.drones = {name: DroneController(name) for name in drone_names}
    
    def takeoff_all(self, altitude: float = 20.0):
        for name, drone in self.drones.items():
            drone.takeoff(altitude)
    
    def form_formation(self, center_lat: float, center_lon: float, 
                      formation_type: str = 'circle'):
        import math
        
        count = len(self.drones)
        radius = 20  # meters
        
        for i, (name, drone) in enumerate(self.drones.items()):
            angle = (2 * math.pi * i) / count
            offset_x = radius * math.cos(angle)
            offset_y = radius * math.sin(angle)
            
            lat = center_lat + (offset_y / 111320)
            lon = center_lon + (offset_x / (111320 * math.cos(math.radians(center_lat))))
            
            drone.navigate_to(lat, lon)
    
    def land_all(self):
        for drone in self.drones.values():
            drone.land()