import axios from 'axios'

// Local'de proxy üzerinden, production'da VITE_API_URL env değişkeni
const API_URL = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000
})

// Request interceptor - token ekleme
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    console.log('API Request:', config.method?.toUpperCase(), config.url)
    return config
  },
  (error) => {
    console.error('API Request Error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor - hata yakalama
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.config.url)
    return response
  },
  (error) => {
    console.error('API Error:', error.response?.status, error.response?.data || error.message)
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      // Don't redirect on login/register pages
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api

// API fonksiyonları
export const authAPI = {
  login: (data) => api.post('/api/auth/login', data),
  register: (data) => api.post('/api/auth/register', data),
  logout: () => api.post('/api/auth/logout'),
  getMe: () => api.get('/api/auth/me'),
  updateProfile: (data) => api.put('/api/auth/profile', data),
  changePassword: (data) => api.put('/api/auth/password', data)
}

export const songsAPI = {
  getAll: (params) => api.get('/api/songs', { params }),
  getById: (id) => api.get(`/api/songs/${id}`),
  rate: (id, rating) => api.post(`/api/songs/${id}/rate`, { rating }),
  getTop: () => api.get('/api/songs/top')
}

export const beatsAPI = {
  getAll: (params) => api.get('/api/beats', { params }),
  getById: (id) => api.get(`/api/beats/${id}`),
  recommend: (data) => api.post('/api/beat-recommend', data)
}

export const projectsAPI = {
  getAll: () => api.get('/api/projects'),
  getById: (id) => api.get(`/api/projects/${id}`),
  create: (data) => api.post('/api/projects', data),
  update: (id, data) => api.put(`/api/projects/${id}`, data),
  delete: (id) => api.delete(`/api/projects/${id}`)
}

export const playlistAPI = {
  getAll: () => api.get('/api/playlist'),
  add: (beatId) => api.post('/api/playlist/add', { beat_id: beatId }),
  remove: (beatId) => api.post('/api/playlist/remove', { beat_id: beatId })
}

export const chatAPI = {
  send: (message, context) => api.post('/api/chat', { message, context })
}

export const lyricsAPI = {
  generate: (lyrics) => api.post('/api/lyrics/generate', { lyrics }),
  analyze: (lyrics) => api.post('/api/lyrics/analyze', { lyrics }),
  fetch: (artist, title) => api.get(`/api/lyrics/fetch?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`)
}

export const karaokeAPI = {
  getRooms: () => api.get('/api/karaoke/rooms'),
  getRoom: (roomCode) => api.get(`/api/karaoke/rooms/${roomCode}`),
  createRoom: (data) => api.post('/api/karaoke/rooms', data),
  joinRoom: (roomCode) => api.post(`/api/karaoke/rooms/${roomCode}/join`),
  leaveRoom: (roomCode) => api.post(`/api/karaoke/rooms/${roomCode}/leave`),
  deleteRoom: (roomCode) => api.delete(`/api/karaoke/rooms/${roomCode}`),
  changeBeat: (roomCode, beatId) => api.post(`/api/karaoke/rooms/${roomCode}/beat`, { beat_id: beatId }),
  getYouTubeAudio: (url) => api.post('/api/karaoke/youtube', { url }),
  setRoomYouTube: (roomCode, youtubeData, lyrics) => api.post(`/api/karaoke/rooms/${roomCode}/youtube`, { youtube_data: youtubeData, lyrics })
}

