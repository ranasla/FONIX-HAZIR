from flask import (
    Flask, request, redirect, url_for,
    session, render_template, jsonify, flash, send_from_directory
)
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from datetime import datetime, timedelta
import os
import json
import random
import re
import jwt

app = Flask(__name__)
CORS(app, supports_credentials=True, origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:5000", "http://127.0.0.1:3000", "http://127.0.0.1:3001", "http://127.0.0.1:5000"], allow_headers=["Content-Type", "Authorization"], methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

app.secret_key = "fonix-secret-key-2025-secure"
JWT_SECRET = "fonix-jwt-secret-2025-secure"
JWT_ALGORITHM = "HS256"

# Session ayarları - "Beni hatırla" için 30 gün
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "fonix.db")

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + DB_PATH
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

# ============================================
# MODELLER
# ============================================

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    full_name = db.Column(db.String(100), nullable=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Profil bilgileri
    bio = db.Column(db.Text, nullable=True)
    avatar_color = db.Column(db.String(20), default="#ff146a")
    favorite_genre = db.Column(db.String(50), nullable=True)
    
    # İlişkiler
    projects = db.relationship('Project', backref='user', lazy=True)
    playlists = db.relationship('Playlist', backref='user', lazy=True)

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)
    
    def update_last_login(self):
        self.last_login = datetime.utcnow()
        db.session.commit()
    
    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "full_name": self.full_name,
            "email": self.email,
            "bio": self.bio,
            "avatar_color": self.avatar_color,
            "favorite_genre": self.favorite_genre,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_login": self.last_login.isoformat() if self.last_login else None
        }


class Song(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(120), nullable=False)
    artist = db.Column(db.String(120), nullable=False)
    genre = db.Column(db.String(50), nullable=False)
    url = db.Column(db.String(255), nullable=False)
    rating_sum = db.Column(db.Integer, default=0)
    rating_count = db.Column(db.Integer, default=0)

    @property
    def avg_rating(self):
        if self.rating_count == 0:
            return 0
        return round(self.rating_sum / self.rating_count, 1)
    
    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "artist": self.artist,
            "genre": self.genre,
            "url": self.url,
            "rating_sum": self.rating_sum,
            "rating_count": self.rating_count,
            "avg_rating": self.avg_rating
        }


class Beat(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    artist = db.Column(db.String(120), nullable=False)
    genre = db.Column(db.String(50), nullable=False)
    mood = db.Column(db.String(50), default="neutral")
    url = db.Column(db.String(500), nullable=False)
    file_url = db.Column(db.String(500), nullable=True)
    bpm = db.Column(db.Integer, default=100)
    duration = db.Column(db.String(10), default="2:30")
    cover_color = db.Column(db.String(50), default="#ff146a")
    tags = db.Column(db.String(255), default="")
    license_info = db.Column(db.String(100), default="Free to Use")
    youtube_id = db.Column(db.String(50), nullable=True)
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "artist": self.artist,
            "genre": self.genre,
            "mood": self.mood,
            "url": self.url,
            "file_url": self.file_url or self.url,
            "bpm": self.bpm,
            "duration": self.duration,
            "cover_color": self.cover_color,
            "tags": self.tags.split(",") if self.tags else [],
            "license_info": self.license_info,
            "youtube_id": self.youtube_id
        }


class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(120), nullable=False)
    lyrics = db.Column(db.Text, default="")
    beat_id = db.Column(db.Integer, db.ForeignKey('beat.id'), nullable=True)
    
    energy_level = db.Column(db.String(20), default="mid")
    mood = db.Column(db.String(50), default="neutral")
    theme = db.Column(db.String(50), default="general")
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    beat = db.relationship('Beat', backref='projects')
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "lyrics": self.lyrics,
            "beat_id": self.beat_id,
            "beat": self.beat.to_dict() if self.beat else None,
            "energy_level": self.energy_level,
            "mood": self.mood,
            "theme": self.theme,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class Playlist(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    beat_id = db.Column(db.Integer, db.ForeignKey('beat.id'), nullable=False)
    added_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    beat = db.relationship('Beat', backref='in_playlists')
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "beat_id": self.beat_id,
            "beat": self.beat.to_dict() if self.beat else None,
            "added_at": self.added_at.isoformat() if self.added_at else None
        }


class ChatHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=True)
    role = db.Column(db.String(10), nullable=False)
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


# ============================================
# JWT HELPER FONKSİYONLARI
# ============================================

def create_token(user_id, remember=False):
    expiry = timedelta(days=30) if remember else timedelta(hours=24)
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + expiry
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("user_id")
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_current_user_from_token():
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    
    token = auth_header.split(" ")[1]
    user_id = decode_token(token)
    if not user_id:
        return None
    
    return User.query.get(user_id)


def token_required(f):
    @wraps(f)
    def wrap(*args, **kwargs):
        user = get_current_user_from_token()
        if not user:
            return jsonify({"error": "Unauthorized"}), 401
        return f(user, *args, **kwargs)
    return wrap


# ============================================
# AUTH API ENDPOINTS
# ============================================

