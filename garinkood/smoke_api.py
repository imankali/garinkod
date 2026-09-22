"""Manual API smoke script — run directly:

    python smoke_api.py    (dev server on 127.0.0.1:8000)
    SMOKE_USERNAME=... SMOKE_PASSWORD=... python smoke_api.py

Not part of `manage.py test` (name doesn't match the test_*.py discovery
pattern) and credentials come from the environment, not the repo.
"""

import os

import requests

BASE_URL = "http://127.0.0.1:8000/api"

USERNAME = os.environ.get("SMOKE_USERNAME", "")
PASSWORD = os.environ.get("SMOKE_PASSWORD", "")
print("=" * 50)
print("🧪 تست API احراز هویت")
print("=" * 50)

# تست ۱: Login
print("\n🔐 تست Login...")
try:
    response = requests.post(
        f"{BASE_URL}/auth/login/",            json={"username": USERNAME, "password": PASSWORD},
        headers={"Content-Type": "application/json"}
    )
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")

    if response.status_code == 200:
        data = response.json()
        print(f"✅ موفق! Token: {data.get('token', 'N/A')}")
    else:
        print(f"❌ خطا: {response.json()}")
except Exception as e:
    print(f"❌ خطای اتصال: {e}")

# تست ۲: Register
print("\n📝 تست Register...")
try:
    response = requests.post(
        f"{BASE_URL}/auth/register/",
        json={
            "username": "testuser123",
            "email": "test123@example.com",
            "password": "Test123456",
            "password2": "Test123456"
        },
        headers={"Content-Type": "application/json"}
    )
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")

    if response.status_code in [200, 201]:
        data = response.json()
        print(f"✅ موفق! Token: {data.get('token', 'N/A')}")
    else:
        print(f"❌ خطا: {response.json()}")
except Exception as e:
    print(f"❌ خطای اتصال: {e}")

print("\n" + "=" * 50)