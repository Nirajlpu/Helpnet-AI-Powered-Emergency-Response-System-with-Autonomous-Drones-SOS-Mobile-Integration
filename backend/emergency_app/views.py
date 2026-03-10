from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance
from django.utils import timezone
from django.db.models import Q, Count
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.http import HttpResponse, JsonResponse
from django.conf import settings as django_settings
import json
import base64
import time
import os
import threading
import glob

# In-memory store for latest video frames per incident (keyed by incident_id)
_live_frames = {}
_live_drone_frames = {}

# Active recordings: { incident_id: { 'dir': '/path/to/frames', 'frame_count': 0, 'started_at': time.time(), 'last_frame_at': time.time() } }
_active_recordings = {}
_recording_lock = threading.Lock()

# Drone recordings (separate from phone)
_active_drone_recordings = {}
_drone_recording_lock = threading.Lock()

# Stale recording timeout (seconds) — auto-finalize when no new frames for this long
# 30s to tolerate mobile-data / ngrok hiccups without fragmenting recordings
_RECORDING_STALE_TIMEOUT = 30


def _assemble_mp4(frame_dir, video_full_path, fps=5):
    """Assemble JPEG frames (and optional PCM audio) into an MP4 video. Returns (frame_count, duration) or None."""
    import subprocess
    frame_files = sorted(glob.glob(os.path.join(frame_dir, 'frame_*.jpg')))
    if not frame_files:
        return None
    os.makedirs(os.path.dirname(video_full_path), exist_ok=True)
    num_frames = len(frame_files)
    assembled = False

    # Check for audio file
    audio_path = os.path.join(frame_dir, 'audio.pcm')
    has_audio = os.path.exists(audio_path) and os.path.getsize(audio_path) > 0

    # Try ffmpeg first for H.264 + faststart (proper duration & browser playback)
    try:
        frame_pattern = os.path.join(frame_dir, 'frame_*.jpg')
        cmd = [
            'ffmpeg', '-y', '-framerate', str(fps),
            '-pattern_type', 'glob', '-i', frame_pattern,
        ]
        if has_audio:
            # Raw PCM: 16kHz, mono, 16-bit signed little-endian
            cmd += [
                '-f', 's16le', '-ar', '16000', '-ac', '1', '-i', audio_path,
            ]
        # Explicit stream mapping when audio is present
        if has_audio:
            cmd += ['-map', '0:v', '-map', '1:a']
        cmd += [
            '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
            '-crf', '23', '-preset', 'fast',
        ]
        if has_audio:
            cmd += ['-c:a', 'aac', '-b:a', '64k', '-shortest']
        cmd += ['-movflags', '+faststart', video_full_path]
        print(f"[_assemble_mp4] ffmpeg cmd: {' '.join(cmd)}")
        result = subprocess.run(cmd, check=True, capture_output=True, timeout=120, text=True)
        if result.stderr:
            print(f"[_assemble_mp4] ffmpeg stderr: {result.stderr[-500:]}")
        # Validate output — must be at least 1KB per 10 frames
        if os.path.exists(video_full_path) and os.path.getsize(video_full_path) >= max(1024, num_frames * 100):
            assembled = True
            print(f"[_assemble_mp4] Success: {video_full_path} ({os.path.getsize(video_full_path)} bytes, audio={'yes' if has_audio else 'no'})")
        else:
            # ffmpeg ran but produced a suspiciously small file — remove it
            if os.path.exists(video_full_path):
                os.remove(video_full_path)
            print(f"[_assemble_mp4] ffmpeg output too small, falling back to OpenCV")
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired, OSError) as e:
        print(f"[_assemble_mp4] ffmpeg failed: {e}")
        if hasattr(e, 'stderr') and e.stderr:
            print(f"[_assemble_mp4] ffmpeg stderr: {e.stderr[-500:]}")
        pass

    if not assembled:
        # Fallback to OpenCV with mp4v codec (reliable, browser-playable)
        import cv2
        first = cv2.imread(frame_files[0])
        if first is None:
            return None
        h, w = first.shape[:2]
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        writer = cv2.VideoWriter(video_full_path, fourcc, fps, (w, h))
        if not writer.isOpened():
            return None
        for fp in frame_files:
            img = cv2.imread(fp)
            if img is not None:
                if img.shape[:2] != (h, w):
                    img = cv2.resize(img, (w, h))
                writer.write(img)
        writer.release()

    # Clean up frame files
    for fp in frame_files:
        try:
            os.remove(fp)
        except OSError:
            pass
    # Clean up audio file
    if os.path.exists(audio_path):
        try:
            os.remove(audio_path)
        except OSError:
            pass
    try:
        os.rmdir(frame_dir)
    except OSError:
        pass

    duration = num_frames / fps if fps else 0
    return (num_frames, duration)


