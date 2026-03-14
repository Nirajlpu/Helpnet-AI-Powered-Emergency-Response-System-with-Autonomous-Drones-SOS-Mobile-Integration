from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes, authentication_classes
from rest_framework.authentication import TokenAuthentication
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.authtoken.models import Token as AuthToken
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied


class BearerOrTokenAuthentication(TokenAuthentication):
    """Accept both 'Token xxx' and 'Bearer xxx' Authorization headers."""
    keyword = 'Token'  # default

    def authenticate(self, request):
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        if len(auth) == 2 and auth[0].lower() in ('token', 'bearer'):
            try:
                token = AuthToken.objects.select_related('user').get(key=auth[1])
                return (token.user, token)
            except AuthToken.DoesNotExist:
                raise AuthenticationFailed('Invalid token.')
        return None
import uuid
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
import requests
import threading
import glob
import shutil

# Locate ffmpeg binary — check PATH, then common install locations
def _find_ffmpeg():
    path = shutil.which('ffmpeg')
    if path:
        return path
    for candidate in ('/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg'):
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
    return None

_FFMPEG_BIN = _find_ffmpeg()
if _FFMPEG_BIN:
    print(f"[video] ffmpeg found at: {_FFMPEG_BIN}")
else:
    print("[video] WARNING: ffmpeg not found — video recordings will use OpenCV mp4v fallback (no audio, limited browser support)")

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


def _is_valid_jpeg(filepath, min_size=500):
    """Check if a file is a valid, complete JPEG (has FFD8 header and FFD9 trailer)."""
    try:
        size = os.path.getsize(filepath)
        if size < min_size:
            return False
        with open(filepath, 'rb') as f:
            header = f.read(2)
            if header != b'\xff\xd8':
                return False
            f.seek(-2, 2)
            trailer = f.read(2)
            if trailer != b'\xff\xd9':
                return False
        return True
    except (OSError, IOError):
        return False