@app.route("/api/auth/register", methods=["POST"])
def api_register():
    data = request.get_json() or {}
    
    full_name = data.get("full_name", "").strip()
    username = data.get("username", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "")

    if not (username and email and password):
        return jsonify({"error": "Tüm alanlar zorunlu."}), 400
    
    if len(password) < 6:
        return jsonify({"error": "Şifre en az 6 karakter olmalı."}), 400
    
    if len(username) < 3:
        return jsonify({"error": "Kullanıcı adı en az 3 karakter olmalı."}), 400

    existing = User.query.filter(
        (User.username == username) | (User.email == email)
    ).first()
    
    if existing:
        return jsonify({"error": "Bu kullanıcı adı veya e-posta zaten kullanılıyor."}), 400

    u = User(username=username, email=email, full_name=full_name)
    u.set_password(password)
    db.session.add(u)
    db.session.commit()

    token = create_token(u.id)
    return jsonify({
        "message": "Hesabınız başarıyla oluşturuldu!",
        "token": token,
        "user": u.to_dict()
    })


@app.route("/api/auth/login", methods=["POST"])
def api_login():
    data = request.get_json() or {}
    
    username_or_email = data.get("username_or_email", "").strip()
    password = data.get("password", "")
    remember = data.get("remember", False)

    user = User.query.filter(
        (User.username == username_or_email) |
        (User.email == username_or_email)
    ).first()

    if not user or not user.check_password(password):
        return jsonify({"error": "Kullanıcı veya şifre hatalı."}), 401

    user.last_login = datetime.utcnow()
    db.session.commit()

    token = create_token(user.id, remember)
    return jsonify({
        "message": f"Hoş geldin {user.username}!",
        "token": token,
        "user": user.to_dict()
    })


@app.route("/api/auth/logout", methods=["POST"])
def api_logout():
    return jsonify({"message": "Çıkış yapıldı."})


@app.route("/api/auth/me", methods=["GET"])
@token_required
def api_get_me(user):
    return jsonify({"user": user.to_dict()})


@app.route("/api/auth/profile", methods=["PUT"])
@token_required
def api_update_profile(user):
    data = request.get_json() or {}
    
    if "username" in data:
        existing = User.query.filter(User.username == data["username"], User.id != user.id).first()
        if existing:
            return jsonify({"error": "Bu kullanıcı adı zaten kullanılıyor."}), 400
        user.username = data["username"]
    
    if "email" in data:
        existing = User.query.filter(User.email == data["email"], User.id != user.id).first()
        if existing:
            return jsonify({"error": "Bu e-posta zaten kullanılıyor."}), 400
        user.email = data["email"]
    
    if "full_name" in data:
        user.full_name = data["full_name"]
    
    if "bio" in data:
        user.bio = data["bio"]
    
    if "avatar_color" in data:
        user.avatar_color = data["avatar_color"]
    
    if "favorite_genre" in data:
        user.favorite_genre = data["favorite_genre"]
    
    db.session.commit()
    return jsonify({"message": "Profil güncellendi!", "user": user.to_dict()})


@app.route("/api/auth/password", methods=["PUT"])
@token_required
def api_change_password(user):
    data = request.get_json() or {}
    
    current = data.get("current_password")
    new_pass = data.get("new_password")
    confirm = data.get("confirm_password")
    
    if not user.check_password(current):
        return jsonify({"error": "Mevcut şifre hatalı!"}), 400
    
    if new_pass != confirm:
        return jsonify({"error": "Şifreler eşleşmiyor!"}), 400
    
    if len(new_pass) < 6:
        return jsonify({"error": "Şifre en az 6 karakter olmalı!"}), 400
    
    user.set_password(new_pass)
    db.session.commit()
    return jsonify({"message": "Şifre güncellendi!"})


# ============================================
# SONGS API ENDPOINTS
# ============================================

@app.route("/api/songs", methods=["GET"])
def api_get_songs():
    genre = request.args.get("genre", "Tümü")
    
    if genre == "Tümü":
        songs = Song.query.all()
    else:
        songs = Song.query.filter_by(genre=genre).all()
    
    return jsonify({
        "songs": [s.to_dict() for s in songs],
        "genres": ["Tümü", "Pop", "Rap", "Rock", "Lo-fi", "Chill", "Elektronik", "Arabesk", "Jazz"]
    })


@app.route("/api/songs/<int:song_id>", methods=["GET"])
def api_get_song(song_id):
    song = Song.query.get_or_404(song_id)
    return jsonify({"song": song.to_dict()})


@app.route("/api/songs/<int:song_id>/rate", methods=["POST"])
def api_rate_song(song_id):
    data = request.get_json() or {}
    rating = int(data.get("rating", 0))
    
    if rating < 1 or rating > 5:
        return jsonify({"error": "Geçersiz puan"}), 400
    
    song = Song.query.get_or_404(song_id)
    song.rating_sum += rating
    song.rating_count += 1
    db.session.commit()
    
    return jsonify({"message": "Puanlandı!", "song": song.to_dict()})


@app.route("/api/songs/top", methods=["GET"])
def api_top_songs():
    all_songs = Song.query.all()
    rated = [s for s in all_songs if s.rating_count > 0]
    top10 = sorted(rated, key=lambda s: s.avg_rating, reverse=True)[:10]
    return jsonify({"songs": [s.to_dict() for s in top10]})


# ============================================
# BEATS API ENDPOINTS
# ============================================

