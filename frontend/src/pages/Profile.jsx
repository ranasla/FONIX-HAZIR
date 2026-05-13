import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { projectsAPI, playlistAPI } from '../services/api'
import './Profile.css'

const Profile = () => {
  const { user, updateProfile, logout } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [projects, setProjects] = useState([])
  const [playlist, setPlaylist] = useState([])

  // Profile edit state
  const [editing, setEditing] = useState(false)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [bio, setBio] = useState('')

  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    if (user) {
      setUsername(user.username)
      setEmail(user.email)
      setBio(user.bio || '')
      fetchProjects()
      fetchPlaylist()
    }
  }, [user])

  const fetchProjects = async () => {
    try {
      const response = await projectsAPI.getAll()
      setProjects(response.data.projects)
    } catch (error) {
      console.error('Projeler yüklenirken hata:', error)
    }
  }

  const fetchPlaylist = async () => {
    try {
      const response = await playlistAPI.getAll()
      setPlaylist(response.data.playlist)
    } catch (error) {
      console.error('Playlist yüklenirken hata:', error)
    }
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    try {
      await updateProfile({ username, email, bio })
      setEditing(false)
      setMessage({ type: 'success', text: 'Profil güncellendi!' })
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Güncelleme hatası' })
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Şifreler eşleşmiyor!' })
      return
    }

    try {
      await updateProfile({ 
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword
      })
      setShowPasswordModal(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setMessage({ type: 'success', text: 'Şifre güncellendi!' })
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Şifre güncelleme hatası' })
    }
  }

  const deleteProject = async (projectId) => {
    if (!window.confirm('Bu projeyi silmek istediğinize emin misiniz?')) return
    
    try {
      await projectsAPI.delete(projectId)
      setProjects(projects.filter(p => p.id !== projectId))
    } catch (error) {
      console.error('Proje silinirken hata:', error)
    }
  }

  if (!user) {
    return <Layout title="Profil"><div className="loading">Yükleniyor...</div></Layout>
  }

  return (
    <Layout title="Profil">
      {/* Profile Header */}
      <div className="profile-header">
        <div 
          className="profile-avatar"
          style={{ background: `linear-gradient(135deg, ${user.avatar_color || '#ff146a'}, #9b59b6)` }}
        >
          {user.username?.charAt(0).toUpperCase()}
        </div>
        
        <div className="profile-info">
          <h1>{user.full_name || user.username}</h1>
          <p className="email">@{user.username} • {user.email}</p>
          
          <div className="profile-stats">
            <div className="stat-item">
              <span className="number">{projects.length}</span>
              <span className="label">Proje</span>
            </div>
            <div className="stat-item">
              <span className="number">{playlist.length}</span>
              <span className="label">Favoriler</span>
            </div>
          </div>

          <div className="profile-actions">
            <button className="btn btn-primary" onClick={() => setEditing(true)}>
              ✏️ Profili Düzenle
            </button>
            <button className="btn btn-secondary" onClick={() => setShowPasswordModal(true)}>
              🔐 Şifre Değiştir
            </button>
            <button className="btn btn-danger" onClick={logout}>
              🚪 Çıkış Yap
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      {message.text && (
        <div className={`${message.type}-message`}>
          {message.type === 'success' ? '✅' : '⚠️'} {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button 
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Genel Bakış
        </button>
        <button 
          className={`tab-btn ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => setActiveTab('projects')}
        >
          📁 Projelerim
        </button>
        <button 
          className={`tab-btn ${activeTab === 'favorites' ? 'active' : ''}`}
          onClick={() => setActiveTab('favorites')}
        >
          ❤️ Favorilerim
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="overview-grid">
          <div className="overview-card">
            <h3>📁 Son Projeler</h3>
            {projects.length === 0 ? (
              <p className="empty">Henüz proje yok</p>
            ) : (
              <div className="mini-list">
                {projects.slice(0, 3).map(project => (
                  <Link key={project.id} to={`/lyrics?project_id=${project.id}`} className="mini-item">
                    <span className="icon">📝</span>
                    <span className="title">{project.title}</span>
                    <span className="date">{new Date(project.updated_at).toLocaleDateString('tr')}</span>
                  </Link>
                ))}
              </div>
            )}
            <Link to="/projects" className="view-all">Tümünü Gör →</Link>
          </div>

          <div className="overview-card">
            <h3>❤️ Favori Beatler</h3>
            {playlist.length === 0 ? (
              <p className="empty">Henüz favori beat yok</p>
            ) : (
              <div className="mini-list">
                {playlist.slice(0, 3).map(item => (
                  <div key={item.id} className="mini-item">
                    <span className="icon" style={{ color: item.beat?.cover_color }}>🎵</span>
                    <span className="title">{item.beat?.name}</span>
                    <span className="date">{item.beat?.genre}</span>
                  </div>
                ))}
              </div>
            )}
            <Link to="/playlist" className="view-all">Tümünü Gör →</Link>
          </div>
        </div>
      )}

      {activeTab === 'projects' && (
        <div className="projects-grid">
          {projects.length === 0 ? (
            <div className="empty-state">
              <span>📁</span>
              <p>Henüz proje oluşturmadınız</p>
              <Link to="/lyrics" className="btn btn-primary">İlk Projeyi Oluştur</Link>
            </div>
          ) : (
            projects.map(project => (
              <div key={project.id} className="project-card">
                <div className="project-header">
                  <div className="project-icon" style={{ background: `linear-gradient(135deg, #ff146a, #9b59b6)` }}>
                    📝
                  </div>
                  <div>
                    <h4 className="project-title">{project.title}</h4>
                    <p className="project-date">{new Date(project.updated_at).toLocaleDateString('tr')}</p>
                  </div>
                </div>
                
                <div className="project-preview">
                  {project.lyrics?.slice(0, 100) || 'Boş proje...'}
                </div>
                
                <div className="project-tags">
                  <span className="tag">{project.mood}</span>
                  <span className="tag">{project.energy_level}</span>
                </div>
                
                <div className="project-actions">
                  <Link to={`/lyrics?project_id=${project.id}`} className="btn btn-secondary">
                    ✏️ Düzenle
                  </Link>
                  <button className="btn btn-danger" onClick={() => deleteProject(project.id)}>
                    🗑️ Sil
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'favorites' && (
        <div className="beats-grid">
          {playlist.length === 0 ? (
            <div className="empty-state">
              <span>❤️</span>
              <p>Henüz favori beat eklemediniz</p>
              <Link to="/beats" className="btn btn-primary">Beat Keşfet</Link>
            </div>
          ) : (
            playlist.map(item => (
              <div key={item.id} className="beat-card">
                <div className="beat-header">
                  <div 
                    className="beat-cover"
                    style={{ background: `linear-gradient(135deg, ${item.beat?.cover_color}, ${item.beat?.cover_color}99)` }}
                  >
                    🎵
                  </div>
                  <div className="beat-info">
                    <h3>{item.beat?.name}</h3>
                    <p>{item.beat?.artist}</p>
                  </div>
                </div>
                <div className="beat-meta">
                  <span>{item.beat?.genre}</span>
                  <span>{item.beat?.bpm} BPM</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Edit Profile Modal */}
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Profili Düzenle</h2>
            <form onSubmit={handleUpdateProfile}>
              <div className="form-group">
                <label>Kullanıcı Adı</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>E-posta</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Biyografi</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Kendinden bahset..."
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
                  İptal
                </button>
                <button type="submit" className="btn btn-primary">
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Şifre Değiştir</h2>
            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label>Mevcut Şifre</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Yeni Şifre</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Yeni Şifre (Tekrar)</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPasswordModal(false)}>
                  İptal
                </button>
                <button type="submit" className="btn btn-primary">
                  Değiştir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}

export default Profile
