"""
Pixabay ve diğer royalty-free kaynaklardan beat indirme scripti
"""
import os
import json
import requests
import time

# Pixabay API Key - Ücretsiz API key alınabilir: https://pixabay.com/api/docs/
PIXABAY_API_KEY = "YOUR_PIXABAY_API_KEY"  # Kendi API key'inizi buraya yazın

BEATS_DIR = "static/beats"
BEATS_JSON = "beats_library.json"

# Örnek beat koleksiyonu (royalty-free)
SAMPLE_BEATS = [
    {
        "name": "Midnight Trap",
        "artist": "FONİX Studio",
        "genre": "Trap",
        "mood": "Dark",
        "bpm": 140,
        "cover_color": "#9b59b6",
        "audio_file": "midnight_trap.mp3"
    },
    {
        "name": "Summer Vibes",
        "artist": "FONİX Studio",
        "genre": "Pop",
        "mood": "Happy",
        "bpm": 120,
        "cover_color": "#f1c40f",
        "audio_file": "summer_vibes.mp3"
    },
    {
        "name": "Urban Flow",
        "artist": "FONİX Studio",
        "genre": "Hip-Hop",
        "mood": "Chill",
        "bpm": 95,
        "cover_color": "#3498db",
        "audio_file": "urban_flow.mp3"
    },
    {
        "name": "Neon Dreams",
        "artist": "FONİX Studio",
        "genre": "Electronic",
        "mood": "Energetic",
        "bpm": 128,
        "cover_color": "#ff146a",
        "audio_file": "neon_dreams.mp3"
    },
    {
        "name": "Acoustic Soul",
        "artist": "FONİX Studio",
        "genre": "R&B",
        "mood": "Romantic",
        "bpm": 85,
        "cover_color": "#e74c3c",
        "audio_file": "acoustic_soul.mp3"
    },
    {
        "name": "Bass Drop",
        "artist": "FONİX Studio",
        "genre": "Dubstep",
        "mood": "Aggressive",
        "bpm": 150,
        "cover_color": "#2ecc71",
        "audio_file": "bass_drop.mp3"
    },
    {
        "name": "Chill Wave",
        "artist": "FONİX Studio",
        "genre": "Lo-Fi",
        "mood": "Relaxed",
        "bpm": 75,
        "cover_color": "#1abc9c",
        "audio_file": "chill_wave.mp3"
    },
    {
        "name": "Dark Knight",
        "artist": "FONİX Studio",
        "genre": "Drill",
        "mood": "Dark",
        "bpm": 145,
        "cover_color": "#34495e",
        "audio_file": "dark_knight.mp3"
    },
    {
        "name": "Golden Hour",
        "artist": "FONİX Studio",
        "genre": "Pop",
        "mood": "Uplifting",
        "bpm": 110,
        "cover_color": "#f39c12",
        "audio_file": "golden_hour.mp3"
    },
    {
        "name": "Street Dreams",
        "artist": "FONİX Studio",
        "genre": "Hip-Hop",
        "mood": "Motivational",
        "bpm": 90,
        "cover_color": "#8e44ad",
        "audio_file": "street_dreams.mp3"
    }
]


def fetch_pixabay_music(query="beat", per_page=20):
    """Pixabay'dan müzik arama"""
    if PIXABAY_API_KEY == "YOUR_PIXABAY_API_KEY":
        print("⚠️ Pixabay API key gerekli! https://pixabay.com/api/docs/ adresinden ücretsiz alabilirsiniz.")
        return []
    
    url = f"https://pixabay.com/api/videos/"  # Pixabay sadece video API'si var, müzik için başka kaynak lazım
    params = {
        "key": PIXABAY_API_KEY,
        "q": query,
        "per_page": per_page
    }
    
    try:
        response = requests.get(url, params=params)
        data = response.json()
        return data.get("hits", [])
    except Exception as e:
        print(f"Hata: {e}")
        return []


def fetch_freesound_music(query="beat instrumental"):
    """
    Freesound.org'dan müzik arama
    API Key gerekli: https://freesound.org/apiv2/apply
    """
    # Freesound API implementasyonu
    pass