def _finalize_stale_recordings():
    """Background thread: auto-finalize recordings that haven't received frames for _RECORDING_STALE_TIMEOUT seconds."""
    while True:
        time.sleep(5)
        now = time.time()
        # Phone recordings
        stale_phone = []
        with _recording_lock:
            for key, rec in _active_recordings.items():
                if now - rec.get('last_frame_at', rec.get('started_at', 0)) >= _RECORDING_STALE_TIMEOUT:
                    stale_phone.append(key)
        for key in stale_phone:
            with _recording_lock:
                rec = _active_recordings.pop(key, None)
            if rec and rec['frame_count'] >= 3:
                try:
                    video_filename = f"{int(rec['started_at'])}.mp4"
                    video_rel = os.path.join('recordings', key, 'phone', video_filename)
                    video_full = os.path.join(django_settings.MEDIA_ROOT, video_rel)
                    result = _assemble_mp4(rec['dir'], video_full)
                    if result:
                        # Update Incident model so recordings endpoint finds it
                        try:
                            from .models import Incident
                            incident = Incident.objects.get(pk=key)
                            incident.phone_video = video_rel
                            incident.phone_video_url = f"{django_settings.MEDIA_URL}{video_rel}"
                            incident.save(update_fields=['phone_video', 'phone_video_url'])
                        except Exception:
                            pass
                except Exception as e:
                    import traceback
                    traceback.print_exc()

        # Drone recordings
        stale_drone = []
        with _drone_recording_lock:
            for key, rec in _active_drone_recordings.items():
                if now - rec.get('last_frame_at', rec.get('started_at', 0)) >= _RECORDING_STALE_TIMEOUT:
                    stale_drone.append(key)
        for key in stale_drone:
            with _drone_recording_lock:
                rec = _active_drone_recordings.pop(key, None)
            if rec and rec['frame_count'] >= 3:
                try:
                    video_filename = f"{int(rec['started_at'])}.mp4"
                    video_rel = os.path.join('recordings', key, 'drone', video_filename)
                    video_full = os.path.join(django_settings.MEDIA_ROOT, video_rel)
                    _assemble_mp4(rec['dir'], video_full)
                except Exception:
                    import traceback
                    traceback.print_exc()


# Start background finalization thread (daemon so it dies with the process)
_finalize_thread = threading.Thread(target=_finalize_stale_recordings, daemon=True)
_finalize_thread.start()

from .models import Incident, Drone, Suspect, Evidence, Responder, UserProfile, FamilyRelation
from .serializers import (
    IncidentSerializer, DroneSerializer, SuspectSerializer,
    EvidenceSerializer, ResponderSerializer, SOSRequestSerializer,
    UserProfileSerializer, FamilyRelationSerializer,
)
from .ai_modules.emergency_classifier import classify_emergency
from .ai_modules.routing_optimization import calculate_eta
from .tasks import auto_dispatch_drone


# ═══════════════════════════════════════════════════════
#  UserProfile
# ═══════════════════════════════════════════════════════

