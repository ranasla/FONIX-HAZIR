const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const app = express();
const PORT = 5000;
const JWT_SECRET = 'fonix-jwt-secret-2025-very-secure';

// Middleware
app.use(cors());
app.use(express.json());
app.use('/static', express.static(path.join(__dirname, '..', 'static')));

let db;
const DB_PATH = path.join(__dirname, '..', 'fonix_js.db');

// Initialize database
async function initDatabase() {
  const SQL = await initSqlJs();
  
  // Load existing database or create new
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      avatar_color TEXT DEFAULT '#ff146a',
      favorite_genre TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      genre TEXT DEFAULT 'Pop',
      duration INTEGER DEFAULT 180,
      cover_url TEXT DEFAULT '',
      audio_url TEXT DEFAULT '',
      play_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS beats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      producer TEXT DEFAULT 'FONIX',
      bpm INTEGER DEFAULT 120,
      key_signature TEXT DEFAULT 'C Major',
      genre TEXT DEFAULT 'Hip Hop',
      price REAL DEFAULT 0,
      audio_url TEXT DEFAULT '',
      cover_url TEXT DEFAULT '',
      tags TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      cover_url TEXT DEFAULT '',
      is_public INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS playlist_songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL,
      song_id INTEGER NOT NULL,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      bpm INTEGER DEFAULT 120,
      key_signature TEXT DEFAULT 'C Major',
      data TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed data
  seedData();
  saveDatabase();
  
  console.log('✅ Database initialized');
}

// Save database to file
function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// Helper: Run query and return results
function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// Helper: Run query and return first result
function dbGet(sql, params = []) {
  const results = dbAll(sql, params);
  return results[0] || null;
}

// Helper: Generate JWT token
function generateToken(userId) {
  return jwt.sign(
    { user_id: userId, jti: uuidv4() },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// Helper: Verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// Middleware: Auth check
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token gerekli' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Geçersiz token' });
  }

  const user = dbGet('SELECT * FROM users WHERE id = ?', [decoded.user_id]);
  if (!user) {
    return res.status(401).json({ error: 'Kullanıcı bulunamadı' });
  }

  req.user = user;
  next();
}

