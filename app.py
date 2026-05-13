from flask import (
    Flask, request, redirect, url_for,
    session, render_template, jsonify, flash
)
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from datetime import datetime, timedelta, timezone
import os
import json
import random
import re
import jwt
import uuid

app = Flask(__name__)
app.secret_key = "fonix-secret-key-2025-secure"
app.config["JWT_SECRET_KEY"] = "fonix-jwt-secret-2025-very-secure"

# CORS ayarları - React frontend için (tüm originlere izin ver)
CORS(app, resources={r"/api/*": {"origins": "*", "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"], "allow_headers": ["Content-Type", "Authorization"]}})

# Session ayarları - "Beni hatırla" için 30 gün
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "fonix.db")

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + DB_PATH
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Aktif karaoke odaları (memory cache)
active_rooms = {}

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
    bio = db.Column(db.Text, nullable=True)  # Kullanıcı biyografisi
    avatar_color = db.Column(db.String(20), default="#ff146a")  # Avatar rengi
    favorite_genre = db.Column(db.String(50), nullable=True)  # Favori müzik türü
    
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


class Beat(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    artist = db.Column(db.String(120), nullable=False)
    genre = db.Column(db.String(50), nullable=False)
    mood = db.Column(db.String(50), default="neutral")  # sad, happy, dark, energetic
    url = db.Column(db.String(500), nullable=False)
    bpm = db.Column(db.Integer, default=100)
    duration = db.Column(db.String(10), default="2:30")
    cover_color = db.Column(db.String(50), default="#ff146a")
    tags = db.Column(db.String(255), default="")  # Virgülle ayrılmış etiketler
    license_info = db.Column(db.String(100), default="Free to Use")
    youtube_id = db.Column(db.String(50), nullable=True)
    lyrics = db.Column(db.Text, nullable=True)  # Karaoke şarkı sözleri

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'artist': self.artist,
            'genre': self.genre,
            'mood': self.mood,
            'url': self.url,
            'bpm': self.bpm,
            'duration': self.duration,
            'cover_color': self.cover_color,
            'tags': self.tags,
            'license_info': self.license_info,
            'youtube_id': self.youtube_id,
            'lyrics': self.lyrics
        }


class Project(db.Model):
    """Kullanıcının şarkı yazım projeleri"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(120), nullable=False)
    lyrics = db.Column(db.Text, default="")
    beat_id = db.Column(db.Integer, db.ForeignKey('beat.id'), nullable=True)
    
    # Şarkı yönlendirme parametreleri
    energy_level = db.Column(db.String(20), default="mid")  # low, mid, high
    mood = db.Column(db.String(50), default="neutral")  # sad, happy, dark, motivating
    theme = db.Column(db.String(50), default="general")  # love, success, street, dark_past
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # İlişkiler
    beat = db.relationship('Beat', backref='projects')


class Playlist(db.Model):
    """Kullanıcının favori beatleri"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    beat_id = db.Column(db.Integer, db.ForeignKey('beat.id'), nullable=False)
    added_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    beat = db.relationship('Beat', backref='in_playlists')


class ChatHistory(db.Model):
    """Kullanıcı chat geçmişi"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=True)
    role = db.Column(db.String(10), nullable=False)  # user, assistant
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


# ============================================
# KARAOKE ODASI MODELLERİ
# ============================================

class KaraokeRoom(db.Model):
    """Karaoke odası"""
    id = db.Column(db.Integer, primary_key=True)
    room_code = db.Column(db.String(10), unique=True, nullable=False)  # Benzersiz oda kodu
    name = db.Column(db.String(100), nullable=False)
    host_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    beat_id = db.Column(db.Integer, db.ForeignKey('beat.id'), nullable=True)
    max_participants = db.Column(db.Integer, default=8)
    is_active = db.Column(db.Boolean, default=True)
    is_playing = db.Column(db.Boolean, default=False)
    current_time = db.Column(db.Float, default=0.0)  # Beat'in current position
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # YouTube karaoke için yeni alanlar
    youtube_url = db.Column(db.String(500), nullable=True)  # YouTube ses URL'i
    current_song_title = db.Column(db.String(200), nullable=True)  # Şarkı adı
    lyrics = db.Column(db.Text, nullable=True)  # Şarkı sözleri
    
    # İlişkiler
    host = db.relationship('User', backref='hosted_rooms')
    beat = db.relationship('Beat', backref='karaoke_rooms')
    participants = db.relationship('RoomParticipant', backref='room', lazy=True, cascade='all, delete-orphan')


class RoomParticipant(db.Model):
    """Karaoke odası katılımcısı"""
    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.Integer, db.ForeignKey('karaoke_room.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    is_singing = db.Column(db.Boolean, default=False)  # Şu an şarkı söylüyor mu
    is_muted = db.Column(db.Boolean, default=True)  # Mikrofon kapalı mı
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='room_participations')


class RoomMessage(db.Model):
    """Karaoke odası chat mesajları"""
    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.Integer, db.ForeignKey('karaoke_room.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)  # Null = sistem mesajı
    message = db.Column(db.Text, nullable=False)
    message_type = db.Column(db.String(20), default='chat')  # chat, system, join, leave
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='room_messages')


# ============================================
# HELPER FONKSİYONLARI
# ============================================

def generate_token(user_id):
    """JWT token oluştur"""
    payload = {
        'user_id': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(days=30),
        'iat': datetime.now(timezone.utc),
        'jti': str(uuid.uuid4())
    }
    return jwt.encode(payload, app.config["JWT_SECRET_KEY"], algorithm='HS256')

def verify_token(token):
    """JWT token doğrula"""
    try:
        payload = jwt.decode(token, app.config["JWT_SECRET_KEY"], algorithms=['HS256'])
        return payload['user_id']
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def get_user_from_token():
    """Request header'dan token al ve kullanıcıyı bul"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    
    token = auth_header.split(' ')[1]
    user_id = verify_token(token)
    if not user_id:
        return None
    
    return db.session.get(User, user_id)

def api_login_required(f):
    """API endpoint'leri için JWT doğrulama decorator'ı"""
    @wraps(f)
    def wrap(*args, **kwargs):
        user = get_user_from_token()
        if not user:
            return jsonify({'error': 'Yetkilendirme gerekli'}), 401
        request.current_user = user
        return f(*args, **kwargs)
    return wrap

def get_current_user():
    uid = session.get("user_id")
    if not uid:
        return None
    return db.session.get(User, uid)

def get_current_username():
    user = get_current_user()
    return user.username if user else None

def login_required(f):
    @wraps(f)
    def wrap(*args, **kwargs):
        if not session.get("user_id"):
            return redirect(url_for("login", next=request.path))
        return f(*args, **kwargs)
    return wrap

# ============================================
# API ENDPOINTS - React Frontend için
# ============================================

@app.route("/api/auth/register", methods=["POST"])
def api_register():
    """API: Yeni kullanıcı kaydı"""
    data = request.get_json()
    
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')
    full_name = data.get('full_name', '').strip()
    
    # Validasyon
    if not username or not email or not password:
        return jsonify({'error': 'Tüm alanlar zorunludur'}), 400
    
    if len(password) < 6:
        return jsonify({'error': 'Şifre en az 6 karakter olmalı'}), 400
    
    if len(username) < 3:
        return jsonify({'error': 'Kullanıcı adı en az 3 karakter olmalı'}), 400
    
    # Email formatı kontrolü
    if '@' not in email or '.' not in email:
        return jsonify({'error': 'Geçerli bir e-posta adresi girin'}), 400
    
    # Mevcut kullanıcı kontrolü
    existing = User.query.filter(
        (User.username == username) | (User.email == email)
    ).first()
    
    if existing:
        if existing.username == username:
            return jsonify({'error': 'Bu kullanıcı adı zaten kullanılıyor'}), 400
        else:
            return jsonify({'error': 'Bu e-posta zaten kullanılıyor'}), 400
    
    # Yeni kullanıcı oluştur
    user = User(
        username=username,
        email=email,
        full_name=full_name
    )
    user.set_password(password)
    
    db.session.add(user)
    db.session.commit()
    
    # Token oluştur
    token = generate_token(user.id)
    
    return jsonify({
        'message': 'Kayıt başarılı!',
        'token': token,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'full_name': user.full_name,
            'avatar_color': user.avatar_color,
            'bio': user.bio,
            'favorite_genre': user.favorite_genre
        }
    }), 201


@app.route("/api/auth/login", methods=["POST"])
def api_login():
    """API: Kullanıcı girişi"""
    data = request.get_json()
    
    username_or_email = data.get('username_or_email', '').strip()
    password = data.get('password', '')
    
    if not username_or_email or not password:
        return jsonify({'error': 'Kullanıcı adı ve şifre gerekli'}), 400
    
    user = User.query.filter(
        (User.username == username_or_email) |
        (User.email == username_or_email)
    ).first()
    
    if not user or not user.check_password(password):
        return jsonify({'error': 'Kullanıcı adı veya şifre hatalı'}), 401
    
    # Son giriş tarihini güncelle
    user.last_login = datetime.now(timezone.utc)
    db.session.commit()
    
    # Token oluştur
    token = generate_token(user.id)
    
    return jsonify({
        'message': 'Giriş başarılı!',
        'token': token,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'full_name': user.full_name,
            'avatar_color': user.avatar_color,
            'bio': user.bio,
            'favorite_genre': user.favorite_genre
        }
    })


@app.route("/api/auth/me", methods=["GET"])
@api_login_required
def api_get_me():
    """API: Mevcut kullanıcı bilgileri"""
    user = request.current_user
    return jsonify({
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'full_name': user.full_name,
            'avatar_color': user.avatar_color,
            'bio': user.bio,
            'favorite_genre': user.favorite_genre,
            'created_at': user.created_at.isoformat() if user.created_at else None,
            'last_login': user.last_login.isoformat() if user.last_login else None
        }
    })


