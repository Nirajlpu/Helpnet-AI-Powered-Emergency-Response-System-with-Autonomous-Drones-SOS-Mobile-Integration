import airsim
import requests
import time
import json
from datetime import datetime
import threading

class TelemetryClient:
    def __init__(self, drone_name: str, backend_url: str, update_interval: float = 1.0):
        self.drone_name = drone_name
        self.backend_url = backend_url
        self.update_interval = update_interval
        self.client = airsim.MultirotorClient()
        self.client.confirmConnection()
        self.running = False
        
    def start(self):
        self.running = True
        threading.Thread(target=self._update_loop, daemon=True).start()
        print(f"[{self.drone_name}] Telemetry updater started")
    
    def _update_loop(self):
        while self.running:
            try:
                telemetry = self._gather_telemetry()
                self._send_update(telemetry)
                time.sleep(self.update_interval)
            except Exception as e:
                print(f"Update error: {e}")
                time.sleep(5)
    
    def _gather_telemetry(self) -> dict:
        state = self.client.getMultirotorState(vehicle_name=self.drone_name)
        gps = state.gps_location
        
        return {
            'drone_name': self.drone_name,
            'timestamp': datetime.now().isoformat(),
            'latitude': gps.latitude,
            'longitude': gps.longitude,
            'altitude': gps.altitude,
            'velocity': {
                'x': state.kinematics_estimated.linear_velocity.x_val,
                'y': state.kinematics_estimated.linear_velocity.y_val,
                'z': state.kinematics_estimated.linear_velocity.z_val
            },
            'battery_level': 85,
            'is_flying': not state.landed_state
        }
    
    def _send_update(self, telemetry: dict):
        endpoint = f"{self.backend_url}/api/drones/{self.drone_name}/telemetry/"
        
        try:
            response = requests.post(
                endpoint,
                json=telemetry,
                headers={'Content-Type': 'application/json'},
                timeout=5
            )
            
            if response.status_code == 200:
                commands = response.json().get('commands', [])
                self._process_commands(commands)
        except requests.exceptions.RequestException:
            pass
    
    def _process_commands(self, commands: list):
        for cmd in commands:
            action = cmd.get('action')
            print(f"[{self.drone_name}] Received command: {action}")
    
    def stop(self):
        self.running = False