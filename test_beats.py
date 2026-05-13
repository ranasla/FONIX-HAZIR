import requests
import time

# API'nin ayağa kalkmasını bekle
time.sleep(1)

try:
    # Beat dosyasını test et
    url = "http://127.0.0.1:5000/static/beats/102.mp3"
    r = requests.get(url, timeout=5)
    print(f"Status: {r.status_code}")
    print(f"Size: {len(r.content)/1024:.1f} KB")
    print(f"Content-Type: {r.headers.get('Content-Type', 'Unknown')}")
    
    if r.status_code == 200:
        print("SUCCESS: Beat dosyası erişilebilir!")
    else:
        print(f"HATA: {r.text[:200]}")
        
except Exception as e:
    print(f"HATA: {e}")

# API test
try:
    r2 = requests.get("http://127.0.0.1:5000/api/beats", timeout=5)
    print(f"\nAPI Status: {r2.status_code}")
    if r2.ok:
        beats = r2.json().get('beats', [])
        print(f"Toplam {len(beats)} beat")
        if beats:
            print(f"Ilk beat URL: {beats[0].get('url')}")
            print(f"Ilk beat file_url: {beats[0].get('file_url')}")
except Exception as e:
    print(f"API HATA: {e}")
