from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.authtoken.views import obtain_auth_token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """Delete the user's auth token (logout)."""
    request.user.auth_token.delete()
    return Response({'status': 'logged out'})

@api_view(['POST'])
def register_view(request):
    """Register a new user and return an auth token."""
    from django.contrib.auth.models import User
    from rest_framework.authtoken.models import Token
    from rest_framework import status

    username = request.data.get('username')
    password = request.data.get('password')
    email = request.data.get('email', '')

    if not username or not password:
        return Response({'error': 'username and password required'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(username=username, password=password, email=email)
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
    path('api/auth/token/', obtain_auth_token, name='api_token_auth'),  # POST username & password → token
    path('api/auth/register/', register_view, name='api_register'),
    path('api/auth/logout/', logout_view, name='api_logout'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)