import os
import re
import mimetypes
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.http import FileResponse, HttpResponse, Http404, StreamingHttpResponse
from rest_framework.authtoken.models import Token
from rest_framework.authentication import TokenAuthentication
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status as http_status


def serve_media(request, path):
    """Serve media files with HTTP Range support so <video> works in Chrome."""
    # Sanitize path to prevent directory traversal
    path = os.path.normpath(path)
    if path.startswith('..') or os.path.isabs(path):
        raise Http404
    full_path = os.path.join(settings.MEDIA_ROOT, path)
    if not os.path.isfile(full_path):
        raise Http404
    # Ensure the resolved path is actually under MEDIA_ROOT
    if not os.path.realpath(full_path).startswith(os.path.realpath(str(settings.MEDIA_ROOT))):
        raise Http404

    file_size = os.path.getsize(full_path)
    content_type, _ = mimetypes.guess_type(full_path)
    content_type = content_type or 'application/octet-stream'

    range_header = request.META.get('HTTP_RANGE', '')
    if range_header:
        # Parse Range: bytes=start-end
        m = re.match(r'bytes=(\d+)-(\d*)', range_header)
        if m:
            start = int(m.group(1))
            end = int(m.group(2)) if m.group(2) else file_size - 1
            end = min(end, file_size - 1)
            length = end - start + 1

            f = open(full_path, 'rb')
            f.seek(start)
            resp = HttpResponse(f.read(length), content_type=content_type, status=206)
            resp['Content-Length'] = str(length)
            resp['Content-Range'] = f'bytes {start}-{end}/{file_size}'
            resp['Accept-Ranges'] = 'bytes'
            return resp

    # No Range header — serve full file
    resp = FileResponse(open(full_path, 'rb'), content_type=content_type)
    resp['Content-Length'] = str(file_size)
    resp['Accept-Ranges'] = 'bytes'
    return resp


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def login_view(request):
    """Authenticate with username or email + password. Returns auth token."""
    identifier = request.data.get('username', '').strip()
    password = request.data.get('password', '')

    if not identifier or not password:
        return Response(
            {'non_field_errors': ['Username/email and password are required.']},
            status=http_status.HTTP_400_BAD_REQUEST,
        )

    # Try to resolve email to username
    user = None
    if '@' in identifier:
        try:
            user_obj = User.objects.get(email__iexact=identifier)
            user = authenticate(request, username=user_obj.username, password=password)
        except User.DoesNotExist:
            pass
    else:
        user = authenticate(request, username=identifier, password=password)

    if user is None:
        return Response(
            {'non_field_errors': ['Invalid credentials. Please check your username/email and password.']},
            status=http_status.HTTP_400_BAD_REQUEST,
        )

    token, _ = Token.objects.get_or_create(user=user)
    return Response({
        'token': token.key,
        'user_id': user.pk,
        'username': user.username,
    })


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """Delete the user's auth token (logout)."""
    request.user.auth_token.delete()
    return Response({'status': 'logged out'})

@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def register_view(request):
    """Register a new user and return an auth token."""
    from django.contrib.auth.models import User
    from rest_framework.authtoken.models import Token
    from rest_framework import status

    username = request.data.get('username')
    password = request.data.get('password')
    email = request.data.get('email', '')
    first_name = request.data.get('first_name', '')
    last_name = request.data.get('last_name', '')

    if not username or not password:
        return Response({'error': 'username and password required'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username__iexact=username).exists():
        return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)

    if email and User.objects.filter(email__iexact=email).exists():
        return Response({'error': 'Email already registered'}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(
        username=username, password=password, email=email,
        first_name=first_name, last_name=last_name,
    )
    token, _ = Token.objects.get_or_create(user=user)

    return Response({
        'token': token.key,
        'user_id': user.pk,
        'username': user.username,
    }, status=status.HTTP_201_CREATED)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('emergency_app.urls')),

    # Auth endpoints
    path('api/auth/token/', login_view, name='api_token_auth'),  # POST username/email & password → token
    path('api/auth/register/', register_view, name='api_register'),
    path('api/auth/logout/', logout_view, name='api_logout'),
]

# Always use our Range-aware media server (needed for <video> in Chrome)
urlpatterns += [path('media/<path:path>', serve_media)]