@app.route("/api/beats", methods=["GET"])
def api_get_beats():
    genre_filter = request.args.get("genre", "Tümü")
    mood_filter = request.args.get("mood", "Tümü")
    bpm_filter = request.args.get("bpm", "")
    search_query = request.args.get("q", "").strip()
    
    query = Beat.query
    
    if genre_filter != "Tümü":
        query = query.filter_by(genre=genre_filter)
    
    if mood_filter != "Tümü":
        query = query.filter_by(mood=mood_filter)
    
    if bpm_filter:
        try:
            bpm = int(bpm_filter)
            query = query.filter(Beat.bpm.between(bpm - 10, bpm + 10))
        except ValueError:
            pass
    
    if search_query:
        query = query.filter(
            (Beat.name.ilike(f"%{search_query}%")) |
            (Beat.tags.ilike(f"%{search_query}%"))
        )
    
    beats = query.all()
    
    return jsonify({
        "beats": [b.to_dict() for b in beats],
        "genres": ["Tümü", "Melodic Trap", "Dark Trap", "Drill", "Hip-Hop", "Lo-fi", "Chill", "Electronic", "Synthwave"],
        "moods": ["Tümü", "sad", "emotional", "hyper", "dark", "chill", "energetic"]
    })


@app.route("/api/beats/<int:beat_id>", methods=["GET"])
def api_get_beat(beat_id):
    beat = Beat.query.get_or_404(beat_id)
    return jsonify({"beat": beat.to_dict()})


@app.route("/api/beat-recommend", methods=["POST"])
def api_recommend_beats():
    data = request.get_json() or {}
    lyrics = data.get("lyrics", "").lower()
    current_mood = data.get("mood", "")
    current_energy = data.get("energy", "mid")
    
    analysis = analyze_lyrics(lyrics)
    
    query = Beat.query
    
    if analysis["mood"] and analysis["mood"] != "Nötr":
        query = query.filter_by(mood=analysis["mood"].lower())
    elif current_mood:
        query = query.filter_by(mood=current_mood)
    
    if current_energy == "low":
        query = query.filter(Beat.bpm.between(60, 90))
    elif current_energy == "high":
        query = query.filter(Beat.bpm.between(130, 180))
    else:
        query = query.filter(Beat.bpm.between(90, 130))
    
    if analysis["genre"]:
        matching_beats = query.filter_by(genre=analysis["genre"]).limit(5).all()
        if not matching_beats:
            matching_beats = query.limit(5).all()
    else:
        matching_beats = query.limit(5).all()
    
    return jsonify({
        "analysis": analysis,
        "beats": [b.to_dict() for b in matching_beats]
    })


# ============================================
# PROJECTS API ENDPOINTS
# ============================================

@app.route("/api/projects", methods=["GET"])
@token_required
def api_get_projects(user):
    projects = Project.query.filter_by(user_id=user.id).order_by(Project.updated_at.desc()).all()
    return jsonify({"projects": [p.to_dict() for p in projects]})


@app.route("/api/projects/<int:project_id>", methods=["GET"])
@token_required
def api_get_project(user, project_id):
    project = Project.query.filter_by(id=project_id, user_id=user.id).first_or_404()
    return jsonify({"project": project.to_dict()})


@app.route("/api/projects", methods=["POST"])
@token_required
def api_create_project(user):
    data = request.get_json() or {}
    
    project = Project(
        user_id=user.id,
        title=data.get("title", "Adsız Proje"),
        lyrics=data.get("lyrics", ""),
        energy_level=data.get("energy_level", "mid"),
        mood=data.get("mood", "neutral"),
        theme=data.get("theme", "general"),
        beat_id=data.get("beat_id")
    )
    
    db.session.add(project)
    db.session.commit()
    
    return jsonify({"message": "Proje oluşturuldu!", "project": project.to_dict()})


@app.route("/api/projects/<int:project_id>", methods=["PUT"])
@token_required
def api_update_project(user, project_id):
    project = Project.query.filter_by(id=project_id, user_id=user.id).first_or_404()
    data = request.get_json() or {}
    
    if "title" in data:
        project.title = data["title"]
    if "lyrics" in data:
        project.lyrics = data["lyrics"]
    if "energy_level" in data:
        project.energy_level = data["energy_level"]
    if "mood" in data:
        project.mood = data["mood"]
    if "theme" in data:
        project.theme = data["theme"]
    if "beat_id" in data:
        project.beat_id = data["beat_id"]
    
    db.session.commit()
    return jsonify({"message": "Proje güncellendi!", "project": project.to_dict()})


@app.route("/api/projects/<int:project_id>", methods=["DELETE"])
@token_required
def api_delete_project(user, project_id):
    project = Project.query.filter_by(id=project_id, user_id=user.id).first_or_404()
    db.session.delete(project)
    db.session.commit()
    return jsonify({"message": "Proje silindi!"})


# ============================================
# PLAYLIST API ENDPOINTS
# ============================================

@app.route("/api/playlist", methods=["GET"])
@token_required
def api_get_playlist(user):
    playlist_items = Playlist.query.filter_by(user_id=user.id).order_by(Playlist.added_at.desc()).all()
    return jsonify({"playlist": [p.to_dict() for p in playlist_items]})