class UserProfileViewSet(viewsets.ModelViewSet):
    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = UserProfile.objects.select_related('user').all()

        role = self.request.query_params.get('role')
        if role:
            queryset = queryset.filter(role=role)

        is_verified = self.request.query_params.get('is_verified')
        if is_verified is not None:
            queryset = queryset.filter(is_verified=is_verified.lower() == 'true')

        is_volunteer = self.request.query_params.get('is_volunteer')
        if is_volunteer is not None:
            queryset = queryset.filter(is_volunteer=is_volunteer.lower() == 'true')

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(email__icontains=search) |
                Q(phone__icontains=search) |
                Q(user_id_code__icontains=search)
            )

        return queryset

    @action(detail=True, methods=['get'])
    def family(self, request, pk=None):
        """Get all family relations for a user profile."""
        profile = self.get_object()
        relations = FamilyRelation.objects.filter(from_user=profile).select_related('to_user')
        return Response(FamilyRelationSerializer(relations, many=True).data)

    @action(detail=True, methods=['post'])
    def add_family(self, request, pk=None):
        """Add a family relation: { to_user: <id>, relation: 'SON' }"""
        profile = self.get_object()
        to_user_id = request.data.get('to_user')
        relation = request.data.get('relation')

        if not to_user_id or not relation:
            return Response({'error': 'to_user and relation are required'}, status=400)

        try:
            to_user = UserProfile.objects.get(id=to_user_id)
        except UserProfile.DoesNotExist:
            return Response({'error': 'Target user not found'}, status=404)

        family_relation, created = FamilyRelation.objects.get_or_create(
            from_user=profile, to_user=to_user, defaults={'relation': relation}
        )
        if not created:
            return Response({'error': 'Relation already exists'}, status=400)

        return Response(FamilyRelationSerializer(family_relation).data, status=201)

    @action(detail=True, methods=['delete'])
    def remove_family(self, request, pk=None):
        """Remove a family relation: ?to_user=<id>"""
        profile = self.get_object()
        to_user_id = request.query_params.get('to_user')

        deleted, _ = FamilyRelation.objects.filter(
            from_user=profile, to_user_id=to_user_id
        ).delete()

        if deleted == 0:
            return Response({'error': 'Relation not found'}, status=404)

        return Response({'status': 'removed'})

    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get the currently logged-in user's profile."""
        try:
            profile = UserProfile.objects.get(user=request.user)
            return Response(UserProfileSerializer(profile).data)
        except UserProfile.DoesNotExist:
            return Response({'error': 'Profile not found'}, status=404)


# ═══════════════════════════════════════════════════════
#  Incident
# ═══════════════════════════════════════════════════════

