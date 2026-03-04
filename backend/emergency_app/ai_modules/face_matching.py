import face_recognition
import numpy as np
import base64
from io import BytesIO
from PIL import Image
from typing import List, Dict
from django.contrib.gis.geos import Point
from ..models import Suspect

class FaceMatcher:
    def __init__(self):
        self.tolerance = 0.6
    
    def encode_image(self, image_base64: str) -> np.ndarray:
        try:
            image_bytes = base64.b64decode(image_base64)
            image = Image.open(BytesIO(image_bytes))
            image_array = np.array(image)
            
            encodings = face_recognition.face_encodings(image_array)
            return encodings[0] if encodings else None
            
        except Exception as e:
            print(f"Face encoding error: {e}")
            return None
    
    def match(self, image_base64: str, location: dict = None) -> List[Dict]:
        query_encoding = self.encode_image(image_base64)
        if query_encoding is None:
            return []
        
        matches = []
        suspects = Suspect.objects.all()
        
        for suspect in suspects:
            if not suspect.face_encoding:
                continue
            
            db_encoding = np.frombuffer(suspect.face_encoding, dtype=np.float64)
            distance = face_recognition.face_distance([db_encoding], query_encoding)[0]
            
            if distance <= self.tolerance:
                matches.append({
                    'suspect_id': str(suspect.id),
                    'name': suspect.name,
                    'risk_level': suspect.risk_level,
                    'confidence': float(1 - distance),
                    'distance': float(distance),
                    'last_seen': suspect.last_seen_timestamp.isoformat() if suspect.last_seen_timestamp else None
                })
        
        matches.sort(key=lambda x: x['confidence'], reverse=True)
        
        if location and matches:
            top_match = Suspect.objects.get(id=matches[0]['suspect_id'])
            top_match.last_seen_location = Point(location['lng'], location['lat'])
            from django.utils import timezone
            top_match.last_seen_timestamp = timezone.now()
            top_match.save()
        
        return matches[:5]

_matcher = None

def match_face(image_base64: str, location: dict = None) -> List[Dict]:
    global _matcher
    if _matcher is None:
        _matcher = FaceMatcher()
    return _matcher.match(image_base64, location)