@app.route("/api/auth/logout", methods=["POST"])
@api_login_required
def api_logout():
    """API: Çıkış yap"""
    return jsonify({'message': 'Çıkış başarılı'})


@app.route("/api/auth/google-simulate", methods=["POST"])
def api_google_simulate():
    """Google OAuth simülasyonu - seçilen hesapla giriş/kayıt"""
    data = request.get_json()
    google_email = data.get('email', '').strip()
    google_name = data.get('name', '').strip()
    google_avatar = data.get('avatar', '')

    if not google_email:
        return jsonify({'error': 'E-posta gerekli'}), 400

    # Kullanıcı var mı kontrol et
    user = User.query.filter_by(email=google_email).first()

    if not user:
        # Yeni kullanıcı oluştur
        base_username = google_email.split('@')[0].replace('.', '_').replace('-', '_')
        username = base_username
        counter = 1
        while User.query.filter_by(username=username).first():
            username = f"{base_username}{counter}"
            counter += 1

        colors = ['#ff146a', '#4AADE8', '#9b59b6', '#2ecc71', '#f39c12', '#e74c3c']
        avatar_color = random.choice(colors)

        user = User(
            username=username,
            email=google_email,
            full_name=google_name,
            password_hash=generate_password_hash(str(uuid.uuid4())),
            avatar_color=avatar_color,
            bio='Google ile kayıt oldum'
        )
        db.session.add(user)
        db.session.commit()

    user.last_login = datetime.now(timezone.utc)
    db.session.commit()

    token = generate_token(user.id)

    return jsonify({
        'message': 'Google ile giriş başarılı!',
        'token': token,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'full_name': user.full_name,
            'avatar_color': user.avatar_color,
            'bio': user.bio,
            'favorite_genre': user.favorite_genre
        }
    })


@app.route("/api/auth/profile", methods=["PUT"])
@api_login_required
def api_update_profile():
    """API: Profil güncelle"""
    user = request.current_user
    data = request.get_json()
    
    if 'username' in data:
        new_username = data['username'].strip()
        if new_username and new_username != user.username:
            existing = User.query.filter(User.username == new_username).first()
            if existing:
                return jsonify({'error': 'Bu kullanıcı adı zaten kullanılıyor'}), 400
            user.username = new_username
    
    if 'email' in data:
        new_email = data['email'].strip()
        if new_email and new_email != user.email:
            existing = User.query.filter(User.email == new_email).first()
            if existing:
                return jsonify({'error': 'Bu e-posta zaten kullanılıyor'}), 400
            user.email = new_email
    
    if 'full_name' in data:
        user.full_name = data['full_name'].strip()
    
    if 'bio' in data:
        user.bio = data['bio']
    
    if 'avatar_color' in data:
        user.avatar_color = data['avatar_color']
    
    if 'favorite_genre' in data:
        user.favorite_genre = data['favorite_genre']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Profil güncellendi',
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'full_name': user.full_name,
            'avatar_color': user.avatar_color,
            'bio': user.bio,
            'favorite_genre': user.favorite_genre
        }
    })


@app.route("/api/auth/password", methods=["PUT"])
@api_login_required
def api_change_password():
    """API: Şifre değiştir"""
    user = request.current_user
    data = request.get_json()
    
    current_password = data.get('current_password', '')
    new_password = data.get('new_password', '')
    
    if not user.check_password(current_password):
        return jsonify({'error': 'Mevcut şifre hatalı'}), 400
    
    if len(new_password) < 6:
        return jsonify({'error': 'Yeni şifre en az 6 karakter olmalı'}), 400
    
    user.set_password(new_password)
    db.session.commit()
    
    return jsonify({'message': 'Şifre başarıyla değiştirildi'})


@app.route("/api/beats", methods=["GET"])
def api_get_beats():
    """API: Tüm beatleri getir"""
    genre = request.args.get('genre')
    mood = request.args.get('mood')
    
    query = Beat.query
    
    if genre and genre != 'Tümü':
        query = query.filter_by(genre=genre)
    
    if mood and mood != 'Tümü':
        query = query.filter_by(mood=mood)
    
    beats = query.all()
    
    # Tüm mevcut türleri ve mood'ları al
    all_genres = db.session.query(Beat.genre).distinct().all()
    all_moods = db.session.query(Beat.mood).distinct().all()
    genres = ['Tümü'] + [g[0] for g in all_genres if g[0]]
    moods = ['Tümü'] + [m[0] for m in all_moods if m[0]]
    
    return jsonify({
        'beats': [{
            'id': b.id,
            'name': b.name,
            'artist': b.artist,
            'genre': b.genre,
            'mood': b.mood,
            'url': b.url,
            'bpm': b.bpm,
            'duration': b.duration,
            'cover_color': b.cover_color,
            'tags': b.tags,
            'license_info': b.license_info,
            'youtube_id': b.youtube_id,
            'lyrics': b.lyrics
        } for b in beats],
        'genres': genres,
        'moods': moods
    })


@app.route("/api/beats/<int:beat_id>", methods=["GET"])
def api_get_beat(beat_id):
    """API: Tek beat getir"""
    beat = db.session.get(Beat, beat_id)
    if not beat:
        return jsonify({'error': 'Beat bulunamadı'}), 404
    
    return jsonify({
        'beat': {
            'id': beat.id,
            'name': beat.name,
            'artist': beat.artist,
            'genre': beat.genre,
            'mood': beat.mood,
            'url': beat.url,
            'bpm': beat.bpm,
            'duration': beat.duration,
            'cover_color': beat.cover_color,
            'tags': beat.tags,
            'license_info': beat.license_info,
            'youtube_id': beat.youtube_id
        }
    })


@app.route("/api/songs", methods=["GET"])
def api_get_songs():
    """API: Tüm şarkıları getir"""
    genre = request.args.get('genre')
    
    query = Song.query
    
    if genre and genre != 'Tümü':
        query = query.filter_by(genre=genre)
    
    songs = query.all()
    
    # Tüm mevcut türleri al
    all_genres = db.session.query(Song.genre).distinct().all()
    genres = ['Tümü'] + [g[0] for g in all_genres if g[0]]
    
    return jsonify({
        'songs': [{
            'id': s.id,
            'title': s.title,
            'artist': s.artist,
            'genre': s.genre,
            'url': s.url,
            'avg_rating': s.avg_rating,
            'rating_count': s.rating_count
        } for s in songs],
        'genres': genres
    })


@app.route("/api/songs/top", methods=["GET"])
def api_get_top_songs():
    """API: En çok beğenilen şarkılar"""
    songs = Song.query.filter(Song.rating_count > 0).all()
    sorted_songs = sorted(songs, key=lambda s: s.avg_rating, reverse=True)[:10]
    
    return jsonify({
        'songs': [{
            'id': s.id,
            'title': s.title,
            'artist': s.artist,
            'genre': s.genre,
            'url': s.url,
            'avg_rating': s.avg_rating,
            'rating_count': s.rating_count
        } for s in sorted_songs]
    })


@app.route("/api/projects", methods=["GET"])
@api_login_required
def api_get_projects():
    """API: Kullanıcının projelerini getir"""
    user = request.current_user
    projects = Project.query.filter_by(user_id=user.id).order_by(Project.updated_at.desc()).all()
    
    return jsonify({
        'projects': [{
            'id': p.id,
            'title': p.title,
            'lyrics': p.lyrics,
            'beat_id': p.beat_id,
            'energy_level': p.energy_level,
            'mood': p.mood,
            'theme': p.theme,
            'created_at': p.created_at.isoformat() if p.created_at else None,
            'updated_at': p.updated_at.isoformat() if p.updated_at else None
        } for p in projects]
    })


@app.route("/api/projects", methods=["POST"])
@api_login_required
def api_create_project():
    """API: Yeni proje oluştur"""
    user = request.current_user
    data = request.get_json()
    
    project = Project(
        user_id=user.id,
        title=data.get('title', 'Yeni Proje'),
        lyrics=data.get('lyrics', ''),
        beat_id=data.get('beat_id'),
        energy_level=data.get('energy_level', 'mid'),
        mood=data.get('mood', 'neutral'),
        theme=data.get('theme', 'general')
    )
    
    db.session.add(project)
    db.session.commit()
    
    return jsonify({
        'message': 'Proje oluşturuldu',
        'project': {
            'id': project.id,
            'title': project.title,
            'lyrics': project.lyrics,
            'beat_id': project.beat_id,
            'created_at': project.created_at.isoformat() if project.created_at else None
        }
    }), 201


@app.route("/api/projects/<int:project_id>", methods=["PUT"])
@api_login_required
def api_update_project(project_id):
    """API: Proje güncelle"""
    user = request.current_user
    project = Project.query.filter_by(id=project_id, user_id=user.id).first()
    
    if not project:
        return jsonify({'error': 'Proje bulunamadı'}), 404
    
    data = request.get_json()
    
    if 'title' in data:
        project.title = data['title']
    if 'lyrics' in data:
        project.lyrics = data['lyrics']
    if 'beat_id' in data:
        project.beat_id = data['beat_id']
    if 'energy_level' in data:
        project.energy_level = data['energy_level']
    if 'mood' in data:
        project.mood = data['mood']
    if 'theme' in data:
        project.theme = data['theme']
    
    project.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    
    return jsonify({
        'message': 'Proje güncellendi',
        'project': {
            'id': project.id,
            'title': project.title,
            'lyrics': project.lyrics,
            'beat_id': project.beat_id,
            'updated_at': project.updated_at.isoformat() if project.updated_at else None
        }
    })