class IncidentViewSet(viewsets.ModelViewSet):
    queryset = Incident.objects.all()
    serializer_class = IncidentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Incident.objects.select_related(
            'reporter', 'reporter_profile', 'which_authority_took_action'
        ).prefetch_related('assigned_drones', 'responders_assigned', 'family_members_notified')

        # Status filter
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Severity filter
        severity = self.request.query_params.get('severity')
        if severity:
            queryset = queryset.filter(severity=severity)

        # Incident type filter
        incident_type = self.request.query_params.get('incident_type')
        if incident_type:
            queryset = queryset.filter(incident_type=incident_type)

        # Action taken status filter
        action_status = self.request.query_params.get('action_status')
        if action_status:
            queryset = queryset.filter(action_taken_by_authority=action_status)

        # Date range filter
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            queryset = queryset.filter(created_at__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__lte=date_to)

        # Geo proximity filter
        lat = self.request.query_params.get('lat')
        lng = self.request.query_params.get('lng')
        radius = self.request.query_params.get('radius', 5000)

        if lat and lng:
            point = Point(float(lng), float(lat), srid=4326)
            queryset = queryset.filter(
                location_coordinates__distance_lte=(point, float(radius))
            ).annotate(distance=Distance('location_coordinates', point)).order_by('distance')

        return queryset

    def perform_create(self, serializer):
        """Auto-set reporter and reporter_profile on creation."""
        user = self.request.user
        profile = getattr(user.profile, 'profile', None)
        serializer.save(
            reporter=user,
            reporter_profile=profile,
        )

    @action(detail=True, methods=['post'])
    def dispatch_drone(self, request, pk=None):
        """Find nearest available drone and dispatch it to the incident."""
        incident = self.get_object()

        nearest_drone = Drone.objects.filter(
            status='IDLE',
            battery_level__gte=20
        ).annotate(
            distance=Distance('current_location', incident.location_coordinates)
        ).order_by('distance').first()

        if not nearest_drone:
            return Response(
                {'error': 'No available drones'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        nearest_drone.status = 'EN_ROUTE'
        nearest_drone.current_incident = incident
        nearest_drone.destination_location = incident.location_coordinates
        nearest_drone.save()

        incident.status = 'DISPATCHED'
        incident.save()

        # WebSocket notification
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"incident_{incident.id}",
            {
                'type': 'drone_dispatched',
                'drone_id': str(nearest_drone.id),
                'incident_id': str(incident.id)
            }
        )

        return Response({
            'drone': DroneSerializer(nearest_drone).data,
            'eta_seconds': calculate_eta(
                nearest_drone.current_location,
                incident.location_coordinates
            )
        })

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        """Mark incident as resolved and release assigned drones."""
        incident = self.get_object()
        incident.status = 'RESOLVED'
        incident.resolved_at = timezone.now()
        incident.save()

        # Return all drones to base
        incident.assigned_drones.update(
            status='RETURNING',
            current_incident=None,
            destination_location=None,
        )

        return Response({'status': 'resolved'})

    @action(detail=True, methods=['post'])
    def assign_authority(self, request, pk=None):
        """Assign an authority (UserProfile) to take action on the incident."""
        incident = self.get_object()
        authority_id = request.data.get('authority_id')
        action_status = request.data.get('action_status', 'UNDER_REVIEW')

        try:
            authority = UserProfile.objects.get(id=authority_id)
        except UserProfile.DoesNotExist:
            return Response({'error': 'Authority profile not found'}, status=404)

        incident.which_authority_took_action = authority
        incident.action_taken_by_authority = action_status
        incident.save()

        return Response({
            'status': 'authority assigned',
            'authority': str(authority),
            'action_status': action_status,
        })

    @action(detail=True, methods=['post'])
    def notify_family(self, request, pk=None):
        """Notify family members of the reporter about this incident."""
        incident = self.get_object()

        if not incident.reporter_profile:
            return Response({'error': 'No reporter profile linked'}, status=400)

        # Get reporter's family members
        family_relations = FamilyRelation.objects.filter(
            from_user=incident.reporter_profile
        ).select_related('to_user')

        family_profiles = [rel.to_user for rel in family_relations]
        incident.family_members_notified.add(*family_profiles)

        return Response({
            'status': 'family notified',
            'notified_count': len(family_profiles),
            'members': [
                {'name': f"{p.first_name} {p.last_name}", 'phone': p.phone, 'relation': rel.relation}
                for p, rel in zip(family_profiles, family_relations)
            ],
        })

    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def live(self, request):
        """Receive live location streaming from user devices."""
        lat = request.data.get('latitude')
        lng = request.data.get('longitude')
        if lat is not None and lng is not None:
            # Successfully received real-time location.
            return Response({"status": "location received"})
        return Response({"error": "Missing coordinates"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], permission_classes=[AllowAny], url_path='stream-frame')
    def stream_frame(self, request, pk=None):
        """Receive a JPEG frame from the phone for live streaming."""
        frame_file = request.FILES.get('frame')
        frame_b64 = request.data.get('frame_base64')
        if frame_file:
            frame_data = frame_file.read()
        elif frame_b64:
            frame_data = base64.b64decode(frame_b64)
        else:
            return Response({"error": "No frame data"}, status=status.HTTP_400_BAD_REQUEST)
        _live_frames[str(pk)] = {'data': frame_data, 'timestamp': time.time()}

        # Auto-record: always save frame to disk (write inside lock to prevent race with finalize thread)
        incident_key = str(pk)
        with _recording_lock:
            rec = _active_recordings.get(incident_key)
            if not rec:
                rec_dir = os.path.join(django_settings.MEDIA_ROOT, 'recordings', incident_key, 'phone', '_frames_' + str(int(time.time())))
                os.makedirs(rec_dir, exist_ok=True)
                rec = {'dir': rec_dir, 'frame_count': 0, 'started_at': time.time(), 'last_frame_at': time.time()}
                _active_recordings[incident_key] = rec
            frame_path = os.path.join(rec['dir'], f"frame_{rec['frame_count']:06d}.jpg")
            rec['frame_count'] += 1
            rec['last_frame_at'] = time.time()
            with open(frame_path, 'wb') as f:
                f.write(frame_data)

        return Response({"status": "frame received"})

    @action(detail=True, methods=['get'], permission_classes=[AllowAny], url_path='latest-frame')
    def latest_frame(self, request, pk=None):
        """Return the latest JPEG frame for the dashboard to display."""
        entry = _live_frames.get(str(pk))
        if not entry or (time.time() - entry['timestamp'] > 30):
            return HttpResponse(status=204)  # No content / stale
        return HttpResponse(entry['data'], content_type='image/jpeg')

    @action(detail=True, methods=['post'], permission_classes=[AllowAny], url_path='stream-audio')
    def stream_audio(self, request, pk=None):
        """Receive a raw PCM audio chunk and append to the active recording's audio file."""
        audio_file = request.FILES.get('audio')
        if not audio_file:
            return Response({"error": "No audio data"}, status=status.HTTP_400_BAD_REQUEST)
        audio_data = audio_file.read()
        incident_key = str(pk)
        with _recording_lock:
            rec = _active_recordings.get(incident_key)
            if not rec:
                # No active recording — start one (audio arrived before first frame)
                rec_dir = os.path.join(django_settings.MEDIA_ROOT, 'recordings', incident_key, 'phone', '_frames_' + str(int(time.time())))
                os.makedirs(rec_dir, exist_ok=True)
                rec = {'dir': rec_dir, 'frame_count': 0, 'started_at': time.time(), 'last_frame_at': time.time()}
                _active_recordings[incident_key] = rec
            audio_path = os.path.join(rec['dir'], 'audio.pcm')
            rec['last_frame_at'] = time.time()
            with open(audio_path, 'ab') as f:
                f.write(audio_data)
        print(f"[stream_audio] Received {len(audio_data)} bytes for incident {incident_key}, total audio: {os.path.getsize(audio_path)} bytes")

        # Broadcast audio chunk to dashboard viewers via WebSocket
        import base64
        try:
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"audio_{incident_key}",
                {
                    'type': 'audio_chunk',
                    'data': base64.b64encode(audio_data).decode('ascii'),
                }
            )
        except Exception:
            pass  # Don't fail audio save if broadcast fails

        return Response({"status": "audio received"})

    # ── Drone frame streaming ──

    @action(detail=True, methods=['post'], permission_classes=[AllowAny], url_path='drone-stream-frame')
    def drone_stream_frame(self, request, pk=None):
        """Receive a JPEG frame from the drone for live streaming."""
        frame_file = request.FILES.get('frame')
        frame_b64 = request.data.get('frame_base64')
        if frame_file:
            frame_data = frame_file.read()
        elif frame_b64:
            frame_data = base64.b64decode(frame_b64)
        else:
            return Response({"error": "No frame data"}, status=status.HTTP_400_BAD_REQUEST)
        _live_drone_frames[str(pk)] = {'data': frame_data, 'timestamp': time.time()}

        # Auto-record: always save drone frame to disk (write inside lock to prevent race with finalize thread)
        incident_key = str(pk)
        with _drone_recording_lock:
            rec = _active_drone_recordings.get(incident_key)
            if not rec:
                rec_dir = os.path.join(django_settings.MEDIA_ROOT, 'recordings', incident_key, 'drone', '_frames_' + str(int(time.time())))
                os.makedirs(rec_dir, exist_ok=True)
                rec = {'dir': rec_dir, 'frame_count': 0, 'started_at': time.time(), 'last_frame_at': time.time()}
                _active_drone_recordings[incident_key] = rec
            frame_path = os.path.join(rec['dir'], f"frame_{rec['frame_count']:06d}.jpg")
            rec['frame_count'] += 1
            rec['last_frame_at'] = time.time()
            with open(frame_path, 'wb') as f:
                f.write(frame_data)

        return Response({"status": "drone frame received"})

    @action(detail=True, methods=['get'], permission_classes=[AllowAny], url_path='drone-latest-frame')
    def drone_latest_frame(self, request, pk=None):
        """Return the latest JPEG frame from the drone."""
        entry = _live_drone_frames.get(str(pk))
        if not entry or (time.time() - entry['timestamp'] > 30):
            return HttpResponse(status=204)
        return HttpResponse(entry['data'], content_type='image/jpeg')

    @action(detail=True, methods=['post'], permission_classes=[AllowAny], url_path='drone-start-recording')
    def drone_start_recording(self, request, pk=None):
        """Start recording drone frames for this incident."""
        incident_key = str(pk)
        with _drone_recording_lock:
            if incident_key in _active_drone_recordings:
                rec = _active_drone_recordings[incident_key]
                return Response({"status": "already recording", "recording": True, "frame_count": rec['frame_count'], "duration_seconds": round(time.time() - rec['started_at'], 1)})
            rec_dir = os.path.join(django_settings.MEDIA_ROOT, 'recordings', incident_key, 'drone', '_frames_' + str(int(time.time())))
            os.makedirs(rec_dir, exist_ok=True)
            _active_drone_recordings[incident_key] = {
                'dir': rec_dir,
                'frame_count': 0,
                'started_at': time.time(),
                'last_frame_at': time.time(),
            }
        return Response({"status": "drone recording started", "recording_dir": rec_dir})

    @action(detail=True, methods=['post'], permission_classes=[AllowAny], url_path='drone-stop-recording')
    def drone_stop_recording(self, request, pk=None):
        """Stop drone recording and assemble frames into an MP4 video."""
        incident_key = str(pk)
        with _drone_recording_lock:
            rec = _active_drone_recordings.pop(incident_key, None)
        if not rec:
            return Response({"error": "No active drone recording"}, status=status.HTTP_400_BAD_REQUEST)

        frame_dir = rec['dir']
        frame_files = sorted(glob.glob(os.path.join(frame_dir, 'frame_*.jpg')))
        if not frame_files:
            return Response({"error": "No frames captured"}, status=status.HTTP_400_BAD_REQUEST)

        fps = request.data.get('fps', 5)
        try:
            fps = int(fps)
        except (ValueError, TypeError):
            fps = 5

        video_filename = f"{int(rec['started_at'])}.mp4"
        video_rel_path = os.path.join('recordings', incident_key, 'drone', video_filename)
        video_full_path = os.path.join(django_settings.MEDIA_ROOT, video_rel_path)

        result = _assemble_mp4(frame_dir, video_full_path, fps=fps)
        if not result:
            return Response({"error": "Failed to assemble video"}, status=500)

        num_frames, duration = result
        video_url = f"{django_settings.MEDIA_URL}{video_rel_path}"
        return Response({
            "status": "drone recording saved",
            "video_url": video_url,
            "frames": num_frames,
            "duration_seconds": duration,
        })

    @action(detail=True, methods=['get'], permission_classes=[AllowAny], url_path='drone-recording-status')
    def drone_recording_status(self, request, pk=None):
        """Check if drone recording is active for this incident."""
        incident_key = str(pk)
        with _drone_recording_lock:
            rec = _active_drone_recordings.get(incident_key)
        if rec:
            return Response({
                "recording": True,
                "frame_count": rec['frame_count'],
                "duration_seconds": round(time.time() - rec['started_at'], 1),
                "auto": True,
            })
        return Response({"recording": False})

    @action(detail=True, methods=['get'], permission_classes=[AllowAny], url_path='drone-recordings')
    def drone_recordings(self, request, pk=None):
        """List available drone recordings for this incident."""
        incident_key = str(pk)
        drone_dir = os.path.join(django_settings.MEDIA_ROOT, 'recordings', incident_key, 'drone')
        results = []
        if os.path.isdir(drone_dir):
            pattern = os.path.join(drone_dir, '*.mp4')
            for vpath in sorted(glob.glob(pattern), reverse=True):
                fname = os.path.basename(vpath)
                size = os.path.getsize(vpath)
                rel = os.path.join('recordings', incident_key, 'drone', fname)
                results.append({"filename": fname, "url": f"{django_settings.MEDIA_URL}{rel}", "size_bytes": size})
        return Response(results)

    @action(detail=True, methods=['post'], permission_classes=[AllowAny], url_path='start-recording')
    def start_recording(self, request, pk=None):
        """Start recording frames for this incident."""
        incident_key = str(pk)
        with _recording_lock:
            if incident_key in _active_recordings:
                rec = _active_recordings[incident_key]
                return Response({"status": "already recording", "recording": True, "frame_count": rec['frame_count'], "duration_seconds": round(time.time() - rec['started_at'], 1)})
            rec_dir = os.path.join(django_settings.MEDIA_ROOT, 'recordings', incident_key, 'phone', '_frames_' + str(int(time.time())))
            os.makedirs(rec_dir, exist_ok=True)
            _active_recordings[incident_key] = {
                'dir': rec_dir,
                'frame_count': 0,
                'started_at': time.time(),
                'last_frame_at': time.time(),
            }
        return Response({"status": "recording started", "recording_dir": rec_dir})

    @action(detail=True, methods=['post'], permission_classes=[AllowAny], url_path='stop-recording')
    def stop_recording(self, request, pk=None):
        """Stop recording and assemble frames into an MP4 video."""
        incident_key = str(pk)
        with _recording_lock:
            rec = _active_recordings.pop(incident_key, None)
        if not rec:
            return Response({"error": "No active recording"}, status=status.HTTP_400_BAD_REQUEST)

        frame_dir = rec['dir']
        frame_files = sorted(glob.glob(os.path.join(frame_dir, 'frame_*.jpg')))
        if not frame_files:
            return Response({"error": "No frames captured"}, status=status.HTTP_400_BAD_REQUEST)

        fps = request.data.get('fps', 5)
        try:
            fps = int(fps)
        except (ValueError, TypeError):
            fps = 5

        video_filename = f"{int(rec['started_at'])}.mp4"
        video_rel_path = os.path.join('recordings', incident_key, 'phone', video_filename)
        video_full_path = os.path.join(django_settings.MEDIA_ROOT, video_rel_path)

        result = _assemble_mp4(frame_dir, video_full_path, fps=fps)
        if not result:
            return Response({"error": "Failed to assemble video"}, status=500)

        num_frames, duration = result

        # Save to incident model
        try:
            incident = Incident.objects.get(pk=pk)
            incident.phone_video = video_rel_path
            incident.phone_video_url = f"{django_settings.MEDIA_URL}{video_rel_path}"
            incident.save(update_fields=['phone_video', 'phone_video_url'])
        except Incident.DoesNotExist:
            pass

        video_url = f"{django_settings.MEDIA_URL}{video_rel_path}"
        return Response({
            "status": "recording saved",
            "video_url": video_url,
            "frames": num_frames,
            "duration_seconds": duration,
        })

    @action(detail=True, methods=['get'], permission_classes=[AllowAny], url_path='recording-status')
    def recording_status(self, request, pk=None):
        """Check if recording is currently active for this incident."""
        incident_key = str(pk)
        with _recording_lock:
            rec = _active_recordings.get(incident_key)
        if rec:
            return Response({
                "recording": True,
                "frame_count": rec['frame_count'],
                "duration_seconds": round(time.time() - rec['started_at'], 1),
                "auto": True,
            })
        return Response({"recording": False})

    @action(detail=True, methods=['get'], permission_classes=[AllowAny])
    def recordings(self, request, pk=None):
        """List available recordings for this incident."""
        incident_key = str(pk)
        phone_dir = os.path.join(django_settings.MEDIA_ROOT, 'recordings', incident_key, 'phone')
        results = []
        if os.path.isdir(phone_dir):
            pattern = os.path.join(phone_dir, '*.mp4')
            for vpath in sorted(glob.glob(pattern), reverse=True):
                fname = os.path.basename(vpath)
                size = os.path.getsize(vpath)
                rel = os.path.join('recordings', incident_key, 'phone', fname)
                results.append({
                    "filename": fname,
                    "url": f"{django_settings.MEDIA_URL}{rel}",
                    "size_bytes": size,
                })
        # Also check model fields
        seen_filenames = {r['filename'] for r in results}
        try:
            incident = Incident.objects.get(pk=pk)
            if incident.phone_video:
                fname = os.path.basename(str(incident.phone_video))
                if fname not in seen_filenames:
                    results.insert(0, {
                        "filename": fname,
                        "url": incident.phone_video.url if incident.phone_video else incident.phone_video_url,
                        "size_bytes": incident.phone_video.size if incident.phone_video else 0,
                    })
        except (Incident.DoesNotExist, ValueError):
            pass
        return Response(results)

    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def upload_video(self, request):
        """Receive emergency video uploads from devices."""
        video_file = request.FILES.get('file')
        if not video_file:
            return Response({"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)
        
        return Response({"status": "video received", "filename": video_file.name})

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Return incident statistics for the dashboard."""
        total = Incident.objects.count()
        active = Incident.objects.exclude(status='RESOLVED').count()
        resolved = Incident.objects.filter(status='RESOLVED').count()

        # By severity
        by_severity = {}
        for choice in Incident.SEVERITY_CHOICES:
            by_severity[choice[0]] = Incident.objects.filter(severity=choice[0]).count()

        # By incident type
        by_type = {}
        for choice in Incident.INCIDENT_TYPE_CHOICES:
            count = Incident.objects.filter(incident_type=choice[0]).count()
            if count > 0:
                by_type[choice[0]] = count

        return Response({
            'total': total,
            'active': active,
            'resolved': resolved,
            'by_severity': by_severity,
            'by_type': by_type,
        })


# ═══════════════════════════════════════════════════════
#  Drone
# ═══════════════════════════════════════════════════════

class DroneViewSet(viewsets.ModelViewSet):
    queryset = Drone.objects.all()
    serializer_class = DroneSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['post'])
    def telemetry(self, request, pk=None):
        """Update drone telemetry (location, battery, etc.)."""
        drone = self.get_object()

        lat = request.data.get('latitude')
        lng = request.data.get('longitude')
        if lat and lng:
            drone.current_location = Point(float(lng), float(lat), srid=4326)

        drone.battery_level = request.data.get('battery_level', drone.battery_level)
        drone.telemetry_data = request.data.get('telemetry', drone.telemetry_data)
        drone.save()

        # Auto-detect arrival at incident
        if drone.status == 'EN_ROUTE' and drone.current_incident:
            distance = drone.current_location.distance(drone.current_incident.location_coordinates)
            if distance < 0.001:  # ~100m in degrees
                drone.status = 'ON_SCENE'
                drone.save()
                drone.current_incident.status = 'ON_SCENE'
                drone.current_incident.save()

        return Response({'status': 'updated'})

    @action(detail=True, methods=['post'])
    def command(self, request, pk=None):
        """Send a command to the drone (return_home, hover, etc.)."""
        drone = self.get_object()
        command = request.data.get('command')

        if command == 'return_home':
            drone.status = 'RETURNING'
            drone.destination_location = drone.home_location
            drone.current_incident = None
            drone.save()
        elif command == 'hover':
            drone.destination_location = None
            drone.save()

        return Response({'status': f'command {command} sent', 'drone': DroneSerializer(drone).data})


# ═══════════════════════════════════════════════════════
#  SOS Endpoint
# ═══════════════════════════════════════════════════════

@api_view(['POST'])
@permission_classes([AllowAny])
def trigger_sos(request):
    """Public SOS endpoint — creates an incident and auto-dispatches if critical."""
    serializer = SOSRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data

    point = Point(data['longitude'], data['latitude'], srid=4326)

    # AI classification from audio (if provided)
    ai_result = {}
    if data.get('audio_data'):
        ai_result = classify_emergency(data['audio_data'])

    # Link reporter profile if user is authenticated
    reporter = request.user if request.user.is_authenticated else None
    reporter_profile = getattr(reporter.UserProfile, 'profile', None) if reporter else None

    incident = Incident.objects.create(
        title=data.get('title', ai_result.get('title', 'Emergency SOS')),
        description=data.get('description', ai_result.get('transcription', 'Emergency SOS triggered')),
        location_coordinates=point,
        severity=ai_result.get('severity', 'HIGH'),
        status='REPORTED',
        incident_type=data.get('incident_type', ai_result.get('type', 'OTHER')),
        reported_medium=data.get('reported_medium', 'SOS_BUTTON'),
        ai_classification=ai_result,
        reporter=reporter,
        reporter_profile=reporter_profile,
    )

    # Auto-dispatch for critical incidents
    if incident.severity in ['HIGH', 'CRITICAL']:
        auto_dispatch_drone.delay(incident.id)

    # Notify nearby responders
    notify_nearby_responders(incident)

    return Response({
        'incident_id': str(incident.id),
        'status': 'REPORTED',
        'severity': incident.severity,
        'incident_type': incident.incident_type,
        'help_dispatched': incident.severity in ['HIGH', 'CRITICAL'],
    }, status=status.HTTP_201_CREATED)


def notify_nearby_responders(incident):
    """Find and notify verified responders within 10km of the incident."""
    nearby = Responder.objects.filter(
        is_verified=True,
        is_available=True,
        current_location__distance_lte=(incident.location_coordinates, 10000)
    )

    for responder in nearby:
        # TODO: Send push notification / WebSocket alert to each responder
        pass


# ═══════════════════════════════════════════════════════
#  Suspect
# ═══════════════════════════════════════════════════════

class SuspectViewSet(viewsets.ModelViewSet):
    queryset = Suspect.objects.all()
    serializer_class = SuspectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Suspect.objects.all()

        risk = self.request.query_params.get('risk_level')
        if risk:
            queryset = queryset.filter(risk_level=risk)

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(known_aliases__icontains=search)
            )

        return queryset

    @action(detail=False, methods=['post'])
    def identify(self, request):
        """Upload an image for facial recognition matching."""
        from .ai_modules.face_matching import match_face

        image_data = request.data.get('image')
        if not image_data:
            return Response({'error': 'No image provided'}, status=400)

        matches = match_face(image_data)
        return Response({'matches': matches})


# ═══════════════════════════════════════════════════════
#  Evidence & Responder
# ═══════════════════════════════════════════════════════

class EvidenceViewSet(viewsets.ModelViewSet):
    queryset = Evidence.objects.all()
    serializer_class = EvidenceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Evidence.objects.all()

        incident_id = self.request.query_params.get('incident')
        if incident_id:
            queryset = queryset.filter(incident_id=incident_id)

        file_type = self.request.query_params.get('file_type')
        if file_type:
            queryset = queryset.filter(file_type=file_type)

        return queryset


class ResponderViewSet(viewsets.ModelViewSet):
    queryset = Responder.objects.all()
    serializer_class = ResponderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Responder.objects.select_related('user').all()

        available = self.request.query_params.get('available')
        if available is not None:
            queryset = queryset.filter(is_available=available.lower() == 'true')

        verified = self.request.query_params.get('verified')
        if verified is not None:
            queryset = queryset.filter(is_verified=verified.lower() == 'true')

        return queryset