def _assemble_mp4(frame_dir, video_full_path, fps=5):
    """Assemble JPEG frames (and optional PCM audio) into an MP4 video. Returns (frame_count, duration) or None."""
    import subprocess
    frame_files = sorted(glob.glob(os.path.join(frame_dir, 'frame_*.jpg')))
    if not frame_files:
        return None

    # Validate each frame — remove corrupt / partially-written JPEGs
    valid_files = []
    removed = 0
    for fp in frame_files:
        if _is_valid_jpeg(fp):
            valid_files.append(fp)
        else:
            print(f"[_assemble_mp4] Removing corrupt frame: {fp}")
            try:
                os.remove(fp)
            except OSError:
                pass
            removed += 1
    if removed:
        print(f"[_assemble_mp4] Removed {removed} corrupt frame(s), {len(valid_files)} valid frames remain")

    if not valid_files:
        return None

    # Always re-number frames sequentially 0..N-1 so ffmpeg sequence pattern works
    for idx, old_path in enumerate(valid_files):
        new_path = os.path.join(frame_dir, f"frame_{idx:06d}.jpg")
        if old_path != new_path:
            os.rename(old_path, new_path)
    frame_files = [os.path.join(frame_dir, f"frame_{i:06d}.jpg") for i in range(len(valid_files))]

    os.makedirs(os.path.dirname(video_full_path), exist_ok=True)
    num_frames = len(frame_files)
    assembled = False

    ffmpeg = _FFMPEG_BIN  # resolved at module load

    # Check for audio file
    audio_path = os.path.join(frame_dir, 'audio.pcm')
    has_audio = os.path.exists(audio_path) and os.path.getsize(audio_path) > 0

    # Try ffmpeg first for H.264 + faststart (proper duration & browser playback)
    if ffmpeg:
        try:
            # Use printf-style sequence pattern (more reliable than glob across ffmpeg versions)
            frame_pattern = os.path.join(frame_dir, 'frame_%06d.jpg')
            cmd = [
                ffmpeg, '-y', '-framerate', str(fps),
                '-i', frame_pattern,
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
            # Validate output — must be at least 1KB
            if os.path.exists(video_full_path) and os.path.getsize(video_full_path) >= 1024:
                assembled = True
                print(f"[_assemble_mp4] Success: {video_full_path} ({os.path.getsize(video_full_path)} bytes, audio={'yes' if has_audio else 'no'})")
            else:
                # ffmpeg ran but produced a suspiciously small file — remove it
                if os.path.exists(video_full_path):
                    os.remove(video_full_path)
                print(f"[_assemble_mp4] ffmpeg output too small, falling back")
        except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired, OSError) as e:
            print(f"[_assemble_mp4] ffmpeg sequence failed: {e}")
            if hasattr(e, 'stderr') and e.stderr:
                print(f"[_assemble_mp4] ffmpeg stderr: {e.stderr[-500:]}")

    if not assembled and ffmpeg:
        # Fallback: use ffmpeg concat demuxer
        try:
            concat_list = os.path.join(frame_dir, '_concat.txt')
            with open(concat_list, 'w') as f:
                for fp in frame_files:
                    f.write(f"file '{fp}'\n")
                    f.write(f"duration {1.0 / fps}\n")
            cmd = [
                ffmpeg, '-y', '-f', 'concat', '-safe', '0', '-i', concat_list,
            ]
            if has_audio:
                cmd += ['-f', 's16le', '-ar', '16000', '-ac', '1', '-i', audio_path]
                cmd += ['-map', '0:v', '-map', '1:a']
            cmd += [
                '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                '-crf', '23', '-preset', 'fast',
                '-vsync', 'cfr', '-r', str(fps),
            ]
            if has_audio:
                cmd += ['-c:a', 'aac', '-b:a', '64k', '-shortest']
            cmd += ['-movflags', '+faststart', video_full_path]
            print(f"[_assemble_mp4] ffmpeg concat fallback cmd: {' '.join(cmd)}")
            result = subprocess.run(cmd, check=True, capture_output=True, timeout=120, text=True)
            if os.path.exists(video_full_path) and os.path.getsize(video_full_path) >= 1024:
                assembled = True
                print(f"[_assemble_mp4] Concat fallback success: {video_full_path} ({os.path.getsize(video_full_path)} bytes)")
            else:
                if os.path.exists(video_full_path):
                    os.remove(video_full_path)
            try:
                os.remove(concat_list)
            except OSError:
                pass
        except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired, OSError) as e:
            print(f"[_assemble_mp4] ffmpeg concat fallback failed: {e}")
            try:
                os.remove(os.path.join(frame_dir, '_concat.txt'))
            except OSError:
                pass

    if not assembled:
        # Last resort: OpenCV writes mp4v, then re-encode to H.264 with ffmpeg
        import cv2
        first = cv2.imread(frame_files[0])
        if first is None:
            return None
        h, w = first.shape[:2]
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        tmp_path = video_full_path + '.tmp.mp4'
        writer = cv2.VideoWriter(tmp_path, fourcc, fps, (w, h))
        if not writer.isOpened():
            return None
        for fp in frame_files:
            img = cv2.imread(fp)
            if img is not None:
                if img.shape[:2] != (h, w):
                    img = cv2.resize(img, (w, h))
                writer.write(img)
        writer.release()

        # Re-encode mp4v → H.264 for browser compatibility (+ mux audio if available)
        if ffmpeg:
            try:
                cmd = [ffmpeg, '-y', '-i', tmp_path]
                if has_audio:
                    cmd += ['-f', 's16le', '-ar', '16000', '-ac', '1', '-i', audio_path]
                    cmd += ['-map', '0:v', '-map', '1:a']
                cmd += [
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                    '-crf', '23', '-preset', 'fast',
                ]
                if has_audio:
                    cmd += ['-c:a', 'aac', '-b:a', '64k', '-shortest']
                cmd += ['-movflags', '+faststart', video_full_path]
                print(f"[_assemble_mp4] Re-encoding OpenCV output to H.264{' + AAC audio' if has_audio else ''}")
                subprocess.run(cmd, check=True, capture_output=True, timeout=120, text=True)
                if os.path.exists(video_full_path) and os.path.getsize(video_full_path) >= 1024:
                    assembled = True
                    print(f"[_assemble_mp4] Re-encode success: {video_full_path} ({os.path.getsize(video_full_path)} bytes)")
                else:
                    # Re-encode failed, keep the mp4v version as-is
                    os.rename(tmp_path, video_full_path)
                    print(f"[_assemble_mp4] Re-encode produced bad output, keeping mp4v fallback")
            except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired, OSError) as e:
                # ffmpeg failed — keep the mp4v version
                print(f"[_assemble_mp4] Re-encode failed ({e}), keeping mp4v fallback")
                if hasattr(e, 'stderr') and e.stderr:
                    print(f"[_assemble_mp4] Re-encode stderr: {e.stderr[-500:]}")
                if os.path.exists(tmp_path):
                    os.rename(tmp_path, video_full_path)
            finally:
                if os.path.exists(tmp_path):
                    try:
                        os.remove(tmp_path)
                    except OSError:
                        pass
        else:
            # No ffmpeg at all — keep the mp4v version
            print(f"[_assemble_mp4] No ffmpeg available, keeping mp4v fallback")
            os.rename(tmp_path, video_full_path)

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
        return Response(FamilyRelationSerializer(relations, many=True, context={'request': request}).data)

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

        return Response(FamilyRelationSerializer(family_relation, context={'request': request}).data, status=201)

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
        """Get the currently logged-in user's profile, auto-creating if needed."""
        profile, created = UserProfile.objects.get_or_create(
            user=request.user,
            defaults={
                'user_id_code': _generate_user_id_code(),
                'first_name': request.user.first_name or request.user.username,
                'last_name': request.user.last_name or '',
                'email': request.user.email or f'{request.user.username}@helpnet.local',
            }
        )
        return Response(UserProfileSerializer(profile, context={'request': request}).data)


