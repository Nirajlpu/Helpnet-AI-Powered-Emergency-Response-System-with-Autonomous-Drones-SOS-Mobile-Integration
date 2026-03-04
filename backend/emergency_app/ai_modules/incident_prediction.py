import numpy as np
from datetime import datetime, timedelta
from django.db.models import Count
from django.contrib.gis.geos import Point
from ..models import Incident

class HotspotPredictor:
    def __init__(self):
        self.grid_size = 0.01
    
    def predict(self) -> list:
        end_time = datetime.now()
        start_time = end_time - timedelta(days=30)
        
        recent_incidents = Incident.objects.filter(
            created_at__gte=start_time,
            created_at__lte=end_time
        )
        
        hotspots = []
        
        if recent_incidents.count() < 10:
            return hotspots
        
        locations = [(inc.location.x, inc.location.y) for inc in recent_incidents if inc.location]
        
        if not locations:
            return hotspots
        
        grid = {}
        for lng, lat in locations:
            grid_key = (round(lng / self.grid_size), round(lat / self.grid_size))
            grid[grid_key] = grid.get(grid_key, 0) + 1
        
        for (grid_x, grid_y), count in grid.items():
            if count >= 3:
                center_lng = grid_x * self.grid_size
                center_lat = grid_y * self.grid_size
                risk_score = min(count / 10.0, 1.0)
                
                hotspots.append({
                    'center': {'lng': center_lng, 'lat': center_lat},
                    'radius': 500,
                    'incident_count': count,
                    'risk_score': risk_score,
                    'severity': 'HIGH' if risk_score > 0.7 else 'MEDIUM'
                })
        
        return sorted(hotspots, key=lambda x: x['risk_score'], reverse=True)