@app.route("/api/playlist/add", methods=["POST"])
@token_required
def api_add_to_playlist(user):
    data = request.get_json() or {}
    beat_id = data.get("beat_id")
    
    if not beat_id:
        return jsonify({"error": "Beat ID gerekli"}), 400
    
    existing = Playlist.query.filter_by(user_id=user.id, beat_id=beat_id).first()
    if existing:
        return jsonify({"error": "Beat zaten playlist'te"})
    
    item = Playlist(user_id=user.id, beat_id=beat_id)
    db.session.add(item)
    db.session.commit()
    
    return jsonify({"message": "Playlist'e eklendi!", "item": item.to_dict()})


@app.route("/api/playlist/remove", methods=["POST"])
@token_required
def api_remove_from_playlist(user):
    data = request.get_json() or {}
    beat_id = data.get("beat_id")
    
    if not beat_id:
        return jsonify({"error": "Beat ID gerekli"}), 400
    
    item = Playlist.query.filter_by(user_id=user.id, beat_id=beat_id).first()
    if item:
        db.session.delete(item)
        db.session.commit()
    
    return jsonify({"message": "Playlist'ten kaldırıldı!"})


# ============================================
# CHAT API ENDPOINT
# ============================================

@app.route("/api/chat", methods=["POST"])
def api_chat():
    data = request.get_json() or {}
    message = data.get("message", "").strip()
    context = data.get("context", {})
    
    if not message:
        return jsonify({"error": "Mesaj boş olamaz"}), 400
    
    user = get_current_user_from_token()
    
    if user:
        chat = ChatHistory(
            user_id=user.id,
            project_id=context.get("project_id"),
            role="user",
            message=message
        )
        db.session.add(chat)
    
    response = generate_chat_response(message, context)
    
    if user:
        chat = ChatHistory(
            user_id=user.id,
            project_id=context.get("project_id"),
            role="assistant",
            message=response
        )
        db.session.add(chat)
        db.session.commit()
    
    return jsonify({"response": response})


# ============================================
# LYRICS API ENDPOINTS
# ============================================

@app.route("/api/lyrics/analyze", methods=["POST"])
def api_analyze_lyrics():
    data = request.get_json() or {}
    lyrics = data.get("lyrics", "")
    
    analysis = analyze_lyrics(lyrics)
    return jsonify({"analysis": analysis})


@app.route("/api/lyrics/generate", methods=["POST"])
def api_generate_lyrics():
    data = request.get_json() or {}
    lyrics_text = data.get("lyrics", "").strip()
    
    if not lyrics_text:
        return jsonify({"error": "Lütfen söz giriniz."}), 400
    
    audio_url = None
    
    try:
        from gtts import gTTS
        import glob
        
        tts = gTTS(lyrics_text, lang="tr")
        tts_path = os.path.join("static", "uploads", f"tts_{random.randint(10000,99999)}.mp3")
        os.makedirs(os.path.dirname(tts_path), exist_ok=True)
        tts.save(tts_path)
        audio_url = "/" + tts_path.replace("\\", "/")

        try:
            from pydub import AudioSegment
            beat_files = glob.glob(os.path.join("static", "beats", "*.mp3"))
            if beat_files:
                beat_path = random.choice(beat_files)
                beat = AudioSegment.from_file(beat_path)
                tts_audio = AudioSegment.from_file(tts_path)
                beat_cut = beat[:len(tts_audio)]
                combined = tts_audio.overlay(beat_cut - 7)
                out_path = os.path.join("static", "uploads", f"mix_{random.randint(10000,99999)}.mp3")
                combined.export(out_path, format="mp3")
                audio_url = "/" + out_path.replace("\\", "/")
        except Exception:
            pass
            
    except Exception as e:
        return jsonify({"error": f"Ses oluşturma hatası: {str(e)}"}), 500

    return jsonify({"audio_url": audio_url})


# ============================================
# RECOMMENDATIONS API
# ============================================

@app.route("/api/recommendations", methods=["GET"])
def api_recommendations():
    recommended = []
    top_genre = "Melodic Trap"
    
    user = get_current_user_from_token()
    
    if user:
        playlist_items = Playlist.query.filter_by(user_id=user.id).all()
        favorite_genres = {}
        favorite_moods = {}
        
        for item in playlist_items:
            if item.beat:
                genre = item.beat.genre
                mood = item.beat.mood
                favorite_genres[genre] = favorite_genres.get(genre, 0) + 1
                favorite_moods[mood] = favorite_moods.get(mood, 0) + 1
        
        top_genre = max(favorite_genres, key=favorite_genres.get) if favorite_genres else "Melodic Trap"
        top_mood = max(favorite_moods, key=favorite_moods.get) if favorite_moods else "neutral"
        
        recommended = Beat.query.filter(
            (Beat.genre == top_genre) | (Beat.mood == top_mood)
        ).limit(10).all()
    
    if not recommended:
        recommended = Beat.query.order_by(Beat.id.desc()).limit(10).all()
    
    return jsonify({
        "beats": [b.to_dict() for b in recommended],
        "top_genre": top_genre
    })


# ============================================
# STATIC FILES FOR REACT
# ============================================

@app.route('/')
def serve_react():
    return jsonify({"status": "FONIX API is running"})


@app.route('/static/beats/<path:filename>')
def serve_beats(filename):
    """Beat dosyalarını servis et"""
    beats_dir = os.path.join(BASE_DIR, 'static', 'beats')
    print(f"Serving beat: {filename} from {beats_dir}")
    return send_from_directory(beats_dir, filename)


