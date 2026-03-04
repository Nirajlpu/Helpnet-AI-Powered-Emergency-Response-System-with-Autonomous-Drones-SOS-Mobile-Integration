import airsim
import time
import math
from typing import List, Tuple, Optional
import numpy as np

class DroneController:
    def __init__(self, drone_name: str = "Drone1"):
        self.client = airsim.MultirotorClient()
        self.client.confirmConnection()
        self.drone_name = drone_name
        self.is_flying = False
        
        self.client.enableApiControl(True, vehicle_name=drone_name)
        self.client.armDisarm(True, vehicle_name=drone_name)
        
    def takeoff(self, altitude: float = 20.0) -> bool:
        try:
            print(f"[{self.drone_name}] Taking off...")
            self.client.takeoffAsync(vehicle_name=self.drone_name).join()
            
            self.client.moveToZAsync(
                -altitude,
                velocity=5,
                vehicle_name=self.drone_name
            ).join()
            
            self.is_flying = True
            print(f"[{self.drone_name}] Hovering at {altitude}m")
            return True
            
        except Exception as e:
            print(f"Takeoff failed: {e}")
            return False
    
    def navigate_to(self, lat: float, lon: float, altitude: float = 30.0, 
                   velocity: float = 15.0) -> bool:
        try:
            target_x, target_y = self._gps_to_ned(lat, lon)
            
            print(f"[{self.drone_name}] Navigating to ({lat}, {lon})...")
            
            self.client.moveToPositionAsync(
                target_x, target_y, -altitude,
                velocity=velocity,
                vehicle_name=self.drone_name
            ).join()
            
            return True
            
        except Exception as e:
            print(f"Navigation failed: {e}")
            return False
    
    def orbit_target(self, center_x: float, center_y: float, 
                    radius: float = 10.0, altitude: float = 30.0,
                    duration: float = 60.0):
        print(f"[{self.drone_name}] Starting surveillance orbit...")
        
        start_time = time.time()
        angle = 0
        
        while time.time() - start_time < duration:
            angle += 0.1
            x = center_x + radius * math.cos(angle)
            y = center_y + radius * math.sin(angle)
            
            self.client.moveToPositionAsync(
                x, y, -altitude,
                velocity=5,
                vehicle_name=self.drone_name
            ).join()
            
            if int(time.time()) % 5 == 0:
                self.capture_image()
            
            time.sleep(0.1)
    
    def activate_deterrents(self, siren: bool = True, lights: bool = True, 
                           voice_message: str = None):
        if siren:
            print(f"[{self.drone_name}] 🔊 ACTIVATING 120dB SIREN")
        
        if lights:
            print(f"[{self.drone_name}] 💡 ACTIVATING STROBE LIGHTS")
        
        if voice_message:
            print(f"[{self.drone_name}] 📢 BROADCASTING: {voice_message}")
    
    def capture_image(self) -> np.ndarray:
        responses = self.client.simGetImages([
            airsim.ImageRequest("0", airsim.ImageType.Scene, False, False),
        ], vehicle_name=self.drone_name)
        
        return responses[0].image_data_uint8 if responses else None
    
    def get_telemetry(self) -> dict:
        state = self.client.getMultirotorState(vehicle_name=self.drone_name)
        gps = state.gps_location
        
        return {
            'latitude': gps.latitude,
            'longitude': gps.longitude,
            'altitude': gps.altitude,
            'velocity': {
                'x': state.kinematics_estimated.linear_velocity.x_val,
                'y': state.kinematics_estimated.linear_velocity.y_val,
                'z': state.kinematics_estimated.linear_velocity.z_val
            },
            'orientation': {
                'pitch': state.kinematics_estimated.orientation.x_val,
                'roll': state.kinematics_estimated.orientation.y_val,
                'yaw': state.kinematics_estimated.orientation.z_val
            },
            'timestamp': time.time()
        }
    
    def return_to_home(self):
        print(f"[{self.drone_name}] Returning to home...")
        self.client.goHomeAsync(vehicle_name=self.drone_name).join()
        self.land()
    
    def land(self):
        print(f"[{self.drone_name}] Landing...")
        self.client.landAsync(vehicle_name=self.drone_name).join()
        self.client.armDisarm(False, vehicle_name=self.drone_name)
        self.is_flying = False
    
    def _gps_to_ned(self, lat: float, lon: float) -> Tuple[float, float]:
        origin_lat = 40.7128
        origin_lon = -74.0060
        
        meters_per_deg_lat = 111320
        meters_per_deg_lon = 111320 * math.cos(math.radians(origin_lat))
        
        x = (lon - origin_lon) * meters_per_deg_lon
        y = (lat - origin_lat) * meters_per_deg_lat
        
        return x, y