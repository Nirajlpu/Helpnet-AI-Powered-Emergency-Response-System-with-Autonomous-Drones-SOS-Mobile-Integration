import requests

# We log in as niraj
res = requests.post('http://localhost:8000/api/auth/token/', json={"username": "niraj", "password": "password"})
token = res.json().get('token')
print("Token:", token)

# Fetch profile
res = requests.get('http://localhost:8000/api/profiles/me/', headers={"Authorization": f"Token {token}"})
print("Profile:", res.json())
