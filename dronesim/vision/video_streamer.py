import airsim
import cv2
import numpy as np
import threading
import queue
import base64
import requests
import time
from datetime import datetime

class VideoStreamer:
    def __init__(self, drone_name: str, backend_url: str, incident_id: str):
        self.client = airsim.MultirotorClient()
        self.drone_name = drone_name
        self.backend_url = backend_url
        self.incident_id = incident_id
        self.frame_queue = queue.Queue(maxsize=30)
        self.is_streaming = False
        self.fps = 30
        
        from .face_detection import FaceDetector
        self.face_detector = FaceDetector()
        
    def start_stream(self):
        self.is_streaming = True
        
        threading.Thread(target=self._capture_frames, daemon=True).start()
        threading.Thread(target=self._process_frames, daemon=True).start()
        threading.Thread(target=self._upload_frames, daemon=True).start()
        
    def _capture_frames(self):
        while self.is_streaming:
            try:
                responses = self.client.simGetImages([
                    airsim.ImageRequest("0", airsim.ImageType.Scene, False, False)
                ], vehicle_name=self.drone_name)
                
                if responses:
                    img_data = responses[0].image_data_uint8
                    img = cv2.imdecode(
                        np.frombuffer(img_data, np.uint8),
                        cv2.IMREAD_COLOR
                    )
                    
                    if not self.frame_queue.full():
                        self.frame_queue.put(img)
                        
                time.sleep(1/self.fps)
                
            except Exception as e:
                print(f"Capture error: {e}")
                time.sleep(1)
    
    def _process_frames(self):
        while self.is_streaming:
            try:
                frame = self.frame_queue.get(timeout=1)
                
                faces = self.face_detector.detect(frame)
                frame = self.face_detector.draw_boxes(frame, faces)
                
                _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                self._upload_buffer(buffer, len(faces))
                
            except queue.Empty:
                continue
            except Exception as e:
                print(f"Processing error: {e}")
    
    def _upload_buffer(self, buffer, face_count=0):
        try:
            files = {'frame': ('frame.jpg', buffer.tobytes(), 'image/jpeg')}
            data = {
                'incident_id': self.incident_id,
                'drone_name': self.drone_name,
                'timestamp': datetime.now().isoformat(),
                'faces_detected': face_count
            }
            
            requests.post(
                f"{self.backend_url}/api/evidence/upload_frame/",
                files=files,
                data=data,
                timeout=5
            )
        except:
            pass
    
    def stop(self):
        self.is_streaming = False