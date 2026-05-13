import urllib.request
import re

GENRES = [
    "trap",
    "hip-hop",
    "lo-fi",
    "drill", # Mixkit might not have this, we check
    "electronic"
]

print("🔍 Searching for Mixkit MP3 URLs...")

found_beats = {}

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}

for genre in GENRES:
    url = f"https://mixkit.co/free-stock-music/{genre}/"
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('utf-8')
            # Regex to find mixkit asset urls
            # Pattern: https://assets.mixkit.co/music/preview/mixkit-title-123.mp3
            links = re.findall(r'https://assets\.mixkit\.co/music/preview/mixkit-[\w-]+-\d+\.mp3', html)
            links = list(set(links)) # Deduplicate
            
            if links:
                print(f"✅ Found {len(links)} beats for {genre}")
                found_beats[genre] = links[:5] # Take top 5
            else:
                print(f"⚠️ No beats found for {genre}")
                
    except Exception as e:
        print(f"❌ Error fetching {genre}: {e}")

# Print result to reuse
print("\n--- RESULTS ---")
for genre, links in found_beats.items():
    print(f"\n{genre.upper()}:")
    for link in links:
        print(f'    "{link}",')