@app.route('/static/<path:filename>')
def serve_static_files(filename):
    """Diğer statik dosyaları servis et"""
    static_dir = os.path.join(BASE_DIR, 'static')
    print(f"Serving static: {filename} from {static_dir}")
    return send_from_directory(static_dir, filename)


# ============================================
# HELPER FONKSİYONLARI
# ============================================

def analyze_lyrics(lyrics):
    """Şarkı sözlerini analiz et"""
    lyrics = lyrics.lower()
    
    sad_keywords = ["hüzün", "ağla", "gözyaş", "ayrılık", "yalnız", "kayıp", "acı", "özlem", "geçmiş", "bırak"]
    dark_keywords = ["karanlık", "gece", "sokak", "düşman", "kan", "ölüm", "savaş", "nefret", "intikam"]
    energetic_keywords = ["güç", "zafer", "başarı", "koş", "uç", "patlat", "zirve", "şampiyon", "enerji"]
    love_keywords = ["aşk", "sev", "kalp", "gözler", "dudak", "sarıl", "öp", "sensiz", "seninle"]
    chill_keywords = ["sakin", "huzur", "rüya", "yavaş", "dinlen", "kahve", "gece", "yağmur"]
    
    trap_keywords = ["para", "flex", "drip", "gang", "squad", "trap", "bass", "808"]
    drill_keywords = ["ops", "slide", "mask", "block", "zone", "drill"]
    lofi_keywords = ["chill", "relax", "study", "vibes", "peaceful", "lo-fi"]
    
    mood = "neutral"
    genre = None
    theme = "general"
    
    sad_count = sum(1 for word in sad_keywords if word in lyrics)
    dark_count = sum(1 for word in dark_keywords if word in lyrics)
    energetic_count = sum(1 for word in energetic_keywords if word in lyrics)
    love_count = sum(1 for word in love_keywords if word in lyrics)
    chill_count = sum(1 for word in chill_keywords if word in lyrics)
    
    counts = {
        "sad": sad_count,
        "dark": dark_count,
        "energetic": energetic_count,
        "emotional": love_count,
        "chill": chill_count
    }
    
    if max(counts.values()) > 0:
        mood = max(counts, key=counts.get)
    
    trap_count = sum(1 for word in trap_keywords if word in lyrics)
    drill_count = sum(1 for word in drill_keywords if word in lyrics)
    lofi_count = sum(1 for word in lofi_keywords if word in lyrics)
    
    genre_counts = {"Melodic Trap": trap_count, "Drill": drill_count, "Lo-fi": lofi_count}
    if max(genre_counts.values()) > 0:
        genre = max(genre_counts, key=genre_counts.get)
    
    if love_count > 2:
        theme = "love"
    elif dark_count > 2:
        theme = "dark_past"
    elif energetic_count > 2:
        theme = "success"
    
    if energetic_count > 2:
        energy = "Yüksek 🔥"
    elif chill_count > 2 or sad_count > 2:
        energy = "Düşük 🌙"
    else:
        energy = "Orta ⚡"
    
    return {
        "mood": mood.capitalize() if mood != "neutral" else "Nötr",
        "genre": genre if genre else "Trap",
        "theme": theme.replace("_", " ").capitalize() if theme != "general" else "Genel",
        "energy": energy,
        "word_count": len(lyrics.split()),
        "line_count": len([l for l in lyrics.split('\n') if l.strip()])
    }


def generate_chat_response(message, context):
    """Chat yanıtı oluştur"""
    msg = message.lower()
    current_genre = context.get("genre", "trap")
    current_lyrics = context.get("lyrics", "")
    
    if any(word in msg for word in ["söz yaz", "şarkı yaz", "verse yaz", "nakarat yaz", "tekrar yaz"]):
        return generate_lyrics_response(msg, current_genre, context)
    
    if any(word in msg for word in ["kafiye", "uyak", "rhyme"]):
        return generate_rhyme_suggestions(msg, current_lyrics)
    
    if any(word in msg for word in ["tema", "konu", "fikir"]):
        return generate_theme_suggestions(msg)
    
    if any(word in msg for word in ["flow", "ritim", "tempo"]):
        return generate_flow_tips(context)
    
    if any(word in msg for word in ["duygusal", "sert", "mutlu", "üzgün", "karanlık", "motive"]):
        return adjust_tone_suggestion(msg)
    
    if any(word in msg for word in ["nakarat", "hook", "chorus"]):
        return generate_hook_tips()
    
    if any(word in msg for word in ["verse", "dörtlük", "kıta"]):
        return generate_verse_structure()
    
    return get_default_help()