@app.route("/api/projects/<int:project_id>", methods=["DELETE"])
@api_login_required
def api_delete_project(project_id):
    """API: Proje sil"""
    user = request.current_user
    project = Project.query.filter_by(id=project_id, user_id=user.id).first()
    
    if not project:
        return jsonify({'error': 'Proje bulunamadı'}), 404
    
    db.session.delete(project)
    db.session.commit()
    
    return jsonify({'message': 'Proje silindi'})


@app.route("/api/playlist", methods=["GET"])
@api_login_required
def api_get_playlist():
    """API: Kullanıcının çalma listesini getir"""
    user = request.current_user
    playlist = Playlist.query.filter_by(user_id=user.id).order_by(Playlist.added_at.desc()).all()
    
    return jsonify({
        'playlist': [{
            'id': p.id,
            'beat_id': p.beat_id,
            'beat': {
                'id': p.beat.id,
                'name': p.beat.name,
                'artist': p.beat.artist,
                'genre': p.beat.genre,
                'url': p.beat.url,
                'bpm': p.beat.bpm,
                'cover_color': p.beat.cover_color
            } if p.beat else None,
            'added_at': p.added_at.isoformat() if p.added_at else None
        } for p in playlist]
    })


@app.route("/api/playlist/add", methods=["POST"])
@api_login_required
def api_add_to_playlist():
    """API: Çalma listesine beat ekle"""
    user = request.current_user
    data = request.get_json()
    beat_id = data.get('beat_id')
    
    if not beat_id:
        return jsonify({'error': 'Beat ID gerekli'}), 400
    
    # Zaten eklendi mi kontrol et
    existing = Playlist.query.filter_by(user_id=user.id, beat_id=beat_id).first()
    if existing:
        return jsonify({'error': 'Bu beat zaten listende'}), 400
    
    # Beat var mı kontrol et
    beat = db.session.get(Beat, beat_id)
    if not beat:
        return jsonify({'error': 'Beat bulunamadı'}), 404
    
    playlist_item = Playlist(user_id=user.id, beat_id=beat_id)
    db.session.add(playlist_item)
    db.session.commit()
    
    return jsonify({'message': 'Beat listeye eklendi'}), 201


@app.route("/api/playlist/remove", methods=["POST"])
@api_login_required
def api_remove_from_playlist():
    """API: Çalma listesinden beat çıkar"""
    user = request.current_user
    data = request.get_json()
    beat_id = data.get('beat_id')
    
    if not beat_id:
        return jsonify({'error': 'Beat ID gerekli'}), 400
    
    playlist_item = Playlist.query.filter_by(user_id=user.id, beat_id=beat_id).first()
    if not playlist_item:
        return jsonify({'error': 'Beat listende yok'}), 404
    
    db.session.delete(playlist_item)
    db.session.commit()
    
    return jsonify({'message': 'Beat listeden çıkarıldı'})


# ============================================
# ANA SAYFALAR
# ============================================

@app.route("/")
def home():
    """Landing page - Giriş yapmamışsa login'e yönlendir"""
    if session.get("user_id"):
        return redirect(url_for("index"))
    return redirect(url_for("login"))


@app.route("/discover")
def index():
    """Ana keşfet sayfası"""
    genres = ["Tümü", "Pop", "Rap", "Rock", "Lo-fi", "Chill", "Elektronik", "Arabesk", "Jazz"]
    active_genre = request.args.get("genre", "Tümü")

    if active_genre == "Tümü":
        songs = Song.query.all()
    else:
        songs = Song.query.filter_by(genre=active_genre).all()

    all_songs = Song.query.all()
    rated = [s for s in all_songs if s.rating_count > 0]
    top5 = sorted(rated, key=lambda s: s.avg_rating, reverse=True)[:5]

    return render_template(
        "index.html",
        title="FONIX – Keşfet",
        genres=genres,
        active_genre=active_genre,
        songs=songs,
        top5=top5,
        current_user=get_current_username(),
    )


# ============================================
# KULLANICI YÖNETİMİ
# ============================================

@app.route("/register", methods=["GET", "POST"])
def register():
    if session.get("user_id"):
        return redirect(url_for("index"))

    error = None
    if request.method == "POST":
        full_name = request.form.get("full_name", "").strip()
        username = request.form.get("username", "").strip()
        email = request.form.get("email", "").strip()
        password = request.form.get("password", "")
        confirm = request.form.get("confirm", "")

        if not (username and email and password):
            error = "Tüm alanlar zorunlu."
        elif password != confirm:
            error = "Şifreler uyuşmuyor."
        elif len(password) < 6:
            error = "Şifre en az 6 karakter olmalı."
        elif len(username) < 3:
            error = "Kullanıcı adı en az 3 karakter olmalı."
        else:
            existing = User.query.filter(
                (User.username == username) | (User.email == email)
            ).first()
            if existing:
                error = "Bu kullanıcı adı veya e-posta zaten kullanılıyor."
            else:
                u = User(username=username, email=email, full_name=full_name)
                u.set_password(password)
                db.session.add(u)
                db.session.commit()
                session["user_id"] = u.id
                flash("Hesabınız başarıyla oluşturuldu! Hoş geldiniz.", "success")
                return redirect(url_for("index"))

    return render_template(
        "register.html",
        title="FONIX – Kayıt Ol",
        error=error,
        current_user=get_current_username(),
    )


@app.route("/login", methods=["GET", "POST"])
def login():
    if session.get("user_id"):
        return redirect(url_for("index"))

    error = None
    if request.method == "POST":
        username_or_email = request.form.get("username_or_email", "").strip()
        password = request.form.get("password", "")
        remember = request.form.get("remember", False)

        user = User.query.filter(
            (User.username == username_or_email) |
            (User.email == username_or_email)
        ).first()

        if not user or not user.check_password(password):
            error = "Kullanıcı veya şifre hatalı."
        else:
            session["user_id"] = user.id
            session["username"] = user.username
            
            # Son giriş tarihini güncelle
            user.last_login = datetime.utcnow()
            db.session.commit()
            
            if remember:
                session.permanent = True
            
            flash(f"Hoş geldin {user.username}! 🎵", "success")
            next_url = request.args.get("next")
            return redirect(next_url or url_for("index"))

    return render_template(
        "login.html",
        title="FONIX – Giriş Yap",
        error=error,
        current_user=get_current_username(),
    )


@app.route("/logout")
def logout():
    session.pop("user_id", None)
    return redirect(url_for("login"))


@app.route("/forgot-password", methods=["GET", "POST"])
def forgot_password():
    """Şifre sıfırlama sayfası"""
    message = None
    error = None
    
    if request.method == "POST":
        email = request.form.get("email", "").strip()
        new_password = request.form.get("new_password", "")
        confirm_password = request.form.get("confirm_password", "")
        
        if not email:
            error = "E-posta adresi gerekli."
        else:
            user = User.query.filter_by(email=email).first()
            
            if not user:
                error = "Bu e-posta adresiyle kayıtlı kullanıcı bulunamadı."
            elif not new_password or len(new_password) < 6:
                error = "Şifre en az 6 karakter olmalıdır."
            elif new_password != confirm_password:
                error = "Şifreler eşleşmiyor."
            else:
                user.set_password(new_password)
                db.session.commit()
                message = "Şifreniz başarıyla güncellendi! Şimdi giriş yapabilirsiniz."
    
    return render_template(
        "forgot_password.html",
        title="FONIX – Şifremi Unuttum",
        message=message,
        error=error,
        current_user=get_current_username(),
    )


@app.route("/profile", methods=["GET", "POST"])
@login_required
def profile():
    """Kullanıcı profil sayfası"""
    user = get_current_user()
    
    if request.method == "POST":
        action = request.form.get("action")
        
        if action == "update_profile":
            user.username = request.form.get("username", user.username)
            user.email = request.form.get("email", user.email)
            db.session.commit()
            flash("Profil güncellendi!", "success")
        
        elif action == "change_password":
            current = request.form.get("current_password")
            new_pass = request.form.get("new_password")
            confirm = request.form.get("confirm_password")
            
            if user.check_password(current):
                if new_pass == confirm and len(new_pass) >= 6:
                    user.set_password(new_pass)
                    db.session.commit()
                    flash("Şifre güncellendi!", "success")
                else:
                    flash("Şifreler eşleşmiyor veya çok kısa!", "error")
            else:
                flash("Mevcut şifre hatalı!", "error")
        
        return redirect(url_for("profile"))
    
    projects = Project.query.filter_by(user_id=user.id).order_by(Project.updated_at.desc()).all()
    playlist = Playlist.query.filter_by(user_id=user.id).order_by(Playlist.added_at.desc()).all()
    songs_count = Song.query.count()  # Toplam şarkı sayısı (kullanıcıya özel değil)
    
    return render_template(
        "profile.html",
        title="FONIX – Profilim",
        user=user,
        projects=projects,
        playlist=playlist,
        songs_count=songs_count,
        current_user=get_current_username(),
    )


# ============================================
# ŞARKI İŞLEMLERİ
# ============================================

@app.route("/add", methods=["GET", "POST"])
def add_song():
    error = None
    if request.method == "POST":
        title = request.form.get("title", "").strip()
        artist = request.form.get("artist", "").strip()
        genre = request.form.get("genre", "Diğer").strip() or "Diğer"
        url = request.form.get("url", "").strip()

        if not (title and artist and url):
            error = "Şarkı adı, sanatçı ve URL zorunlu."
        else:
            s = Song(title=title, artist=artist, genre=genre, url=url)
            db.session.add(s)
            db.session.commit()
            return redirect(url_for("index"))

    return render_template(
        "add_song.html",
        title="FONIX – Şarkı Ekle",
        error=error,
        current_user=get_current_username(),
    )


@app.route("/rate/<int:song_id>", methods=["POST"])
def rate_song(song_id):
    rating = int(request.form.get("rating", "0"))
    if rating < 1 or rating > 5:
        return redirect(url_for("index"))
    song = Song.query.get_or_404(song_id)
    song.rating_sum += rating
    song.rating_count += 1
    db.session.commit()
    return redirect(request.referrer or url_for("index"))


