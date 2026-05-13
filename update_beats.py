"""
Beat URL'lerini güncelle
"""
import os
import sys
import sqlite3

# Veritabanı dosyası
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fonix.db')

def update_beat_urls():
    beats_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'beats')
    available_files = os.listdir(beats_dir) if os.path.exists(beats_dir) else []
    
    print(f"Mevcut beat dosyaları: {len(available_files)} adet")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # file_url kolonu var mı kontrol et
    cursor.execute("PRAGMA table_info(beat)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'file_url' not in columns:
        print("file_url kolonu ekleniyor...")
        cursor.execute("ALTER TABLE beat ADD COLUMN file_url VARCHAR(500)")
        conn.commit()
        print("file_url kolonu eklendi!")
    
    # Tüm beat'leri al
    cursor.execute("SELECT id, name, url FROM beat")
    beats = cursor.fetchall()
    
    for beat_id, name, url in beats:
        file_url = None
        
        # Eğer URL dış kaynak ise (http ile başlıyorsa) file_url olarak kullan
        if url and url.startswith('http'):
            file_url = url
            print(f"Beat {beat_id}: {name} - Harici URL kullanılıyor")
        elif url:
            # Mevcut dosya adını kontrol et
            filename = os.path.basename(url)
            if filename in available_files:
                file_url = f"/static/beats/{filename}"
                print(f"Beat {beat_id}: {name} - Yerel dosya: {file_url}")
            else:
                # Varsayılan bir beat dosyası ata
                if available_files:
                    file_url = f"/static/beats/{available_files[0]}"
                    print(f"Beat {beat_id}: {name} - Dosya bulunamadı, varsayılan atandı")
        
        if file_url:
            cursor.execute("UPDATE beat SET file_url = ? WHERE id = ?", (file_url, beat_id))
    
    conn.commit()
    
    # Son durumu göster
    print("\n=== Güncel Beat Listesi ===")
    cursor.execute("SELECT id, name, url, file_url FROM beat")
    for beat_id, name, url, file_url in cursor.fetchall():
        print(f"ID: {beat_id}, Name: {name}")
        print(f"  URL: {url[:50] if url else 'None'}...")
        print(f"  File URL: {file_url if file_url else 'None'}")
        print()
    
    conn.close()
    print("\nTüm beat URL'leri güncellendi!")

if __name__ == "__main__":
    update_beat_urls()