def generate_lyrics_response(msg, genre, context):
    LYRICS_DB = {
        'melodic trap': [
            "Yıldızlar altında seni düşledim",
            "Kalbim kırık ama yine de gülümsedim",
            "Sensiz geçen her an bir yıl gibi",
            "Gözyaşlarım akar, sel olur sanki",
            "Ay ışığı vurur yüzüne, parlar",
            "Unutamam seni, anılar yakar",
            "Son bir kez bak gözlerime gitmeden",
            "Rüyalarım seninle dolu, uyanmak istemem",
            "Melodiler anlatır söyleyemediklerimi",
            "Geceler şahidim, ne çok sevdim seni"
        ],
        'dark trap': [
            "Gece çöktü yine, sokaklar buz gibi",
            "Para pul yalan, kardeşlik baki",
            "Zirveye tırmanış, durmak yok sanki",
            "Düşmanlar konuşur, ama boş lafır",
            "Mahallede saygı, hak edene verilir",
            "Sözlerim mermi, deler geçer zırhı",
            "Gözlerimde ateş, içimde buz dağı",
            "Her düşüş bir ders, kalk ve devam et"
        ],
        'drill': [
            "Maskede yüzler, kimse tanımaz",
            "Mahalle bizim, kurallar bizden sorulur",
            "Karanlık işler, aydınlık düşler",
            "Adalet yoksa, biz sağlarız düzeni",
            "Dostunu iyi seç, yılanlar çoktur",
            "Bizde geri vites yok, hep ileri",
            "Karanlık sokaklar evimiz oldu"
        ],
        'lo-fi': [
            "Kahvem elimde, yağmur camda",
            "Düşünceler dalgın, hepsi birer damla",
            "Eski günler aklımda, huzur ararım",
            "Sessizce yürüyorum, kendimi bulurum",
            "Kitaplar, notlar, yorgun gözler",
            "Kendi halimde bir dünya kurdum",
            "Sessizliğin sesi en güzel melodi"
        ],
        'hip-hop': [
            "Mikrofon elimde, sahne benim evim",
            "Beat düşer, söz patlar, bu benim işim",
            "Sokaktan geldim, hiç unutmam nereden",
            "Her satır gerçek, masallar değil bu",
            "Ritim kalp atışım, söz nefesim",
            "Yıllar geçse de aynı hevesim"
        ]
    }
    
    genre_key = genre.lower().replace("-", " ")
    pool = LYRICS_DB.get(genre_key, LYRICS_DB.get('melodic trap'))
    
    if "nakarat" in msg or "hook" in msg:
        lines = random.sample(pool, min(4, len(pool)))
        return f"""🎶 **{genre.upper()}** tarzında nakarat önerisi:

{chr(10).join(lines)}

💡 **İpucu:** Nakaratı akılda kalıcı ve tekrarlanabilir tut. 
Son iki satırı 2 kez tekrar edebilirsin."""
    
    elif "verse" in msg or "dörtlük" in msg:
        lines = random.sample(pool, min(8, len(pool)))
        return f"""🎤 **{genre.upper()}** tarzında verse önerisi:

{chr(10).join(lines[:4])}

{chr(10).join(lines[4:])}

💡 **İpucu:** Verse'te hikaye anlat, nakaratta özetle."""
    
    else:
        lines = random.sample(pool, min(4, len(pool)))
        return f"""🎵 **{genre.upper()}** tarzında özgün dörtlük:

{chr(10).join(lines)}

Beğenmediysen "tekrar yaz" diyebilirsin! 
"Nakarat yaz" veya "verse yaz" diyerek özel istekte bulunabilirsin."""


def generate_rhyme_suggestions(msg, lyrics):
    rhyme_db = {
        "-ak/-ek": ["durak", "uzak", "tuzak", "burak", "yanak", "dudak", "adak", "kadak"],
        "-an/-en": ["zaman", "duman", "yalan", "kaplan", "insan", "cihan", "meydan"],
        "-ır/-ir": ["satır", "hatır", "yatır", "batır", "katır", "sabır", "kabir"],
        "-uş/-üş": ["duruş", "vuruş", "kuruluş", "sürüş", "görüş", "söyleniş"],
        "-im/-ım": ["sevdim", "bildim", "geldim", "verdim", "gördüm", "öldüm"],
        "-yor": ["ağlıyor", "gülüyor", "koşuyor", "bakıyor", "yazıyor", "okuyor"]
    }
    
    response = """🎤 **Kafiye Önerileri**

Türkçe'de en çok kullanılan kafiye kalıpları:

"""
    for pattern, words in rhyme_db.items():
        response += f"**{pattern}:** {', '.join(words[:5])}\n"
    
    response += """

💡 **Zengin Kafiye İpucu:** 
Sadece son heceye değil, son 2-3 sesli harfe odaklan.
Örnek: "hayalLER" - "masalLAR" (zengin kafiye)

**İç Kafiye:** Satır ortasında kafiye kur.
Örnek: "Gece *karanlık*, yollar *ıslak*"
"""
    return response


def generate_theme_suggestions(msg):
    themes = {
        "💕 Aşk": "İmkansız aşk, kavuşamama, özlem, ilk aşk, ayrılık acısı",
        "💪 Motivasyon": "Başarı hikayesi, zorlukları aşma, azim, hayaller",
        "🌙 Gece/Sokak": "Gece yalnızlığı, sokak hikayeleri, şehir ışıkları",
        "🔥 Başarı": "Zirveye çıkış, kendini kanıtlama, başarı sarhoşluğu",
        "💔 Hüzün": "Kayıp, özlem, geçmişe bakış, melankolik anılar",
        "🦁 Güç": "Özgüven, güçlü duruş, meydan okuma"
    }
    
    response = "🎵 **Şarkı Tema Önerileri**\n\n"
    for theme, desc in themes.items():
        response += f"{theme}\n{desc}\n\n"
    
    response += "Hangi temayı seçersen, o tema hakkında sözler yazabilirim!"
    return response