@app.route("/top")
def top_page():
    all_songs = Song.query.all()
    rated = [s for s in all_songs if s.rating_count > 0]
    top10 = sorted(rated, key=lambda s: s.avg_rating, reverse=True)[:10]

    return render_template(
        "top.html",
        songs=top10,
        current_user=get_current_username()
    )


# ============================================
# KAYIT STÜDYOSU
# ============================================

@app.route("/studio")
def studio():
    """Kayıt stüdyosu sayfası - Beat üzerine ses kaydı"""
    beats = Beat.query.all()
    return render_template(
        "studio.html",
        title="FONIX – Kayıt Stüdyosu",
        beats=beats,
        current_user=get_current_username(),
    )


# ============================================
# MİXER - FL STUDIO BENZERİ
# ============================================

@app.route("/mixer")
def mixer_page():
    """Mixer sayfası - Kayıtları beatlerle birleştir"""
    beats = Beat.query.all()
    return render_template(
        "mixer.html",
        title="FONIX – Mixer",
        beats=beats,
        current_user=get_current_username(),
    )


# ============================================
# BEAT KEŞİF VE ÖNERİ SİSTEMİ
# ============================================

@app.route("/beats")
def beats_page():
    """Beat keşif sayfası - filtreleme ve öneri sistemi"""
    genre_filter = request.args.get("genre", "Tümü")
    mood_filter = request.args.get("mood", "Tümü")
    bpm_filter = request.args.get("bpm", "")
    search_query = request.args.get("q", "").strip()
    
    genres = ["Tümü", "Melodic Trap", "Dark Trap", "Drill", "Hip-Hop", "Lo-fi", "Chill", "Electronic", "Synthwave"]
    moods = ["Tümü", "sad", "emotional", "hyper", "dark", "chill", "energetic"]
    
    # Base query
    query = Beat.query
    
    # Filtreleri uygula
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
    
    return render_template(
        "beats.html",
        title="FONIX – Free Beats",
        beats=beats,
        genres=genres,
        moods=moods,
        active_genre=genre_filter,
        active_mood=mood_filter,
        search_query=search_query,
        current_user=get_current_username(),
    )


@app.route("/api/beat-recommend", methods=["POST"])
def recommend_beats():
    """Söze göre beat öneri API"""
    data = request.get_json() or {}
    lyrics = data.get("lyrics", "").lower()
    current_mood = data.get("mood", "")
    current_energy = data.get("energy", "mid")
    
    # Söz analizi
    analysis = analyze_lyrics(lyrics)
    
    # Beat filtreleme
    query = Beat.query
    
    # Mood eşleştirme
    if analysis["mood"]:
        query = query.filter_by(mood=analysis["mood"])
    elif current_mood:
        query = query.filter_by(mood=current_mood)
    
    # BPM önerisi (enerji seviyesine göre)
    if current_energy == "low":
        query = query.filter(Beat.bpm.between(60, 90))
    elif current_energy == "high":
        query = query.filter(Beat.bpm.between(130, 180))
    else:
        query = query.filter(Beat.bpm.between(90, 130))
    
    # Genre önerisi
    if analysis["genre"]:
        matching_beats = query.filter_by(genre=analysis["genre"]).limit(5).all()
        if not matching_beats:
            matching_beats = query.limit(5).all()
    else:
        matching_beats = query.limit(5).all()
    
    return jsonify({
        "analysis": analysis,
        "beats": [
            {
                "id": b.id,
                "name": b.name,
                "artist": b.artist,
                "genre": b.genre,
                "mood": b.mood,
                "bpm": b.bpm,
                "url": b.url,
                "cover_color": b.cover_color
            } for b in matching_beats
        ]
    })


def analyze_lyrics(lyrics):
    """Şarkı sözlerini analiz et - mood, tema, genre öner"""
    
    # Mood keywords
    sad_keywords = ["hüzün", "ağla", "gözyaş", "ayrılık", "yalnız", "kayıp", "acı", "özlem", "geçmiş", "bırak"]
    dark_keywords = ["karanlık", "gece", "sokak", "düşman", "kan", "ölüm", "savaş", "nefret", "intikam"]
    energetic_keywords = ["güç", "zafer", "başarı", "koş", "uç", "patlat", "zirve", "şampiyon", "enerji"]
    love_keywords = ["aşk", "sev", "kalp", "gözler", "dudak", "sarıl", "öp", "sensiz", "seninle"]
    chill_keywords = ["sakin", "huzur", "rüya", "yavaş", "dinlen", "kahve", "gece", "yağmur"]
    
    # Genre keywords
    trap_keywords = ["para", "flex", "drip", "gang", "squad", "trap", "bass", "808"]
    drill_keywords = ["ops", "slide", "mask", "block", "zone", "drill"]
    lofi_keywords = ["chill", "relax", "study", "vibes", "peaceful", "lo-fi"]
    
    mood = "neutral"
    genre = None
    theme = "general"
    
    # Mood detection
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
    
    # Genre detection
    trap_count = sum(1 for word in trap_keywords if word in lyrics)
    drill_count = sum(1 for word in drill_keywords if word in lyrics)
    lofi_count = sum(1 for word in lofi_keywords if word in lyrics)
    
    genre_counts = {"Melodic Trap": trap_count, "Drill": drill_count, "Lo-fi": lofi_count}
    if max(genre_counts.values()) > 0:
        genre = max(genre_counts, key=genre_counts.get)
    
    # Theme detection
    if love_count > 2:
        theme = "love"
    elif dark_count > 2:
        theme = "dark_past"
    elif energetic_count > 2:
        theme = "success"
    
    # Determine energy level
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


# ============================================
# SÖZ YAZIM EDİTÖRÜ VE CHATBOX
# ============================================

@app.route("/lyrics", methods=["GET", "POST"])
def lyrics_page():
    """Şarkı sözü yazım editörü"""
    audio_url = None
    error = None
    project = None
    
    # Mevcut proje varsa yükle
    project_id = request.args.get("project_id")
    if project_id and session.get("user_id"):
        project = Project.query.filter_by(id=project_id, user_id=session["user_id"]).first()
    
    if request.method == "POST":
        action = request.form.get("action", "generate")
        lyrics_text = request.form.get("lyrics", "").strip()
        
        if action == "save" and session.get("user_id"):
            # Proje kaydet
            title = request.form.get("project_title", "Adsız Proje")
            energy = request.form.get("energy", "mid")
            mood = request.form.get("mood", "neutral")
            theme = request.form.get("theme", "general")
            beat_id = request.form.get("beat_id")
            
            if project:
                project.lyrics = lyrics_text
                project.title = title
                project.energy_level = energy
                project.mood = mood
                project.theme = theme
                if beat_id:
                    project.beat_id = int(beat_id)
            else:
                project = Project(
                    user_id=session["user_id"],
                    title=title,
                    lyrics=lyrics_text,
                    energy_level=energy,
                    mood=mood,
                    theme=theme,
                    beat_id=int(beat_id) if beat_id else None
                )
                db.session.add(project)
            
            db.session.commit()
            flash("Proje başarıyla kaydedildi!", "success")
            return redirect(url_for("lyrics_page", project_id=project.id))
        
        elif action == "generate":
            if not lyrics_text:
                error = "Lütfen söz giriniz."
            else:
                # Beat ile birleştirme işlemi
                try:
                    from gtts import gTTS
                    import glob
                    
                    # TTS ile seslendirme
                    tts = gTTS(lyrics_text, lang="tr")
                    tts_path = os.path.join("static", "uploads", f"tts_{random.randint(10000,99999)}.mp3")
                    os.makedirs(os.path.dirname(tts_path), exist_ok=True)
                    tts.save(tts_path)
                    audio_url = "/" + tts_path.replace("\\", "/")

                    # Beat ile birleştirmeyi dene (FFmpeg gerekli)
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
                        # FFmpeg yoksa sadece TTS dosyası kullan
                        pass
                        
                except Exception as e:
                    error = f"Ses oluşturma hatası: {str(e)}"

    # Tüm beatleri çek
    all_beats = Beat.query.all()
    
    return render_template(
        "lyrics.html",
        audio_url=audio_url,
        error=error,
        project=project,
        beats=all_beats,
        current_user=get_current_username()
    )


@app.route("/api/chat", methods=["POST"])
def chat_api():
    """ChatBox API - Şarkı yazım asistanı"""
    data = request.get_json() or {}
    message = data.get("message", "").strip()
    context = data.get("context", {})
    
    if not message:
        return jsonify({"error": "Mesaj boş olamaz"}), 400
    
    # Kullanıcı mesajını kaydet
    if session.get("user_id"):
        chat = ChatHistory(
            user_id=session["user_id"],
            project_id=context.get("project_id"),
            role="user",
            message=message
        )
        db.session.add(chat)
    
    # Yanıt oluştur
    response = generate_chat_response(message, context)
    
    # Yanıtı kaydet
    if session.get("user_id"):
        chat = ChatHistory(
            user_id=session["user_id"],
            project_id=context.get("project_id"),
            role="assistant",
            message=response
        )
        db.session.add(chat)
        db.session.commit()
    
    return jsonify({"response": response})


