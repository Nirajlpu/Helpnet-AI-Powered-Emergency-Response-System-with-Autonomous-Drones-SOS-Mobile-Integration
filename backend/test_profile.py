import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from rest_framework.authtoken.models import Token
from django.contrib.auth.models import User
from emergency_app.models import UserProfile
import requests

user = User.objects.filter(username='niraj').first()
if user:
    token = Token.objects.filter(user=user).first()
    if token:
        print("Using token:", token.key)
        res = requests.get('http://localhost:8000/api/profiles/me/', headers={'Authorization': f'Token {token.key}'})
        print("GET /api/profiles/me/ response payload:")
        print(res.json())
        print("Avatar URL in payload is:")
        print(res.json().get('avatar'))
    else:
        print("No token for niraj")
else:
    print("User niraj not found")