def generate_flow_tips(context):
    return """🎶 **Flow & Ritim İpuçları**

**1. Hece Sayısı:**
Her satırda benzer hece sayısı tut (8-12 ideal).

**2. Vurgu Noktaları:**
Beat'in drop'larına güçlü sözler yerleştir.

**3. Nefes Noktaları:**
Her 2-4 satırda bir nefes boşluğu bırak.

**4. Tempo Değişimi:**
Verse'te yavaş, nakarat'ta hızlı gidebilirsin.

**5. Ad-lib'ler:**
"yeah", "uh", "skrrt" gibi dolgu sesler flow'u güçlendirir.

💡 Beat'i dinlerken sözleri oku, uyumu kontrol et!"""


def adjust_tone_suggestion(msg):
    if "duygusal" in msg or "üzgün" in msg:
        return """💔 **Duygusal/Üzgün Ton İçin:**

- Yavaş, düşük BPM beat seç (70-90)
- Uzun ünlü sesler kullan ("aaa", "ooo")
- Geçmiş zaman kullan ("sevdim", "kaybettim")
- Doğa metaforları: yağmur, gece, sonbahar
- Kısa, kesik cümleler etkili olur"""
    
    elif "sert" in msg or "karanlık" in msg:
        return """🔥 **Sert/Karanlık Ton İçin:**

- Yüksek BPM, ağır bass (100-140)
- Sert ünsüzler: k, t, p, ç
- Kısa, vurgulu kelimeler
- Sokak jargonu kullan
- Otoriter cümleler: "dinle", "bak", "gel"
- Tehdit ve meydan okuma"""
    
    elif "mutlu" in msg or "motive" in msg:
        return """💪 **Mutlu/Motive Edici Ton İçin:**

- Orta-yüksek BPM (110-130)
- Pozitif kelimeler: zafer, güç, ışık
- Gelecek zaman: "olacak", "başaracağız"
- Tekrarlayan, akılda kalıcı nakarat
- Yükselen melodi hissi"""
    
    return "Hangi ton istediğini söyle: duygusal, sert, mutlu veya karanlık?"


def generate_hook_tips():
    return """🎵 **Nakarat (Hook) Yazım İpuçları**

**1. Kısa ve Öz:**
Nakarat 4-8 satır olmalı, uzatma.

**2. Tekrar:**
En güçlü satırı 2 kez tekrarla.

**3. Akılda Kalıcılık:**
Basit kelimeler, kolay melodi.

**4. Şarkının Özeti:**
Nakarat, verse'lerin özetidir.

**5. Soru-Cevap:**
"Neden?" - "Çünkü..."

**Örnek Yapı:**
```
[Satır 1 - Ana tema]
[Satır 2 - Devamı]
[Satır 3 - Vurgu]
[Satır 4 - Tekrar/Kapanış]
```

"Nakarat yaz" dersen sana örnek oluştururum!"""


def generate_verse_structure():
    return """📝 **Verse Yapısı**

**Klasik 16 Bar:**
- 4 satır giriş (tema tanıtımı)
- 8 satır gelişme (hikaye)
- 4 satır kapanış (sonuç/geçiş)

**8 Bar Verse:**
- 2 satır giriş
- 4 satır ana içerik
- 2 satır kapanış

**Verse vs Nakarat:**
- Verse: Detaylı hikaye
- Nakarat: Özet ve tekrar

**İpucu:**
İlk verse'te problemi anlat,
İkinci verse'te çözümü göster.

"Verse yaz" dersen sana örnek oluştururum!"""


def get_default_help():
    return """👋 **Merhaba! Ben senin şarkı yazım asistanınım.**

🎵 **Neler yapabilirim?**

• "Söz yaz" - Seçili beat'e uygun sözler
• "Nakarat yaz" - Akılda kalıcı hook
• "Verse yaz" - 8-16 bar verse
• "Kafiye öner" - Uyak önerileri
• "Tema bul" - Konu fikirleri
• "Flow ipucu" - Ritim tavsiyeleri
• "Daha duygusal yap" - Ton ayarla

💡 Beat seçip "söz yaz" de, hemen başlayalım!"""


# ============================================
# SEED DATA
# ============================================