def generate_chat_response(message, context):
    """Chat yanıtı oluştur - Gelişmiş AI asistan"""
    msg = message.lower()
    current_genre = context.get("genre", "trap")
    current_lyrics = context.get("lyrics", "")
    
    # Söz yazma isteği
    if any(word in msg for word in ["söz yaz", "şarkı yaz", "verse yaz", "nakarat yaz", "tekrar yaz"]):
        return generate_lyrics_response(msg, current_genre, context)
    
    # Kafiye önerisi
    if any(word in msg for word in ["kafiye", "uyak", "rhyme"]):
        return generate_rhyme_suggestions(msg, current_lyrics)
    
    # Tema önerileri
    if any(word in msg for word in ["tema", "konu", "fikir"]):
        return generate_theme_suggestions(msg)
    
    # Flow ve ritim
    if any(word in msg for word in ["flow", "ritim", "tempo"]):
        return generate_flow_tips(context)
    
    # Duygusal ton
    if any(word in msg for word in ["duygusal", "sert", "mutlu", "üzgün", "karanlık", "motive"]):
        return adjust_tone_suggestion(msg)
    
    # Nakarat yapısı
    if any(word in msg for word in ["nakarat", "hook", "chorus"]):
        return generate_hook_tips()
    
    # Verse yapısı
    if any(word in msg for word in ["verse", "dörtlük", "kıta"]):
        return generate_verse_structure()
    
    # Genel yardım
    return get_default_help()


def generate_lyrics_response(msg, genre, context):
    """Şarkı sözü üret"""
    
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
    
    # Genre'a göre sözler seç
    genre_key = genre.lower().replace("-", " ")
    pool = LYRICS_DB.get(genre_key, LYRICS_DB.get('melodic trap'))
    
    # Nakarat mı verse mi?
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
    """Kafiye önerileri"""
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
    """Tema önerileri"""
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
    """Flow ve ritim ipuçları"""
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
    """Duygusal ton önerileri"""
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
    """Nakarat yazım ipuçları"""
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
    """Verse yapısı önerileri"""
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
    """Varsayılan yardım mesajı"""
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
# PROJE YÖNETİMİ
# ============================================

@app.route("/projects")
@login_required
def projects_page():
    """Kullanıcının projeleri"""
    user = get_current_user()
    projects = Project.query.filter_by(user_id=user.id).order_by(Project.updated_at.desc()).all()
    
    return render_template(
        "projects.html",
        title="FONIX – Projelerim",
        projects=projects,
        current_user=get_current_username()
    )


@app.route("/project/<int:project_id>")
@login_required
def project_detail(project_id):
    """Proje detay sayfası"""
    project = Project.query.filter_by(id=project_id, user_id=session["user_id"]).first_or_404()
    return redirect(url_for("lyrics_page", project_id=project.id))


@app.route("/api/project/delete/<int:project_id>", methods=["POST"])
@login_required
def delete_project_by_id(project_id):
    """Proje sil - URL parametresi ile"""
    project = Project.query.filter_by(id=project_id, user_id=session["user_id"]).first_or_404()
    db.session.delete(project)
    db.session.commit()
    return jsonify({"success": True})


@app.route("/api/project/delete", methods=["POST"])
@login_required
def delete_project():
    """Proje sil - JSON body ile"""
    data = request.get_json() or {}
    project_id = data.get("project_id")
    if not project_id:
        return jsonify({"success": False, "error": "Proje ID gerekli"}), 400
    
    project = Project.query.filter_by(id=project_id, user_id=session["user_id"]).first()
    if not project:
        return jsonify({"success": False, "error": "Proje bulunamadı"}), 404
    
    db.session.delete(project)
    db.session.commit()
    return jsonify({"success": True})


# ============================================
# PLAYLİST YÖNETİMİ
# ============================================

@app.route("/playlist")
@login_required
def playlist_page():
    """Kullanıcının favori beatleri"""
    user = get_current_user()
    playlist_items = Playlist.query.filter_by(user_id=user.id).order_by(Playlist.added_at.desc()).all()
    
    return render_template(
        "playlist.html",
        title="FONIX – Playlistim",
        playlist=playlist_items,
        current_user=get_current_username()
    )


@app.route("/api/playlist/add/<int:beat_id>", methods=["POST"])
@login_required
def add_to_playlist_by_id(beat_id):
    """Beat'i playlist'e ekle - URL ile"""
    existing = Playlist.query.filter_by(user_id=session["user_id"], beat_id=beat_id).first()
    if not existing:
        item = Playlist(user_id=session["user_id"], beat_id=beat_id)
        db.session.add(item)
        db.session.commit()
    return jsonify({"success": True})


@app.route("/api/playlist/add", methods=["POST"])
@login_required
def add_to_playlist():
    """Beat'i playlist'e ekle - JSON body ile"""
    data = request.get_json() or {}
    beat_id = data.get("beat_id")
    if not beat_id:
        return jsonify({"success": False, "error": "Beat ID gerekli"}), 400
    
    existing = Playlist.query.filter_by(user_id=session["user_id"], beat_id=beat_id).first()
    if existing:
        return jsonify({"success": False, "error": "Beat zaten playlist'te"})
    
    item = Playlist(user_id=session["user_id"], beat_id=beat_id)
    db.session.add(item)
    db.session.commit()
    return jsonify({"success": True})


@app.route("/api/playlist/remove/<int:beat_id>", methods=["POST"])
@login_required
def remove_from_playlist_by_id(beat_id):
    """Beat'i playlist'ten kaldır - URL ile"""
    item = Playlist.query.filter_by(user_id=session["user_id"], beat_id=beat_id).first()
    if item:
        db.session.delete(item)
        db.session.commit()
    return jsonify({"success": True})


@app.route("/api/playlist/remove", methods=["POST"])
@login_required
def remove_from_playlist():
    """Beat'i playlist'ten kaldır - JSON body ile"""
    data = request.get_json() or {}
    beat_id = data.get("beat_id")
    if not beat_id:
        return jsonify({"success": False, "error": "Beat ID gerekli"}), 400
    
    item = Playlist.query.filter_by(user_id=session["user_id"], beat_id=beat_id).first()
    if item:
        db.session.delete(item)
        db.session.commit()
    return jsonify({"success": True})


# ============================================
# ÖNERİLER SAYFASI
# ============================================

@app.route("/recommendations")
def recommendations_page():
    """Kişiselleştirilmiş öneriler"""
    recommended = []
    top_genre = "Melodic Trap"
    
    if session.get("user_id"):
        user = get_current_user()
        
        # Kullanıcının dinlediği beat'lere göre öneri
        playlist_items = Playlist.query.filter_by(user_id=user.id).all()
        favorite_genres = {}
        favorite_moods = {}
        
        for item in playlist_items:
            if item.beat:
                genre = item.beat.genre
                mood = item.beat.mood
                favorite_genres[genre] = favorite_genres.get(genre, 0) + 1
                favorite_moods[mood] = favorite_moods.get(mood, 0) + 1
        
        # En çok dinlenen genre ve mood
        top_genre = max(favorite_genres, key=favorite_genres.get) if favorite_genres else "Melodic Trap"
        top_mood = max(favorite_moods, key=favorite_moods.get) if favorite_moods else "neutral"
        
        # Önerilen beatler
        recommended = Beat.query.filter(
            (Beat.genre == top_genre) | (Beat.mood == top_mood)
        ).limit(10).all()
    
    # Genel popüler beatler
    if not recommended:
        recommended = Beat.query.order_by(Beat.id.desc()).limit(10).all()
    
    return render_template(
        "recommendations.html",
        title="FONIX – Öneriler",
        recommended_beats=recommended,
        top_genre=top_genre,
        current_user=get_current_username()
    )


# ============================================
# SEED DATA
# ============================================

def seed_beats():
    """JSON'dan beat verilerini yükle"""
    if Beat.query.count() > 0:
        Beat.query.delete()
    
    try:
        if not os.path.exists('extracted_beats.json'):
            print("⚠️ extracted_beats.json not found!")
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
        print(f"[OK] {count} beat yuklendi!")

    except Exception as e:
        print(f"[HATA] Beat yukleme hatasi: {e}")
        create_sample_beats()


