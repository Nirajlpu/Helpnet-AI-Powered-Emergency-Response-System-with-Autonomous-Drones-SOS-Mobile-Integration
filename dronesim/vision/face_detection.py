import cv2
import numpy as np
from typing import List, Tuple

class FaceDetector:
    def __init__(self):
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        self.confidence_threshold = 0.8
    
    def detect(self, frame: np.ndarray) -> List[Tuple[int, int, int, int]]:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(30, 30)
        )
        return faces
    
    def draw_boxes(self, frame: np.ndarray, faces: List[Tuple]) -> np.ndarray:
        for (x, y, w, h) in faces:
            cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
            cv2.putText(frame, 'SUSPECT', (x, y-10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
        return frame
    
    def extract_face(self, frame: np.ndarray, face_rect: Tuple) -> np.ndarray:
        x, y, w, h = face_rect
        return frame[y:y+h, x:x+w]