// ============================================
// AUTH ENDPOINTS
// ============================================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, full_name = '' } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Tüm alanlar zorunludur' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Kullanıcı adı en az 3 karakter olmalı' });
    }

    const existingUser = dbGet('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existingUser) {
      if (existingUser.username === username) {
        return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor' });
      }
      return res.status(400).json({ error: 'Bu e-posta zaten kullanılıyor' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const colors = ['#ff146a', '#4AADE8', '#9b59b6', '#2ecc71', '#f39c12', '#e74c3c'];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];

    db.run(`
      INSERT INTO users (username, email, password_hash, full_name, avatar_color)
      VALUES (?, ?, ?, ?, ?)
    `, [username, email, passwordHash, full_name, avatarColor]);

    const userId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
    saveDatabase();

    const token = generateToken(userId);

    res.status(201).json({
      message: 'Kayıt başarılı!',
      token,
      user: { id: userId, username, email, full_name, avatar_color: avatarColor, bio: '', favorite_genre: '' }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username_or_email, password } = req.body;

    if (!username_or_email || !password) {
      return res.status(400).json({ error: 'Tüm alanlar zorunludur' });
    }

    const user = dbGet('SELECT * FROM users WHERE username = ? OR email = ?', [username_or_email, username_or_email]);
    if (!user) {
      return res.status(401).json({ error: 'Kullanıcı bulunamadı' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Hatalı şifre' });
    }

    const token = generateToken(user.id);

    res.json({
      message: 'Giriş başarılı!',
      token,
      user: { id: user.id, username: user.username, email: user.email, full_name: user.full_name, avatar_color: user.avatar_color, bio: user.bio, favorite_genre: user.favorite_genre }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({
    user: { id: req.user.id, username: req.user.username, email: req.user.email, full_name: req.user.full_name, avatar_color: req.user.avatar_color, bio: req.user.bio, favorite_genre: req.user.favorite_genre }
  });
});

app.put('/api/auth/profile', authMiddleware, (req, res) => {
  const { full_name, bio, favorite_genre, avatar_color } = req.body;
  db.run('UPDATE users SET full_name = ?, bio = ?, favorite_genre = ?, avatar_color = ? WHERE id = ?', 
    [full_name || '', bio || '', favorite_genre || '', avatar_color || '#ff146a', req.user.id]);
  saveDatabase();
  const updatedUser = dbGet('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json({ message: 'Profil güncellendi', user: { id: updatedUser.id, username: updatedUser.username, email: updatedUser.email, full_name: updatedUser.full_name, avatar_color: updatedUser.avatar_color, bio: updatedUser.bio, favorite_genre: updatedUser.favorite_genre }});
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ message: 'Çıkış yapıldı' });
});

// ============================================
// SONGS ENDPOINTS
// ============================================

app.get('/api/songs', (req, res) => {
  const { genre, search, limit = 20 } = req.query;
  let sql = 'SELECT * FROM songs WHERE 1=1';
  const params = [];

  if (genre && genre !== 'Tümü') {
    sql += ' AND genre = ?';
    params.push(genre);
  }
  if (search) {
    sql += ' AND (title LIKE ? OR artist LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY play_count DESC LIMIT ?';
  params.push(parseInt(limit));

  const songs = dbAll(sql, params);
  const genres = dbAll('SELECT DISTINCT genre FROM songs').map(g => g.genre);
  res.json({ songs, genres: ['Tümü', ...genres] });
});

app.get('/api/songs/:id', (req, res) => {
  const song = dbGet('SELECT * FROM songs WHERE id = ?', [req.params.id]);
  if (!song) return res.status(404).json({ error: 'Şarkı bulunamadı' });
  res.json(song);
});

// ============================================
// BEATS ENDPOINTS
// ============================================

app.get('/api/beats', (req, res) => {
  const { genre, search, limit = 20 } = req.query;
  let sql = 'SELECT * FROM beats WHERE 1=1';
  const params = [];

  if (genre && genre !== 'all') {
    sql += ' AND genre = ?';
    params.push(genre);
  }
  if (search) {
    sql += ' AND (title LIKE ? OR producer LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));

  const beats = dbAll(sql, params);
  res.json({ beats });
});

app.get('/api/beats/:id', (req, res) => {
  const beat = dbGet('SELECT * FROM beats WHERE id = ?', [req.params.id]);
  if (!beat) return res.status(404).json({ error: 'Beat bulunamadı' });
  res.json(beat);
});

// ============================================
// PLAYLISTS ENDPOINTS
// ============================================

app.get('/api/playlists', authMiddleware, (req, res) => {
  const playlists = dbAll('SELECT p.*, (SELECT COUNT(*) FROM playlist_songs ps WHERE ps.playlist_id = p.id) as song_count FROM playlists p WHERE p.user_id = ? ORDER BY p.created_at DESC', [req.user.id]);
  res.json({ playlists });
});

app.post('/api/playlists', authMiddleware, (req, res) => {
  const { name, description = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'Playlist adı zorunludur' });

  db.run('INSERT INTO playlists (user_id, name, description) VALUES (?, ?, ?)', [req.user.id, name, description]);
  const playlistId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  saveDatabase();
  res.status(201).json({ message: 'Playlist oluşturuldu', playlist: { id: playlistId, name, description, song_count: 0 }});
});

app.post('/api/playlists/:id/songs', authMiddleware, (req, res) => {
  const { song_id } = req.body;
  const playlistId = req.params.id;
  const playlist = dbGet('SELECT * FROM playlists WHERE id = ? AND user_id = ?', [playlistId, req.user.id]);
  if (!playlist) return res.status(404).json({ error: 'Playlist bulunamadı' });

  const existing = dbGet('SELECT * FROM playlist_songs WHERE playlist_id = ? AND song_id = ?', [playlistId, song_id]);
  if (!existing) {
    db.run('INSERT INTO playlist_songs (playlist_id, song_id) VALUES (?, ?)', [playlistId, song_id]);
    saveDatabase();
  }
  res.json({ message: 'Şarkı eklendi' });
});

// ============================================
// PROJECTS ENDPOINTS
// ============================================

app.get('/api/projects', authMiddleware, (req, res) => {
  const projects = dbAll('SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC', [req.user.id]);
  res.json({ projects });
});

app.post('/api/projects', authMiddleware, (req, res) => {
  const { name, description = '', bpm = 120, key_signature = 'C Major', data = '{}' } = req.body;
  if (!name) return res.status(400).json({ error: 'Proje adı zorunludur' });

  db.run('INSERT INTO projects (user_id, name, description, bpm, key_signature, data) VALUES (?, ?, ?, ?, ?, ?)', 
    [req.user.id, name, description, bpm, key_signature, JSON.stringify(data)]);
  const projectId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  saveDatabase();
  res.status(201).json({ message: 'Proje oluşturuldu', project: { id: projectId, name, description, bpm, key_signature }});
});

app.put('/api/projects/:id', authMiddleware, (req, res) => {
  const { name, description, bpm, key_signature, data } = req.body;
  const project = dbGet('SELECT * FROM projects WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!project) return res.status(404).json({ error: 'Proje bulunamadı' });

  db.run('UPDATE projects SET name = ?, description = ?, bpm = ?, key_signature = ?, data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
    [name || project.name, description !== undefined ? description : project.description, bpm || project.bpm, key_signature || project.key_signature, data ? JSON.stringify(data) : project.data, req.params.id]);
  saveDatabase();
  res.json({ message: 'Proje güncellendi' });
});

app.delete('/api/projects/:id', authMiddleware, (req, res) => {
  const project = dbGet('SELECT * FROM projects WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!project) return res.status(404).json({ error: 'Proje bulunamadı' });
  db.run('DELETE FROM projects WHERE id = ?', [req.params.id]);
  saveDatabase();
  res.json({ message: 'Proje silindi' });
});

// ============================================
// RECOMMENDATIONS & TOP
// ============================================

app.get('/api/recommendations', (req, res) => {
  const songs = dbAll('SELECT * FROM songs ORDER BY play_count DESC LIMIT 10');
  const beats = dbAll('SELECT * FROM beats ORDER BY RANDOM() LIMIT 5');
  res.json({ trending: songs.slice(0, 5), newReleases: songs.slice(5, 10), forYou: songs, beats });
});

app.get('/api/top', (req, res) => {
  const songs = dbAll('SELECT * FROM songs ORDER BY play_count DESC LIMIT 50');
  res.json({ songs, daily: songs.slice(0, 10), weekly: songs.slice(0, 20), monthly: songs });
});

// ============================================
// SEED DATA
// ============================================

function seedData() {
  const result = db.exec('SELECT COUNT(*) as count FROM songs');
  const songCount = result[0]?.values[0]?.[0] || 0;
  if (songCount > 0) return;

  console.log('🌱 Seeding database...');

  const songs = [
    { title: 'Midnight Dreams', artist: 'Luna Rose', genre: 'Pop', duration: 215 },
    { title: 'Electric Soul', artist: 'Neon Pulse', genre: 'Electronic', duration: 198 },
    { title: 'City Lights', artist: 'Urban Beat', genre: 'Hip Hop', duration: 245 },
    { title: 'Ocean Waves', artist: 'Chill Master', genre: 'Lo-Fi', duration: 180 },
    { title: 'Fire Inside', artist: 'Rock Nation', genre: 'Rock', duration: 267 },
    { title: 'Summer Vibes', artist: 'Beach Boys 2.0', genre: 'Pop', duration: 192 },
    { title: 'Night Drive', artist: 'Synth Wave', genre: 'Electronic', duration: 234 },
    { title: 'Street Poetry', artist: 'MC Flow', genre: 'Hip Hop', duration: 210 },
    { title: 'Rainy Day', artist: 'Jazz Hands', genre: 'Jazz', duration: 289 },
    { title: 'Dance Floor', artist: 'DJ Spark', genre: 'Electronic', duration: 176 }
  ];

  songs.forEach(song => {
    db.run('INSERT INTO songs (title, artist, genre, duration, play_count) VALUES (?, ?, ?, ?, ?)', 
      [song.title, song.artist, song.genre, song.duration, Math.floor(Math.random() * 10000)]);
  });

  const beats = [
    { title: 'Trap King', producer: 'BeatMaster', bpm: 140, key_signature: 'C Minor', genre: 'Trap' },
    { title: 'Boom Bap Classic', producer: 'OldSchool', bpm: 90, key_signature: 'G Minor', genre: 'Hip Hop' },
    { title: 'Future Bass Drop', producer: 'EDM Pro', bpm: 150, key_signature: 'F Major', genre: 'EDM' },
    { title: 'Chill Lofi', producer: 'LofiKing', bpm: 75, key_signature: 'A Minor', genre: 'Lo-Fi' },
    { title: 'Dark Drill', producer: 'UK Beats', bpm: 140, key_signature: 'E Minor', genre: 'Drill' },
    { title: 'Pop Hit', producer: 'HitFactory', bpm: 120, key_signature: 'C Major', genre: 'Pop' },
    { title: 'R&B Smooth', producer: 'SoulMaker', bpm: 85, key_signature: 'D Major', genre: 'R&B' },
    { title: 'Rock Energy', producer: 'GuitarHero', bpm: 130, key_signature: 'E Major', genre: 'Rock' }
  ];

  beats.forEach(beat => {
    db.run('INSERT INTO beats (title, producer, bpm, key_signature, genre) VALUES (?, ?, ?, ?, ?)', 
      [beat.title, beat.producer, beat.bpm, beat.key_signature, beat.genre]);
  });

  console.log('✅ Database seeded successfully!');
}

// Start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 FONIX Backend running on http://localhost:${PORT}`);
  });
});