def create_sample_beats():
    """Örnek beat verileri oluştur - YouTube ücretsiz beatler"""
    sample_beats = [
        # Melodic Trap
        {"name": "Midnight Dreams", "genre": "Melodic Trap", "mood": "emotional", "bpm": 140},
        {"name": "Purple Rain", "genre": "Melodic Trap", "mood": "sad", "bpm": 135},
        {"name": "Lost In Paradise", "genre": "Melodic Trap", "mood": "emotional", "bpm": 142},
        {"name": "Starlight", "genre": "Melodic Trap", "mood": "emotional", "bpm": 138},
        {"name": "Heaven's Gate", "genre": "Melodic Trap", "mood": "sad", "bpm": 145},
        {"name": "Moonwalk", "genre": "Melodic Trap", "mood": "chill", "bpm": 132},
        {"name": "Teardrops", "genre": "Melodic Trap", "mood": "sad", "bpm": 140},
        {"name": "Crystal Waves", "genre": "Melodic Trap", "mood": "emotional", "bpm": 136},
        
        # Dark Trap  
        {"name": "Dark Alley", "genre": "Dark Trap", "mood": "dark", "bpm": 145},
        {"name": "Nightmare", "genre": "Dark Trap", "mood": "dark", "bpm": 148},
        {"name": "Shadow Realm", "genre": "Dark Trap", "mood": "dark", "bpm": 150},
        {"name": "Demons Inside", "genre": "Dark Trap", "mood": "dark", "bpm": 143},
        {"name": "Black Heart", "genre": "Dark Trap", "mood": "dark", "bpm": 147},
        {"name": "Underworld", "genre": "Dark Trap", "mood": "dark", "bpm": 152},
        {"name": "Evil Twin", "genre": "Dark Trap", "mood": "dark", "bpm": 146},
        {"name": "Sinister", "genre": "Dark Trap", "mood": "dark", "bpm": 149},
        
        # Drill
        {"name": "London Drill", "genre": "Drill", "mood": "energetic", "bpm": 140},
        {"name": "Block Heat", "genre": "Drill", "mood": "energetic", "bpm": 142},
        {"name": "Streets Talking", "genre": "Drill", "mood": "energetic", "bpm": 138},
        {"name": "Slide", "genre": "Drill", "mood": "dark", "bpm": 145},
        {"name": "Brooklyn Nights", "genre": "Drill", "mood": "energetic", "bpm": 141},
        {"name": "Active", "genre": "Drill", "mood": "energetic", "bpm": 143},
        {"name": "Pressure", "genre": "Drill", "mood": "dark", "bpm": 140},
        {"name": "No Lacking", "genre": "Drill", "mood": "energetic", "bpm": 144},
        
        # Hip-Hop
        {"name": "Classic Flow", "genre": "Hip-Hop", "mood": "neutral", "bpm": 90},
        {"name": "Old School Vibes", "genre": "Hip-Hop", "mood": "chill", "bpm": 88},
        {"name": "Boom Bap", "genre": "Hip-Hop", "mood": "neutral", "bpm": 92},
        {"name": "Golden Era", "genre": "Hip-Hop", "mood": "chill", "bpm": 86},
        {"name": "Real Talk", "genre": "Hip-Hop", "mood": "neutral", "bpm": 94},
        {"name": "Street Poetry", "genre": "Hip-Hop", "mood": "emotional", "bpm": 85},
        {"name": "Hustle Hard", "genre": "Hip-Hop", "mood": "energetic", "bpm": 95},
        {"name": "Legend Status", "genre": "Hip-Hop", "mood": "neutral", "bpm": 90},
        
        # Lo-fi
        {"name": "Study Session", "genre": "Lo-fi", "mood": "chill", "bpm": 75},
        {"name": "Rainy Day", "genre": "Lo-fi", "mood": "sad", "bpm": 72},
        {"name": "Coffee Shop", "genre": "Lo-fi", "mood": "chill", "bpm": 78},
        {"name": "Late Night Thoughts", "genre": "Lo-fi", "mood": "emotional", "bpm": 70},
        {"name": "Nostalgia", "genre": "Lo-fi", "mood": "sad", "bpm": 74},
        {"name": "Dreaming", "genre": "Lo-fi", "mood": "chill", "bpm": 76},
        {"name": "Sunset Drive", "genre": "Lo-fi", "mood": "chill", "bpm": 80},
        {"name": "Memory Lane", "genre": "Lo-fi", "mood": "emotional", "bpm": 73},
        
        # Synthwave
        {"name": "Neon City", "genre": "Synthwave", "mood": "energetic", "bpm": 120},
        {"name": "Retro Future", "genre": "Synthwave", "mood": "energetic", "bpm": 118},
        {"name": "Cyber Dreams", "genre": "Synthwave", "mood": "chill", "bpm": 115},
        {"name": "Night Drive", "genre": "Synthwave", "mood": "chill", "bpm": 110},
        {"name": "Digital Love", "genre": "Synthwave", "mood": "emotional", "bpm": 112},
        {"name": "80s Vibe", "genre": "Synthwave", "mood": "energetic", "bpm": 122},
        {"name": "Outrun", "genre": "Synthwave", "mood": "energetic", "bpm": 125},
        {"name": "Laser Grid", "genre": "Synthwave", "mood": "chill", "bpm": 108},
        
        # Electronic/House
        {"name": "Deep House Groove", "genre": "Electronic", "mood": "chill", "bpm": 124},
        {"name": "Techno Pulse", "genre": "Electronic", "mood": "energetic", "bpm": 130},
        {"name": "Future Bass", "genre": "Electronic", "mood": "energetic", "bpm": 150},
        {"name": "Ambient Dreams", "genre": "Electronic", "mood": "chill", "bpm": 100},
        {"name": "EDM Festival", "genre": "Electronic", "mood": "energetic", "bpm": 128},
        {"name": "Chill Wave", "genre": "Electronic", "mood": "chill", "bpm": 105},
        {"name": "Bass Drop", "genre": "Electronic", "mood": "energetic", "bpm": 140},
        {"name": "Tropical House", "genre": "Electronic", "mood": "chill", "bpm": 110},
        
        # R&B / Soul
        {"name": "Smooth Groove", "genre": "R&B", "mood": "chill", "bpm": 85},
        {"name": "Late Night Love", "genre": "R&B", "mood": "emotional", "bpm": 80},
        {"name": "Soulful", "genre": "R&B", "mood": "emotional", "bpm": 78},
        {"name": "Slow Jam", "genre": "R&B", "mood": "sad", "bpm": 72},
        {"name": "Velvet Touch", "genre": "R&B", "mood": "chill", "bpm": 88},
        {"name": "Moonlight Serenade", "genre": "R&B", "mood": "emotional", "bpm": 82},
        {"name": "After Hours", "genre": "R&B", "mood": "chill", "bpm": 84},
        {"name": "Heartstrings", "genre": "R&B", "mood": "sad", "bpm": 76},
    ]
    
    colors = {
        "Melodic Trap": "#d63384",
        "Dark Trap": "#6610f2",
        "Drill": "#fd7e14",
        "Hip-Hop": "#ffc107",
        "Lo-fi": "#0dcaf0",
        "Synthwave": "#6f42c1",
        "Electronic": "#20c997",
        "R&B": "#e83e8c"
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
    print("[OK] Ornek beatler olusturuldu!")


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
# KARAOKE SAYFALARI
# ============================================

def generate_room_code():
    """Benzersiz oda kodu oluştur"""
    chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    while True:
        code = ''.join(random.choices(chars, k=6))
        existing = KaraokeRoom.query.filter_by(room_code=code).first()
        if not existing:
            return code


@app.route("/karaoke")
@login_required
def karaoke_lobby():
    """Karaoke lobby - oda listesi"""
    rooms = KaraokeRoom.query.filter_by(is_active=True).all()
    return render_template(
        "karaoke_lobby.html",
        title="FONIX – Karaoke Odaları",
        rooms=rooms,
        current_user=get_current_username()
    )


@app.route("/karaoke/create", methods=["POST"])
@login_required
def create_karaoke_room():
    """Yeni karaoke odası oluştur"""
    user = get_current_user()
    room_name = request.form.get("room_name", f"{user.username}'in Odası")
    max_participants = int(request.form.get("max_participants", 8))
    
    room = KaraokeRoom(
        room_code=generate_room_code(),
        name=room_name,
        host_id=user.id,
        max_participants=min(max_participants, 20)
    )
    db.session.add(room)
    db.session.commit()
    
    return redirect(url_for("karaoke_room", room_code=room.room_code))


@app.route("/karaoke/room/<room_code>")
@login_required
def karaoke_room(room_code):
    """Karaoke odası sayfası"""
    room = KaraokeRoom.query.filter_by(room_code=room_code, is_active=True).first()
    if not room:
        flash("Oda bulunamadı veya kapatılmış.", "error")
        return redirect(url_for("karaoke_lobby"))
    
    user = get_current_user()
    beats = Beat.query.all()
    
    # Kullanıcı host mu kontrol et
    is_host = room.host_id == user.id
    
    return render_template(
        "karaoke_room.html",
        title=f"FONIX – {room.name}",
        room=room,
        beats=beats,
        is_host=is_host,
        current_user=get_current_username(),
        user_id=user.id
    )


@app.route("/karaoke/room/<room_code>/close", methods=["POST"])
@login_required
def close_karaoke_room(room_code):
    """Karaoke odasını kapat (sadece host)"""
    user = get_current_user()
    room = KaraokeRoom.query.filter_by(room_code=room_code).first()
    
    if not room:
        return jsonify({"error": "Oda bulunamadı"}), 404
    
    if room.host_id != user.id:
        return jsonify({"error": "Sadece oda sahibi odayı kapatabilir"}), 403
    
    room.is_active = False
    db.session.commit()
    
    # Socket ile herkesi bilgilendir
    socketio.emit('room_closed', {'message': 'Oda kapatıldı'}, room=room_code)
    
    return redirect(url_for("karaoke_lobby"))


# ============================================
# KARAOKE API ENDPOİNTLERİ
# ============================================

@app.route("/api/karaoke/rooms", methods=["GET"])
def api_get_karaoke_rooms():
    """Aktif karaoke odalarını getir"""
    rooms = KaraokeRoom.query.filter_by(is_active=True).order_by(KaraokeRoom.created_at.desc()).all()
    
    return jsonify({
        'rooms': [{
            'id': r.id,
            'room_code': r.room_code,
            'name': r.name,
            'host': r.host.username,
            'host_id': r.host_id,
            'participant_count': len(r.participants),
            'max_participants': r.max_participants,
            'beat': {
                'id': r.beat.id,
                'name': r.beat.name
            } if r.beat else None,
            'is_playing': r.is_playing,
            'created_at': r.created_at.isoformat() if r.created_at else None
        } for r in rooms]
    })


@app.route("/api/karaoke/rooms", methods=["POST"])
@api_login_required
def api_create_karaoke_room():
    """Yeni karaoke odası oluştur"""
    user = request.current_user
    data = request.get_json()
    
    room_name = data.get('name', '').strip()
    if not room_name:
        return jsonify({'error': 'Oda adı gerekli'}), 400
    
    room_code = generate_room_code()
    
    room = KaraokeRoom(
        room_code=room_code,
        name=room_name,
        host_id=user.id
    )
    db.session.add(room)
    db.session.commit()
    
    return jsonify({
        'message': 'Oda oluşturuldu',
        'room': {
            'id': room.id,
            'room_code': room.room_code,
            'name': room.name
        }
    }), 201


@app.route("/api/karaoke/rooms/<room_code>", methods=["GET"])
def api_get_karaoke_room(room_code):
    """Karaoke odası detaylarını getir"""
    room = KaraokeRoom.query.filter_by(room_code=room_code, is_active=True).first()
    if not room:
        return jsonify({'error': 'Oda bulunamadı'}), 404
    
    return jsonify({
        'room': {
            'id': room.id,
            'room_code': room.room_code,
            'name': room.name,
            'host_id': room.host_id,
            'host': room.host.username,
            'is_playing': room.is_playing,
            'current_time': room.current_time,
            'beat': room.beat.to_dict() if room.beat else None,
            'youtube_url': getattr(room, 'youtube_url', None),
            'lyrics': getattr(room, 'lyrics', None)
        },
        'participants': [{
            'user_id': p.user_id,
            'username': p.user.username,
            'avatar_color': p.user.avatar_color,
            'is_singing': p.is_singing
        } for p in room.participants]
    })


@app.route("/api/karaoke/rooms/<room_code>/join", methods=["POST"])
@api_login_required
def api_join_karaoke_room(room_code):
    """Karaoke odasına katıl"""
    user = request.current_user
    room = KaraokeRoom.query.filter_by(room_code=room_code, is_active=True).first()
    
    if not room:
        return jsonify({'error': 'Oda bulunamadı'}), 404
    
    if len(room.participants) >= room.max_participants:
        return jsonify({'error': 'Oda dolu'}), 400
    
    # Zaten katılmış mı kontrol et
    existing = RoomParticipant.query.filter_by(room_id=room.id, user_id=user.id).first()
    if not existing:
        participant = RoomParticipant(room_id=room.id, user_id=user.id)
        db.session.add(participant)
        db.session.commit()
    
    return jsonify({'message': 'Odaya katıldın'})


@app.route("/api/karaoke/rooms/<room_code>/leave", methods=["POST"])
@api_login_required
def api_leave_karaoke_room(room_code):
    """Karaoke odasından ayrıl"""
    user = request.current_user
    room = KaraokeRoom.query.filter_by(room_code=room_code).first()
    
    if not room:
        return jsonify({'error': 'Oda bulunamadı'}), 404
    
    participant = RoomParticipant.query.filter_by(room_id=room.id, user_id=user.id).first()
    if participant:
        db.session.delete(participant)
        db.session.commit()
    
    return jsonify({'message': 'Odadan ayrıldın'})


@app.route("/api/karaoke/rooms/<room_code>", methods=["DELETE"])
@api_login_required
def api_delete_karaoke_room(room_code):
    """Karaoke odasını sil (sadece host)"""
    user = request.current_user
    room = KaraokeRoom.query.filter_by(room_code=room_code).first()
    
    if not room:
        return jsonify({'error': 'Oda bulunamadı'}), 404
    
    if room.host_id != user.id:
        return jsonify({'error': 'Sadece oda sahibi odayı silebilir'}), 403
    
    # Tüm katılımcıları sil
    RoomParticipant.query.filter_by(room_id=room.id).delete()
    # Odayı sil
    db.session.delete(room)
    db.session.commit()
    
    return jsonify({'message': 'Oda silindi'})


def _vtt_ts_to_sec(ts):
    """'HH:MM:SS.mmm' veya 'MM:SS.mmm' → saniye (float)"""
    ts = ts.strip().replace(',', '.')
    parts = ts.split(':')
    try:
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
        elif len(parts) == 2:
            return int(parts[0]) * 60 + float(parts[1])
    except Exception:
        pass
    return 0.0


def _parse_vtt_timed(content):
    """VTT altyazıyı timestamp'li satırlara dönüştür → [{text, start}]"""
    result = []
    seen = set()
    blocks = re.split(r'\n{2,}', content)
    for block in blocks:
        lines = block.strip().split('\n')
        ts_line = next((l for l in lines if '-->' in l), None)
        if not ts_line:
            continue
        start = _vtt_ts_to_sec(ts_line.split('-->')[0].split()[0])
        text_parts = []
        for l in lines:
            if '-->' in l or l.strip().isdigit() or l.startswith('WEBVTT'):
                continue
            cleaned = re.sub(r'<\d{2}:\d{2}:\d{2}\.\d+>', '', l)
            cleaned = re.sub(r'<[^>]+>', '', cleaned).strip()
            if cleaned:
                text_parts.append(cleaned)
        text = ' '.join(text_parts).strip()
        if text and text not in seen and len(text) > 1:
            seen.add(text)
            result.append({'text': text, 'start': round(start, 2)})
    return result or None


def _parse_json3_timed(content):
    """JSON3 altyazıyı timestamp'li satırlara dönüştür → [{text, start}]"""
    try:
        data = json.loads(content)
        result = []
        seen = set()
        for event in data.get('events', []):
            start = event.get('tStartMs', 0) / 1000.0
            segs = event.get('segs', [])
            text = ''.join(seg.get('utf8', '') for seg in segs)
            text = re.sub(r'<[^>]+>', '', text).strip()
            if text and text != '\n' and text.strip() and text not in seen:
                seen.add(text)
                result.append({'text': text, 'start': round(start, 2)})
        return result or None
    except Exception:
        return None


def _fetch_caption_timed(cap_list):
    """Altyazı URL listesinden timestamp'li satırları çek"""
    import urllib.request as ureq
    order = ['json3', 'vtt', 'srv3', 'srv2', 'srv1']
    by_ext = {c.get('ext'): c for c in cap_list if c.get('url')}
    for ext in order:
        cap = by_ext.get(ext)
        if not cap:
            continue
        try:
            req = ureq.Request(cap['url'], headers={'User-Agent': 'Mozilla/5.0'})
            with ureq.urlopen(req, timeout=8) as resp:
                raw = resp.read().decode('utf-8', errors='ignore')
            result = _parse_json3_timed(raw) if ext == 'json3' else _parse_vtt_timed(raw)
            if result:
                return result
        except Exception:
            continue
    return None


def _extract_lyrics_from_info(info):
    """yt_dlp info dict'inden timestamp'li şarkı sözlerini çıkar"""
    subtitles = info.get('subtitles', {})
    auto_caps = info.get('automatic_captions', {})

    for lang in ['tr', 'tr-TR', 'en', 'en-US', 'en-GB']:
        for source in [subtitles, auto_caps]:
            cap_list = source.get(lang)
            if cap_list:
                result = _fetch_caption_timed(cap_list)
                if result:
                    return result

    # Açıklama metninden yedek (timestamp yok, eşit dağıtım yapılacak)
    description = info.get('description', '')
    if description:
        desc_lines = []
        for line in description.split('\n'):
            line = line.strip()
            if line and not line.startswith('http') and not line.startswith('#') and len(line) > 2:
                desc_lines.append(line)
                if len(desc_lines) >= 50:
                    break
        if len(desc_lines) >= 4:
            # Timestamp yok: None döndür, frontend eşit dağıtır
            return [{'text': l, 'start': None} for l in desc_lines]

    return None


@app.route("/api/karaoke/youtube", methods=["POST"])
@api_login_required
def api_youtube_audio():
    """YouTube'dan ses ve şarkı sözü bilgisi al"""
    data = request.get_json()
    youtube_url = data.get('url', '').strip()

    if not youtube_url:
        return jsonify({'error': 'YouTube URL gerekli'}), 400

    try:
        import yt_dlp

        ydl_opts = {
            'format': 'bestaudio/best',
            'noplaylist': True,
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=False)

        # En iyi ses formatını bul
        audio_url = None
        for fmt in info.get('formats', []):
            if fmt.get('acodec') != 'none' and fmt.get('vcodec') == 'none':
                audio_url = fmt.get('url')
                break
        if not audio_url:
            audio_url = info.get('url')

        # Şarkı sözlerini çek (timestamp'li)
        duration = info.get('duration', 0) or 0
        timed = _extract_lyrics_from_info(info) or []

        # start=None olan satırlar için eşit dağıtım yap
        untimed = [i for i, e in enumerate(timed) if e.get('start') is None]
        if untimed and duration > 0:
            step = duration / (len(timed) + 1)
            for rank, idx in enumerate(untimed):
                timed[idx]['start'] = round(step * (rank + 1), 2)

        plain_lines = [e['text'] for e in timed]

        return jsonify({
            'title': info.get('title', 'Bilinmeyen'),
            'artist': info.get('uploader', 'Bilinmeyen'),
            'duration': duration,
            'thumbnail': info.get('thumbnail'),
            'audio_url': audio_url,
            'lyrics': '\n'.join(plain_lines),
            'lyrics_lines': plain_lines,
            'lyrics_timed': timed,
            'lyrics_found': bool(timed)
        })

    except Exception as e:
        return jsonify({'error': f'YouTube hatası: {str(e)}'}), 500


@app.route("/api/lyrics/fetch", methods=["GET"])
def api_fetch_lyrics():
    """Şarkı sözlerini çek (lyrics.ovh API)"""
    artist = request.args.get('artist', '').strip()
    title = request.args.get('title', '').strip()
    
    if not artist or not title:
        return jsonify({'error': 'Sanatçı ve şarkı adı gerekli'}), 400
    
    try:
        import urllib.request
        import json
        
        # lyrics.ovh API
        url = f"https://api.lyrics.ovh/v1/{urllib.parse.quote(artist)}/{urllib.parse.quote(title)}"
        
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())
            lyrics = data.get('lyrics', '')
            
            # Sözleri satırlara ayır ve temizle
            lines = [line.strip() for line in lyrics.split('\n') if line.strip()]
            
            return jsonify({
                'lyrics': lyrics,
                'lines': lines,
                'found': True
            })
            
    except urllib.error.HTTPError:
        return jsonify({'lyrics': '', 'lines': [], 'found': False, 'message': 'Şarkı sözleri bulunamadı'})
    except Exception as e:
        return jsonify({'error': f'Lyrics hatası: {str(e)}'}), 500