def _generate_user_id_code():
    import random
    date_str = timezone.now().strftime('%Y%m%d')
    for _ in range(100):
        code = f'HN-{date_str}-{random.randint(1, 999):03d}'
        if not UserProfile.objects.filter(user_id_code=code).exists():
            return code
    return f'HN-{date_str}-{uuid.uuid4().hex[:6]}'


# ═══════════════════════════════════════════════════════
#  Incident
# ═══════════════════════════════════════════════════════

class IncidentViewSet(viewsets.ModelViewSet):
    queryset = Incident.objects.all()
    serializer_class = IncidentSerializer
    permission_classes = [IsAuthenticated]

    def _filter_by_role(self, queryset):
        """Apply role-based access control filtering to a queryset."""
        user = self.request.user
        profile = getattr(user, 'profile', None)
        if not profile:
            return queryset.none()

        role = profile.role

        if role in ('ADMIN', 'CENTRAL'):
            # Full access to all incidents
            pass
        elif role == 'STATE':
            # Only incidents in their state
            if profile.state:
                queryset = queryset.filter(state__iexact=profile.state)
            else:
                queryset = queryset.none()
        elif role == 'DISTRICT':
            # Only incidents in their district
            if profile.district:
                queryset = queryset.filter(district__iexact=profile.district)
            else:
                queryset = queryset.none()
        elif role == 'POLICE_STATION':
            # Only incidents in their pincode area
            if profile.pincode:
                queryset = queryset.filter(pincode=profile.pincode)
            else:
                queryset = queryset.none()
        elif role in ('VOLUNTEER', 'RESPONDER'):
            # Assigned incidents + own reported + incidents of people who added me as family
            family_profile_ids = list(
                FamilyRelation.objects.filter(to_user=profile)
                .values_list('from_user_id', flat=True)
            )
            queryset = queryset.filter(
                Q(reporter=user)
                | Q(reporter_profile=profile)
                | Q(reporter_profile_id__in=family_profile_ids)
                | Q(responders_assigned=user)
            ).distinct()
        else:
            # CIVILIAN — own incidents + incidents of people who added me as family
            family_profile_ids = list(
                FamilyRelation.objects.filter(to_user=profile)
                .values_list('from_user_id', flat=True)
            )
            queryset = queryset.filter(
                Q(reporter=user)
                | Q(reporter_profile=profile)
                | Q(reporter_profile_id__in=family_profile_ids)
            ).distinct()

        return queryset

    def get_queryset(self):
        
        queryset = Incident.objects.select_related(
            'reporter', 'reporter_profile', 'which_authority_took_action'
        ).prefetch_related('assigned_drones', 'responders_assigned', 'family_members_notified')

        # ── Role-based access control ──
        queryset = self._filter_by_role(queryset)

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
        """Auto-set reporter, reporter_profile, and pincode on creation."""
        user = self.request.user
        profile, _ = UserProfile.objects.get_or_create(
            user=user,
            defaults={
                'user_id_code': _generate_user_id_code(),
                'first_name': user.first_name or user.username,
                'last_name': user.last_name or '',
                'email': user.email or f'{user.username}@helpnet.local',
            }
        )
        instance = serializer.save(
            reporter=user,
            reporter_profile=profile,
        )
        # Derive pincode and address from incident coordinates
        if instance.location_coordinates:
            update_fields = []
            if not instance.pincode:
                pincode = get_pincode_from_coordinates(
                    instance.location_coordinates.y,
                    instance.location_coordinates.x,
                )
                if pincode:
                    instance.pincode = pincode
                    update_fields.append('pincode')
            if not instance.address:
                address = get_address_from_coordinates(
                    instance.location_coordinates.y,
                    instance.location_coordinates.x,
                )
                if address:
                    instance.address = address
                    update_fields.append('address')
            if update_fields:
                instance.save(update_fields=update_fields)

    def perform_update(self, serializer):
        # Block civilians from performing authority actions
        if 'action_taken_by_authority' in serializer.validated_data:
            profile = getattr(self.request.user, 'profile', None)
            if profile and profile.role == 'CIVILIAN':
                raise PermissionDenied('Civilians cannot perform authority actions.')

        instance = serializer.save()
        # Auto-set which_authority_took_action to the current user's profile
        if 'action_taken_by_authority' in serializer.validated_data:
            profile = getattr(self.request.user, 'profile', None)
            if profile and instance.which_authority_took_action != profile:
                instance.which_authority_took_action = profile
                instance.save(update_fields=['which_authority_took_action'])

            # Append timeline entry for the authority action
            remark = self.request.data.get('authority_remark', '')
            action_label = dict(Incident.ACTION_TAKEN_STATUS_CHOICES).get(
                instance.action_taken_by_authority, instance.action_taken_by_authority
            )
            authority_name = f'{profile.first_name} {profile.last_name}'.strip() if profile else self.request.user.username
            timeline = instance.timeLine or []
            entry = {
                'time': timezone.now().isoformat(),
                'label': f'Authority Action: {action_label}',
                'detail': f'{authority_name} set status to {action_label}' + (f' — "{remark}"' if remark else ''),
                'icon': '⚖️',
                'color': '#1976d2',
            }
            timeline.append(entry)
            instance.timeLine = timeline
            instance.save(update_fields=['timeLine'])

            # Auto-resolve when action is COMPLETED or FALSE_ALARM
            if instance.action_taken_by_authority in ('COMPLETED', 'FALSE_ALARM') and instance.status != 'RESOLVED':
                reason = 'Completed' if instance.action_taken_by_authority == 'COMPLETED' else 'False Alarm'
                instance.status = 'RESOLVED'
                instance.resolved_at = timezone.now()
                instance.save(update_fields=['status', 'resolved_at'])
                # Add resolved timeline entry
                instance.timeLine.append({
                    'time': timezone.now().isoformat(),
                    'label': 'Incident Resolved',
                    'detail': f'Auto-resolved after {authority_name} marked action as {reason}',
                    'icon': '✅',
                    'color': '#4caf50',
                })
                instance.save(update_fields=['timeLine'])

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

        # Brief pause so any in-flight frame write can finish flushing to disk
        time.sleep(0.3)

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
                # Skip temp, backup and intermediate files
                if '.tmp.' in fname or '_old_' in fname or fname.startswith('_'):
                    continue
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

        # Brief pause so any in-flight frame write can finish flushing to disk
        time.sleep(0.3)

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
                # Skip temp, backup and intermediate files
                if '.tmp.' in fname or '_old_' in fname or fname.startswith('_'):
                    continue
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

    @action(detail=False, methods=['get'])
    def analytics(self, request):
        """Comprehensive analytics data for the Analytics dashboard."""
        from django.db.models.functions import TruncDate, TruncMonth
        from collections import Counter

        incidents = self._filter_by_role(Incident.objects.all())

        # ── 1. Overview stats ──
        total = incidents.count()
        active = incidents.exclude(status='RESOLVED').count()
        resolved = incidents.filter(status='RESOLVED').count()
        avg_resolution_hours = None
        resolved_with_times = incidents.filter(resolved_at__isnull=False, created_at__isnull=False)
        if resolved_with_times.exists():
            from django.db.models import Avg, F, ExpressionWrapper, DurationField
            dur = resolved_with_times.annotate(
                res_time=ExpressionWrapper(F('resolved_at') - F('created_at'), output_field=DurationField())
            ).aggregate(avg=Avg('res_time'))['avg']
            if dur:
                avg_resolution_hours = round(dur.total_seconds() / 3600, 1)

        # ── 2. By severity ──
        by_severity = {}
        for code, label in Incident.SEVERITY_CHOICES:
            by_severity[code] = incidents.filter(severity=code).count()

        # ── 3. By incident type ──
        by_type = {}
        for code, label in Incident.INCIDENT_TYPE_CHOICES:
            c = incidents.filter(incident_type=code).count()
            if c > 0:
                by_type[code] = c

        # ── 4. By status ──
        by_status = {}
        for code, label in Incident.STATUS_CHOICES:
            by_status[code] = incidents.filter(status=code).count()

        # ── 5. By action taken ──
        by_action = {}
        for code, label in Incident.ACTION_TAKEN_STATUS_CHOICES:
            c = incidents.filter(action_taken_by_authority=code).count()
            if c > 0:
                by_action[code] = c

        # ── 6. By reported medium ──
        by_medium = {}
        for code, label in Incident.REPORTED_MEDIUM_CHOICES:
            c = incidents.filter(reported_medium=code).count()
            if c > 0:
                by_medium[code] = c

        # ── 7. Hotspot areas — incidents grouped by pincode ──
        hotspot_pincode = list(
            incidents.exclude(pincode='').values('pincode')
            .annotate(count=Count('id')).order_by('-count')[:15]
        )

        # ── 8. Hotspot by district ──
        hotspot_district = list(
            incidents.exclude(district='').values('district')
            .annotate(count=Count('id')).order_by('-count')[:15]
        )

        # ── 9. Hotspot by state ──
        hotspot_state = list(
            incidents.exclude(state='').values('state')
            .annotate(count=Count('id')).order_by('-count')[:10]
        )

        # ── 10. Top reporters ──
        top_reporters = list(
            incidents.filter(reporter_profile__isnull=False)
            .values('reporter_profile__first_name', 'reporter_profile__last_name',
                    'reporter_profile__user_id_code', 'reporter_profile__phone')
            .annotate(count=Count('id')).order_by('-count')[:10]
        )

        # ── 11. Volunteer / Responder participation ──
        # Who has been assigned as authority most often
        authority_participation = list(
            incidents.filter(which_authority_took_action__isnull=False)
            .values('which_authority_took_action__first_name',
                    'which_authority_took_action__last_name',
                    'which_authority_took_action__role',
                    'which_authority_took_action__user_id_code')
            .annotate(count=Count('id')).order_by('-count')[:10]
        )

        # Volunteer stats
        volunteer_profiles = UserProfile.objects.filter(
            Q(role='VOLUNTEER') | Q(is_volunteer=True)
        )
        volunteer_stats = {
            'total_volunteers': volunteer_profiles.count(),
            'verified_volunteers': volunteer_profiles.filter(is_verified=True).count(),
        }

        # Responder stats
        responder_count = Responder.objects.count()
        responder_available = Responder.objects.filter(is_available=True).count()
        top_responders = list(
            Responder.objects.order_by('-response_count')[:10]
            .values('user__first_name', 'user__last_name', 'response_count',
                    'rating', 'specializations', 'is_available')
        )

        # ── 12. Suspect data ──
        suspect_total = Suspect.objects.count()
        suspect_by_risk = {}
        for code in ['LOW', 'MEDIUM', 'HIGH']:
            suspect_by_risk[code] = Suspect.objects.filter(risk_level=code).count()

        # ── 13. Timeline — incidents per day (last 30 days) ──
        thirty_days_ago = timezone.now() - timezone.timedelta(days=30)
        daily_counts = list(
            incidents.filter(created_at__gte=thirty_days_ago)
            .annotate(date=TruncDate('created_at'))
            .values('date').annotate(count=Count('id')).order_by('date')
        )
        # Serialize dates
        for entry in daily_counts:
            entry['date'] = entry['date'].isoformat()

        # ── 14. Monthly trend (last 12 months) ──
        twelve_months_ago = timezone.now() - timezone.timedelta(days=365)
        monthly_counts = list(
            incidents.filter(created_at__gte=twelve_months_ago)
            .annotate(month=TruncMonth('created_at'))
            .values('month').annotate(count=Count('id')).order_by('month')
        )
        for entry in monthly_counts:
            entry['month'] = entry['month'].isoformat()

        # ── 15. Severity trend (daily, last 30 days) ──
        severity_trend = []
        for code, label in Incident.SEVERITY_CHOICES:
            entries = list(
                incidents.filter(created_at__gte=thirty_days_ago, severity=code)
                .annotate(date=TruncDate('created_at'))
                .values('date').annotate(count=Count('id')).order_by('date')
            )
            for e in entries:
                e['date'] = e['date'].isoformat()
            severity_trend.append({'severity': code, 'data': entries})

        # ── 16. Geo points for heatmap ──
        geo_points = list(
            incidents.exclude(location_coordinates__isnull=True)
            .values_list('location_coordinates', flat=True)[:500]
        )
        heatmap_points = []
        for pt in geo_points:
            if pt:
                heatmap_points.append({'lat': pt.y, 'lng': pt.x})

        # ── 17. User stats ──
        user_stats = {
            'total_users': UserProfile.objects.count(),
            'by_role': {},
        }
        for code, label in UserProfile.ROLE_CHOICES:
            c = UserProfile.objects.filter(role=code).count()
            if c > 0:
                user_stats['by_role'][code] = c

        return Response({
            'overview': {
                'total': total,
                'active': active,
                'resolved': resolved,
                'avg_resolution_hours': avg_resolution_hours,
            },
            'by_severity': by_severity,
            'by_type': by_type,
            'by_status': by_status,
            'by_action': by_action,
            'by_medium': by_medium,
            'hotspot_pincode': hotspot_pincode,
            'hotspot_district': hotspot_district,
            'hotspot_state': hotspot_state,
            'top_reporters': top_reporters,
            'authority_participation': authority_participation,
            'volunteer_stats': volunteer_stats,
            'responder_stats': {
                'total': responder_count,
                'available': responder_available,
                'top_responders': top_responders,
            },
            'suspect_stats': {
                'total': suspect_total,
                'by_risk': suspect_by_risk,
            },
            'daily_trend': daily_counts,
            'monthly_trend': monthly_counts,
            'severity_trend': severity_trend,
            'heatmap_points': heatmap_points,
            'user_stats': user_stats,
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
@authentication_classes([BearerOrTokenAuthentication])
@permission_classes([AllowAny])
def trigger_sos(request):
    """Public SOS endpoint — creates an incident and auto-dispatches if critical."""
    print(f"[trigger_sos] Auth header: {request.META.get('HTTP_AUTHORIZATION', 'NONE')}")
    print(f"[trigger_sos] User: {request.user}, authenticated: {request.user.is_authenticated}")
    serializer = SOSRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data

    point = Point(data['longitude'], data['latitude'], srid=4326)
    user=request.user if request.user.is_authenticated else None
    user.location_coordinates=point if user else None
    print(f"[trigger_sos] Received SOS from user: {user}, location: ({data['latitude']}, {data['longitude']})")

    # AI classification from audio (if provided)
    ai_result = {}
    if data.get('audio_data'):
        ai_result = classify_emergency(data['audio_data'])

    # Link reporter profile if user is authenticated
    reporter = request.user if request.user.is_authenticated else None
    reporter_profile = None
    if reporter:
        print(f"[trigger_sos] Authenticated reporter: {reporter.username}")
        reporter_profile, _ = UserProfile.objects.get_or_create(
            user=reporter,
            defaults={
                'user_id_code': _generate_user_id_code(),
                'first_name': reporter.first_name or reporter.username,
                'last_name': reporter.last_name or '',
                'email': reporter.email or f'{reporter.username}@helpnet.local',
            }
        )

    # Derive pincode and address from coordinates
    incident_pincode = get_pincode_from_coordinates(data['latitude'], data['longitude']) or ''
    incident_address = get_address_from_coordinates(data['latitude'], data['longitude'])

    incident = Incident.objects.create(
        title=data.get('title', ai_result.get('title', 'Emergency SOS')),
        description=data.get('description', ai_result.get('transcription', 'Emergency SOS triggered')),
        location_coordinates=point,
        pincode=incident_pincode,
        address=incident_address,
        severity=ai_result.get('severity', 'HIGH'),
        status='REPORTED',
        incident_type=data.get('incident_type', ai_result.get('type', 'OTHER')),
        reported_medium=data.get('reported_medium', 'SOS_BUTTON'),
        reporter=reporter,
        reporter_profile=reporter_profile,
        timeLine=[{
            "time": timezone.now().isoformat(),
            "label": "Incident Reported",
            "detail": f"{data.get('title', 'Emergency')} reported via HelpNet SOS",
            "icon": "📋",
            "color": "#ff9800",
        }]
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

import requests

def get_pincode_from_coordinates(lat, lon):
    url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&addressdetails=1"
    
    headers = {
        "User-Agent": "helpnet"
    }

    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        data = response.json()
        return data.get("address", {}).get("postcode")

    return None


def get_address_from_coordinates(lat, lon):
    """Reverse-geocode coordinates into a human-readable address string."""
    url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&addressdetails=1"
    headers = {"User-Agent": "helpnet"}
    try:
        resp = requests.get(url, headers=headers, timeout=5)
        if resp.status_code == 200:
            return resp.json().get("display_name", "")
    except Exception:
        pass
    return ""

def notify_nearby_responders(incident):
    """Find and notify verified responders within 10km of the incident."""
  
    incident_pincode = get_pincode_from_coordinates(incident.location_coordinates.y, incident.location_coordinates.x)

    nearby = UserProfile.objects.filter(
        Q(role='RESPONDER') | Q(role='VOLUNTEER')|Q(role='POLICE_STATION'),
        is_verified=True,
        pincode=incident_pincode if incident_pincode else None,


        # current_location__distance_lte=(incident.location_coordinates, 10000)
    )

    for responder in nearby:
        # TODO: Send push notification / WebSocket alert to each responder
        #  use this { time: new Date(base.getTime() + 60000), label: 'Alert Dispatched', detail: 'Emergency alert sent to nearest response unit', icon: '🚨', color: '#f44336' },
        incident.timeLine.append({
                "time": timezone.now().isoformat(),
                "label": "Alert Dispatched",
                "detail": f" Emergency alert sent to nearest response unit.{responder.user.first_name} {responder.user.last_name} dispatched to location {incident.location_coordinates}",
                "icon": "🚨",
                "color": "#f44336",
            })

        incident.save(update_fields=["timeLine"]) 
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