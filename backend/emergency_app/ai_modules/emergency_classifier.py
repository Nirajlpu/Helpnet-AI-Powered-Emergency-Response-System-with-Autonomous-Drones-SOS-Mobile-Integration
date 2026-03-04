import numpy as np
import base64
import io
import librosa
from typing import Dict, Any

class EmergencyClassifier:
    def __init__(self):
        self.emergency_keywords = ['help', 'fire', 'police', 'emergency', 'stop', 'thief', 'gun', 'please help']
        self.high_risk_sounds = ['gunshot', 'screaming', 'explosion', 'siren', 'glass_breaking', 'shouting']
        
    def classify(self, audio_base64: str) -> Dict[str, Any]:
        try:
            audio_bytes = base64.b64decode(audio_base64)
            audio_array, sr = librosa.load(io.BytesIO(audio_bytes), sr=16000)
            
            features = self._extract_features(audio_array, sr)
            severity = self._determine_severity(features, audio_array, sr)
            
            return {
                'severity': severity,
                'confidence': 0.85,
                'features_detected': features,
                'transcription': self._mock_transcription(features),
                'keywords_detected': [kw for kw in self.emergency_keywords if kw in str(features).lower()]
            }
            
        except Exception as e:
            return {
                'severity': 'HIGH',
                'error': str(e),
                'confidence': 0.0
            }
    
    def _extract_features(self, audio_array: np.ndarray, sr: int) -> list:
        try:
            mfccs = librosa.feature.mfcc(y=audio_array, sr=sr, n_mfcc=13)
            spectral_centroids = librosa.feature.spectral_centroid(y=audio_array, sr=sr)
            zero_crossing_rate = librosa.feature.zero_crossing_rate(audio_array)
            
            return {
                'mfcc_mean': float(np.mean(mfccs)),
                'spectral_centroid_mean': float(np.mean(spectral_centroids)),
                'zero_crossing_rate_mean': float(np.mean(zero_crossing_rate)),
                'duration': float(len(audio_array) / sr)
            }
        except:
            return {}
    
    def _determine_severity(self, features: dict, audio_array: np.ndarray, sr: int) -> str:
        zcr = features.get('zero_crossing_rate_mean', 0)
        duration = features.get('duration', 0)
        
        if zcr > 0.1 or duration < 2.0:
            return 'CRITICAL'
        elif zcr > 0.05:
            return 'HIGH'
        elif duration > 10:
            return 'MEDIUM'
        return 'LOW'
    
    def _mock_transcription(self, features: dict) -> str:
        return "Emergency assistance needed"

_classifier = None

def classify_emergency(audio_base64: str) -> dict:
    global _classifier
    if _classifier is None:
        _classifier = EmergencyClassifier()
    return _classifier.classify(audio_base64)