@app.route("/api/karaoke/rooms/<room_code>/youtube", methods=["POST"])
@api_login_required
def api_set_room_youtube(room_code):
    """Odaya YouTube şarkısı ayarla"""
    user = request.current_user
    room = KaraokeRoom.query.filter_by(room_code=room_code, is_active=True).first()
    
    if not room:
        return jsonify({'error': 'Oda bulunamadı'}), 404
    
    if room.host_id != user.id:
        return jsonify({'error': 'Sadece host şarkı seçebilir'}), 403
    
    data = request.get_json()
    youtube_data = data.get('youtube_data', {})
    lyrics = data.get('lyrics', '')
    
    # Room'a youtube bilgisi ekle (model'e field eklemek gerekebilir)
    room.youtube_url = youtube_data.get('audio_url')
    room.current_song_title = youtube_data.get('title')
    room.lyrics = lyrics
    db.session.commit()
    
    return jsonify({'message': 'Şarkı ayarlandı'})


# ============================================
# SOCKET.IO EVENT HANDLERLERİ
# ============================================

@socketio.on('connect')
def handle_connect():
    """Kullanıcı bağlandı"""
    print(f"Kullanıcı bağlandı: {request.sid}")


@socketio.on('disconnect')
def handle_disconnect():
    """Kullanıcı bağlantıyı kesti"""
    print(f"Kullanıcı ayrıldı: {request.sid}")
    
    # Aktif odalardan kullanıcıyı çıkar
    for room_code, room_data in list(active_rooms.items()):
        if request.sid in room_data.get('participants', {}):
            user_info = room_data['participants'].pop(request.sid)
            emit('user_left', {
                'username': user_info['username'],
                'message': f"{user_info['username']} odadan ayrıldı"
            }, room=room_code)
            
            # Veritabanından da çıkar
            participant = RoomParticipant.query.filter_by(
                room_id=room_data['room_id'],
                user_id=user_info['user_id']
            ).first()
            if participant:
                db.session.delete(participant)
                db.session.commit()


