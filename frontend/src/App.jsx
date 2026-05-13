import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

// Pages
import Login from './pages/Login'
import Register from './pages/Register'
import Discover from './pages/Discover'
import Beats from './pages/Beats'
import Lyrics from './pages/Lyrics'
import Profile from './pages/Profile'
import Playlist from './pages/Playlist'
import Projects from './pages/Projects'
import Studio from './pages/Studio'
import Mixer from './pages/Mixer'
import BeatMaker from './pages/BeatMaker'
import Recommendations from './pages/Recommendations'
import Top from './pages/Top'
import KaraokeLobby from './pages/KaraokeLobby'
import KaraokeRoom from './pages/KaraokeRoom'

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p>Yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes */}
          <Route path="/" element={<Navigate to="/discover" />} />
          <Route path="/discover" element={<ProtectedRoute><Discover /></ProtectedRoute>} />
          <Route path="/beats" element={<ProtectedRoute><Beats /></ProtectedRoute>} />
          <Route path="/lyrics" element={<ProtectedRoute><Lyrics /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/playlist" element={<ProtectedRoute><Playlist /></ProtectedRoute>} />
          <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
          <Route path="/studio" element={<ProtectedRoute><Studio /></ProtectedRoute>} />
          <Route path="/mixer" element={<ProtectedRoute><Mixer /></ProtectedRoute>} />
          <Route path="/beatmaker" element={<ProtectedRoute><BeatMaker /></ProtectedRoute>} />
          <Route path="/recommendations" element={<ProtectedRoute><Recommendations /></ProtectedRoute>} />
          <Route path="/top" element={<ProtectedRoute><Top /></ProtectedRoute>} />
          <Route path="/karaoke" element={<ProtectedRoute><KaraokeLobby /></ProtectedRoute>} />
          <Route path="/karaoke/:roomCode" element={<ProtectedRoute><KaraokeRoom /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App

