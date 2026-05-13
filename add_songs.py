from app import db, Song, app

# Test verileri oluşturma
test_songs = [
    {"title": "Song 1", "artist": "Artist 1", "genre": "Pop", "url": "http://example.com/song1.mp3"},
    {"title": "Song 2", "artist": "Artist 2", "genre": "Rock", "url": "http://example.com/song2.mp3"},
    # ... 98 şarkı daha ekleyin ...
]

with app.app_context():
    for song in test_songs:
        new_song = Song(
            title=song['title'],
            artist=song['artist'],
            genre=song['genre'],
            url=song['url']
        )
        db.session.add(new_song)

    db.session.commit()
    print("100 test şarkısı başarıyla eklendi!")