@socketio.on('join_room')
def handle_join_room(data):
    """Kullanıcı odaya katıldı"""
    room_code = data.get('room_code')
    user_id = data.get('user_id')
    username = data.get('username')
    
    if not room_code or not user_id:
        return
    
    room = KaraokeRoom.query.filter_by(room_code=room_code, is_active=True).first()
    if not room:
        emit('error', {'message': 'Oda bulunamadı'})
        return
    
    # Oda dolu mu kontrol et
    if len(room.participants) >= room.max_participants:
        emit('error', {'message': 'Oda dolu'})
        return
    
    # Socket.IO odasına katıl
    join_room(room_code)
    
    # Memory cache'e ekle
    if room_code not in active_rooms:
        active_rooms[room_code] = {
            'room_id': room.id,
            'participants': {}
        }
    
    active_rooms[room_code]['participants'][request.sid] = {
        'user_id': user_id,
        'username': username
    }
    
    # Veritabanına kaydet (zaten yoksa)
    existing = RoomParticipant.query.filter_by(room_id=room.id, user_id=user_id).first()
    if not existing:
        participant = RoomParticipant(room_id=room.id, user_id=user_id)
        db.session.add(participant)
        db.session.commit()
    
    # Tüm katılımcıları listele
    participants = []
    for p in room.participants:
        participants.append({
            'user_id': p.user_id,
            'username': p.user.username,
            'avatar_color': p.user.avatar_color,
            'is_singing': p.is_singing,
            'is_host': p.user_id == room.host_id
        })
    
    # Odadaki herkese bildir
    emit('user_joined', {
        'username': username,
        'user_id': user_id,
        'participants': participants,
        'message': f"{username} odaya katıldı"
    }, room=room_code)
    
    # Yeni katılana mevcut durumu gönder
    emit('room_state', {
        'beat_id': room.beat_id,
        'is_playing': room.is_playing,
        'current_time': room.current_time,
        'participants': participants
    })


@socketio.on('leave_room')
def handle_leave_room(data):
    """Kullanıcı odadan ayrıldı"""
    room_code = data.get('room_code')
    user_id = data.get('user_id')
    username = data.get('username')
    
    if room_code:
        leave_room(room_code)
        
        # Memory cache'den çıkar
        if room_code in active_rooms and request.sid in active_rooms[room_code]['participants']:
            del active_rooms[room_code]['participants'][request.sid]
        
        # Veritabanından çıkar
        room = KaraokeRoom.query.filter_by(room_code=room_code).first()
        if room:
            participant = RoomParticipant.query.filter_by(room_id=room.id, user_id=user_id).first()
            if participant:
                db.session.delete(participant)
                db.session.commit()
        
        emit('user_left', {
            'username': username,
            'user_id': user_id,
            'message': f"{username} odadan ayrıldı"
        }, room=room_code)


@socketio.on('select_beat')
def handle_select_beat(data):
    """Host beat seçti"""
    room_code = data.get('room_code')
    beat_id = data.get('beat_id')
    user_id = data.get('user_id')
    
    room = KaraokeRoom.query.filter_by(room_code=room_code, is_active=True).first()
    if not room or room.host_id != user_id:
        emit('error', {'message': 'Yetkisiz işlem'})
        return
    
    room.beat_id = beat_id
    room.current_time = 0
    room.is_playing = False
    db.session.commit()
    
    beat = db.session.get(Beat, beat_id)
    
    emit('beat_changed', {
        'beat_id': beat_id,
        'beat_name': beat.name if beat else '',
        'beat_url': beat.url if beat else '',
        'beat_artist': beat.artist if beat else '',
        'beat_lyrics': beat.lyrics if beat else ''
    }, room=room_code)


@socketio.on('play_pause')
def handle_play_pause(data):
    """Host play/pause kontrol"""
    room_code = data.get('room_code')
    is_playing = data.get('is_playing')
    current_time = data.get('current_time', 0)
    user_id = data.get('user_id')
    
    room = KaraokeRoom.query.filter_by(room_code=room_code, is_active=True).first()
    if not room or room.host_id != user_id:
        emit('error', {'message': 'Yetkisiz işlem'})
        return
    
    room.is_playing = is_playing
    room.current_time = current_time
    db.session.commit()
    
    emit('playback_sync', {
        'is_playing': is_playing,
        'current_time': current_time
    }, room=room_code)


@socketio.on('sync_time')
def handle_sync_time(data):
    """Beat zamanını senkronize et"""
    room_code = data.get('room_code')
    current_time = data.get('current_time', 0)
    
    emit('time_update', {
        'current_time': current_time
    }, room=room_code, include_self=False)


@socketio.on('chat_message')
def handle_chat_message(data):
    """Chat mesajı gönder"""
    room_code = data.get('room_code')
    user_id = data.get('user_id')
    username = data.get('username')
    message = data.get('message', '').strip()
    
    if not message or not room_code:
        return
    
    room = KaraokeRoom.query.filter_by(room_code=room_code, is_active=True).first()
    if not room:
        return
    
    # Mesajı veritabanına kaydet
    room_msg = RoomMessage(
        room_id=room.id,
        user_id=user_id,
        message=message,
        message_type='chat'
    )
    db.session.add(room_msg)
    db.session.commit()
    
    user = db.session.get(User, user_id)
    
    emit('new_message', {
        'username': username,
        'user_id': user_id,
        'message': message,
        'avatar_color': user.avatar_color if user else '#ff146a',
        'timestamp': room_msg.created_at.isoformat()
    }, room=room_code)


@socketio.on('request_singing')
def handle_request_singing(data):
    """Şarkı söyleme sırası iste"""
    room_code = data.get('room_code')
    user_id = data.get('user_id')
    username = data.get('username')
    
    room = KaraokeRoom.query.filter_by(room_code=room_code, is_active=True).first()
    if not room:
        return
    
    emit('singing_request', {
        'user_id': user_id,
        'username': username,
        'message': f"{username} şarkı söylemek istiyor!"
    }, room=room_code)


@socketio.on('grant_singing')
def handle_grant_singing(data):
    """Şarkı söyleme sırasını ver (host)"""
    room_code = data.get('room_code')
    host_id = data.get('host_id')
    target_user_id = data.get('target_user_id')
    
    room = KaraokeRoom.query.filter_by(room_code=room_code, is_active=True).first()
    if not room or room.host_id != host_id:
        emit('error', {'message': 'Yetkisiz işlem'})
        return
    
    # Önceki söyleyiciyi kapat
    RoomParticipant.query.filter_by(room_id=room.id, is_singing=True).update({'is_singing': False})
    
    # Yeni söyleyiciyi aç
    participant = RoomParticipant.query.filter_by(room_id=room.id, user_id=target_user_id).first()
    if participant:
        participant.is_singing = True
        db.session.commit()
        
        emit('singing_granted', {
            'user_id': target_user_id,
            'username': participant.user.username
        }, room=room_code)


@socketio.on('select_song')
def handle_select_song(data):
    """Host şarkı seçti"""
    room_code = data.get('room_code')
    song_id = data.get('song_id')
    user_id = data.get('user_id')
    
    room = KaraokeRoom.query.filter_by(room_code=room_code, is_active=True).first()
    if not room or room.host_id != user_id:
        emit('error', {'message': 'Yetkisiz işlem'})
        return
    
    emit('song_changed', {
        'song_id': song_id
    }, room=room_code)


@socketio.on('submit_rating')
def handle_submit_rating(data):
    """Kullanıcı puan verdi"""
    room_code = data.get('room_code')
    user_id = data.get('user_id')
    song_id = data.get('song_id')
    rating = data.get('rating')
    
    user = db.session.get(User, user_id)
    
    emit('rating_received', {
        'user_id': user_id,
        'username': user.username if user else 'Anonim',
        'song_id': song_id,
        'rating': rating
    }, room=room_code)


# ============================================
# UYGULAMA BAŞLATMA
# ============================================

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        seed_beats()
    socketio.run(app, debug=True, host='0.0.0.0', port=5000, use_reloader=False)
