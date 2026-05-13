import urllib.request
import re

url = "https://mixkit.co/free-stock-music/trap/"
headers = {'User-Agent': 'Mozilla/5.0'}

print(f"Fetching {url}...")
try:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
        
        # Look for JSON data
        # Common patterns: window.__NUXT__, JSON.parse, <script id="__NEXT_DATA__">
        
        matches = re.findall(r'window\.__NUXT__=(.*?);', html)
        if matches:
            print("✅ Found Nuxt data!")
            # It's usually a JS object literal, not strict JSON, but we can try to extract URLs
            # content = matches[0]
            # Look for .mp3 URLs inside this blob
            mp3s = re.findall(r'https:[^"\']+\.mp3', matches[0])
            print(f"Found {len(mp3s)} MP3s in Nuxt data:")
            for mp3 in list(set(mp3s))[:10]:
                print(mp3)
        else:
            print("❌ No Nuxt data found.")
            
            # Try searching for ANY mp3 link in the whole HTML
            all_mp3s = re.findall(r'https?://[^"\s]+\.mp3', html)
            if all_mp3s:
                print(f"Found {len(all_mp3s)} MP3s in HTML body:")
                for mp3 in list(set(all_mp3s))[:5]:
                    print(mp3)
            else:
                 print("❌ No MP3s found in HTML body.")

except Exception as e:
    print(f"❌ Error: {e}")
