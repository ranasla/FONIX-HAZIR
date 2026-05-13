import requests

# Test register
print("=== Kayit Testi ===")
r = requests.post('http://localhost:5000/api/auth/register', json={
    'username': 'testuser123',
    'email': 'test123@test.com',
    'password': 'test123456',
    'full_name': 'Test User'
})
print(f"Status: {r.status_code}")
print(f"Response: {r.json()}")

# Test login
print("\n=== Giris Testi ===")
r = requests.post('http://localhost:5000/api/auth/login', json={
    'username_or_email': 'testuser123',
    'password': 'test123456'
})
print(f"Status: {r.status_code}")
print(f"Response: {r.json()}")