def seed_beats():
    if Beat.query.count() > 0:
        return
    
    try:
        if not os.path.exists('extracted_beats.json'):
            create_sample_beats()
            return

        with open('extracted_beats.json', 'r', encoding='utf-8') as f:
            beats_raw = json.load(f)
            
        GENRE_MAP = {
            "Trap": ["Melodic Trap", "Dark Trap"],
            "Hip-Hop": ["Hip-Hop", "Drill"],
            "Lo-fi": ["Lo-fi", "Chill"],
            "Electronic": ["Electronic", "Synthwave"]
        }
        
        MOODS = {
            "Melodic Trap": "emotional",
            "Dark Trap": "dark",
            "Drill": "energetic",
            "Hip-Hop": "neutral",
            "Lo-fi": "chill",
            "Chill": "chill",
            "Electronic": "hyper",
            "Synthwave": "energetic"
        }
        
        NAMES = {
            "Melodic Trap": ["Moonlight", "Stargaze", "Euphoria", "Nightfall", "Drifting", "Vibe", "Soul", "Memories"],
            "Dark Trap": ["Venom", "Savage", "Grind", "Hustle", "Shadow", "Abyss", "Ghost", "Demon"],
            "Drill": ["Slide", "Ops", "Mask", "London", "Bronx", "Shooter", "Active", "Zone"],
            "Hip-Hop": ["Classic", "Boom Bap", "Flow", "Rhyme", "Street", "Unity", "Cipher", "Roots"],
            "Lo-fi": ["Study", "Rainy Day", "Coffee", "Midnight", "Dreams", "Sunset", "Waves", "Focus"],
            "Electronic": ["Cyber", "Pulse", "Neon", "Glitch", "Future", "Bass", "Rave", "System"],
            "Synthwave": ["Retro", "Miami", "Outrun", "Drive", "Arcade", "Vector", "Laser", "Neon"]
        }
        
        COLORS = {
            "Melodic Trap": "#d63384",
            "Dark Trap": "#6610f2",
            "Drill": "#fd7e14",
            "Hip-Hop": "#ffc107",
            "Lo-fi": "#0dcaf0",
            "Chill": "#20c997",
            "Electronic": "#0d6efd",
            "Synthwave": "#6f42c1"
        }

        count = 0
        used_names = set()

        for b in beats_raw:
            g_key = b.get('genre', 'Trap')
            if g_key in GENRE_MAP:
                sub_genre = GENRE_MAP[g_key][count % 2]
            else:
                sub_genre = g_key
                
            pool = NAMES.get(sub_genre, ["Beat " + str(count)])
            base_name = random.choice(pool)
            name = base_name
            
            retries = 0
            while name in used_names and retries < 10:
                name = f"{base_name} {random.randint(1,99)}"
                retries += 1
            used_names.add(name)
            
            new_beat = Beat(
                name=name,
                artist="Mixkit",
                genre=sub_genre,
                mood=MOODS.get(sub_genre, "neutral"),
                bpm=120 + random.randint(-20, 20),
                duration=b.get('duration', "2:30"),
                cover_color=COLORS.get(sub_genre, "#6c757d"),
                url=b.get('url', ''),
                tags=f"{sub_genre.lower()},free,beat",
                license_info="Free to Use - Mixkit License"
            )
            db.session.add(new_beat)
            count += 1
            
        db.session.commit()
        print(f"✅ {count} beat yüklendi!")
        
    except Exception as e:
        print(f"❌ Beat yükleme hatası: {e}")
        create_sample_beats()


def create_sample_beats():
    sample_beats = [
        {"name": "Midnight Dreams", "genre": "Melodic Trap", "mood": "emotional", "bpm": 140},
        {"name": "Purple Rain", "genre": "Melodic Trap", "mood": "sad", "bpm": 135},
        {"name": "Lost In Paradise", "genre": "Melodic Trap", "mood": "emotional", "bpm": 142},
        {"name": "Starlight", "genre": "Melodic Trap", "mood": "emotional", "bpm": 138},
        {"name": "Dark Alley", "genre": "Dark Trap", "mood": "dark", "bpm": 145},
        {"name": "Nightmare", "genre": "Dark Trap", "mood": "dark", "bpm": 148},
        {"name": "Shadow Realm", "genre": "Dark Trap", "mood": "dark", "bpm": 150},
        {"name": "London Drill", "genre": "Drill", "mood": "energetic", "bpm": 140},
        {"name": "Block Heat", "genre": "Drill", "mood": "energetic", "bpm": 142},
        {"name": "Streets Talking", "genre": "Drill", "mood": "energetic", "bpm": 138},
        {"name": "Classic Flow", "genre": "Hip-Hop", "mood": "neutral", "bpm": 90},
        {"name": "Old School Vibes", "genre": "Hip-Hop", "mood": "chill", "bpm": 88},
        {"name": "Study Session", "genre": "Lo-fi", "mood": "chill", "bpm": 75},
        {"name": "Rainy Day", "genre": "Lo-fi", "mood": "sad", "bpm": 72},
        {"name": "Coffee Shop", "genre": "Lo-fi", "mood": "chill", "bpm": 78},
        {"name": "Neon City", "genre": "Synthwave", "mood": "energetic", "bpm": 120},
        {"name": "Retro Future", "genre": "Synthwave", "mood": "energetic", "bpm": 118},
        {"name": "Deep House Groove", "genre": "Electronic", "mood": "chill", "bpm": 124},
        {"name": "Techno Pulse", "genre": "Electronic", "mood": "energetic", "bpm": 130},
    ]
    
    colors = {
        "Melodic Trap": "#d63384",
        "Dark Trap": "#6610f2",
        "Drill": "#fd7e14",
        "Hip-Hop": "#ffc107",
        "Lo-fi": "#0dcaf0",
        "Synthwave": "#6f42c1",
        "Electronic": "#20c997",
    }
    
    for b in sample_beats:
        beat = Beat(
            name=b["name"],
            artist="FONIX Studio",
            genre=b["genre"],
            mood=b["mood"],
            bpm=b["bpm"],
            duration="3:00",
            cover_color=colors.get(b["genre"], "#6c757d"),
            url="",
            tags=f"{b['genre'].lower()},sample",
            license_info="Sample Beat"
        )
        db.session.add(beat)
    
    db.session.commit()
    print("✅ Örnek beatler oluşturuldu!")


# ============================================
# CACHE KONTROLÜ
# ============================================

@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response


# ============================================
# UYGULAMA BAŞLATMA
# ============================================

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        seed_beats()
    app.run(debug=True, port=5000, use_reloader=False)