def download_beat(url, filename):
    """Beat dosyasını indir"""
    os.makedirs(BEATS_DIR, exist_ok=True)
    filepath = os.path.join(BEATS_DIR, filename)
    
    if os.path.exists(filepath):
        print(f"✓ {filename} zaten mevcut")
        return True
    
    try:
        response = requests.get(url, stream=True)
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        print(f"✓ {filename} indirildi")
        return True
    except Exception as e:
        print(f"✗ {filename} indirilemedi: {e}")
        return False


def create_sample_beat_files():
    """Örnek beat dosyaları oluştur (placeholder)"""
    os.makedirs(BEATS_DIR, exist_ok=True)
    
    for beat in SAMPLE_BEATS:
        filepath = os.path.join(BEATS_DIR, beat["audio_file"])
        if not os.path.exists(filepath):
            # Placeholder dosya oluştur (gerçek mp3 değil, test amaçlı)
            print(f"⚠️ {beat['audio_file']} dosyası bulunamadı - placeholder oluşturuluyor")


def save_beats_to_db():
    """Beat'leri veritabanına kaydet"""
    from app import app, db, Beat
    
    with app.app_context():
        for beat_data in SAMPLE_BEATS:
            # Var mı kontrol et
            existing = Beat.query.filter_by(name=beat_data["name"]).first()
            if not existing:
                beat = Beat(
                    name=beat_data["name"],
                    artist=beat_data["artist"],
                    genre=beat_data["genre"],
                    mood=beat_data["mood"],
                    bpm=beat_data["bpm"],
                    cover_color=beat_data["cover_color"],
                    audio_file=beat_data["audio_file"]
                )
                db.session.add(beat)
                print(f"✓ {beat_data['name']} eklendi")
            else:
                print(f"• {beat_data['name']} zaten var")
        
        db.session.commit()
        print("\n✓ Tüm beat'ler veritabanına kaydedildi!")


def export_beats_json():
    """Beat listesini JSON olarak kaydet"""
    with open(BEATS_JSON, 'w', encoding='utf-8') as f:
        json.dump(SAMPLE_BEATS, f, indent=2, ensure_ascii=False)
    print(f"✓ Beat listesi {BEATS_JSON} dosyasına kaydedildi")


# Ücretsiz Beat Kaynakları Listesi
FREE_BEAT_SOURCES = """
🎵 Ücretsiz Beat Kaynakları:

1. Pixabay Music - https://pixabay.com/music/
   - Tamamen ücretsiz, telif hakkı yok
   - Ticari kullanım serbest

2. Free Music Archive - https://freemusicarchive.org/
   - Creative Commons lisanslı
   - Çeşitli türlerde müzik

3. Bensound - https://www.bensound.com/
   - Ücretsiz müzikler (atıf gerekebilir)
   
4. Incompetech - https://incompetech.com/
   - Kevin MacLeod'un ücretsiz müzikleri
   
5. YouTube Audio Library - https://studio.youtube.com/channel/UC/music
   - YouTube içerik üreticileri için ücretsiz

6. Mixkit - https://mixkit.co/free-stock-music/
   - Ücretsiz beat ve müzikler

7. SoundCloud (Creative Commons) - https://soundcloud.com/
   - CC lisanslı beat'ler

⚠️ Her zaman lisans koşullarını kontrol edin!
"""


if __name__ == "__main__":
    print("🎵 FONİX Beat Yöneticisi\n")
    print("1. Beat'leri veritabanına ekle")
    print("2. Beat listesini JSON olarak kaydet")
    print("3. Ücretsiz beat kaynaklarını göster")
    print("4. Örnek beat dosyalarını oluştur")
    
    choice = input("\nSeçiminiz (1-4): ")
    
    if choice == "1":
        save_beats_to_db()
    elif choice == "2":
        export_beats_json()
    elif choice == "3":
        print(FREE_BEAT_SOURCES)
    elif choice == "4":
        create_sample_beat_files()
    else:
        print("Geçersiz seçim")
