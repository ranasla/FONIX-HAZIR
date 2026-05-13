import os
import urllib.request
import re
import json

# Configuration
GENRE_URLS = {
    "Trap": "https://mixkit.co/free-stock-music/trap/",
    "Hip-Hop": "https://mixkit.co/free-stock-music/hip-hop/",
    "Lo-fi": "https://mixkit.co/free-stock-music/lo-fi/",
    "Electronic": "https://mixkit.co/free-stock-music/electronic/",
    "Drill": "https://mixkit.co/free-stock-music/tag/drill/", # Guessing tag url
}

DOWNLOAD_DIR = "static/beats"
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}

beat_db_data = []

print("🎵 Starting Beat Scraper & Downloader...")

for genre, url in GENRE_URLS.items():
    print(f"\n📂 Scraping {genre} from {url}...")
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('utf-8')
            
            # Find all mp3 links
            # Matches: https://assets.mixkit.co/music/preview/mixkit-title-123.mp3
            # OR simple numeric ones if they exist
            links = re.findall(r'https://assets\.mixkit\.co/[^"\']+\.mp3', html)
            links = list(set(links)) # Deduplicate
            
            if not links:
                print(f"  ⚠️ No links found for {genre} (Page might use dynamic loading completely)")
                continue

            print(f"  ✅ Found {len(links)} beats. Downloading top 5...")
            
            count = 0
            for link in links:
                if count >= 5: break
                
                # Extract usable filename
                # url: .../mixkit-driving-ambition-32.mp3 -> driving-ambition-32.mp3
                filename = link.split("/")[-1]
                if not filename.endswith(".mp3"): filename += ".mp3"
                
                # Create a nice title from filename
                # mixkit-driving-ambition-32.mp3 -> Driving Ambition
                clean_name = filename.replace("mixkit-", "").replace(".mp3", "")
                # Remove trailing numbers if separated by hyphen
                clean_name = re.sub(r'-\d+$', '', clean_name)
                title = clean_name.replace("-", " ").title()
                
                filepath = os.path.join(DOWNLOAD_DIR, filename)
                
                # Check if exists
                if not os.path.exists(filepath):
                    try:
                        print(f"    ⬇️ Downloading: {title}...")
                        req_dl = urllib.request.Request(link, headers=HEADERS)
                        with urllib.request.urlopen(req_dl) as resp_dl:
                            with open(filepath, 'wb') as f:
                                f.write(resp_dl.read())
                        print(f"      ✅ Saved to {filepath}")
                    except Exception as e:
                        print(f"      ❌ Download failed: {e}")
                        continue
                else:
                    print(f"    ⏭️ {title} already exists.")
                
                # Add to DB data
                beat_entry = {
                    "name": title,
                    "artist": "Mixkit",
                    "genre": genre,
                    "bpm": 120, # Placeholder
                    "duration": "2:30", # Placeholder
                    "cover_color": "#ff146a", # Placeholder
                    "url": f"/static/beats/{filename}"
                }
                beat_db_data.append(beat_entry)
                count += 1
                
    except Exception as e:
        print(f"  ❌ Failed to process {genre}: {e}")

# Save the data to a file so we can read it into app.py
with open("extracted_beats.json", "w", encoding="utf-8") as f:
    json.dump(beat_db_data, f, indent=4)

print("\n✨ Done! Data saved to extracted_beats.json")
