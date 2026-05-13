import React, { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import FloatingNotes from './FloatingNotes'

const Layout = ({ children, title }) => {
  const { user, logout } = useAuth()
  const location = useLocation()

  useEffect(() => {
    document.title = title ? `FONIX – ${title}` : 'FONIX'
  }, [title])

  const isActive = (path) => location.pathname === path

  return (
    <>
      <FloatingNotes />

      <header>
        <Link to="/discover" className="logo">
          <span className="f">F</span>
          <span className="on">ON</span>
          <span className="ix">IX</span>
        </Link>

        <nav className="nav-links">
          <Link to="/discover" className={isActive('/discover') ? 'active' : ''}>
            🏠 Keşfet
          </Link>
          <Link to="/beats" className={isActive('/beats') ? 'active' : ''}>
            🎹 Beatler
          </Link>
          <Link to="/karaoke" className={isActive('/karaoke') ? 'active' : ''}>
            🎤 Karaoke
          </Link>
          <Link to="/studio" className={isActive('/studio') ? 'active' : ''}>
            🎙️ Stüdyo
          </Link>
          <Link to="/lyrics" className={isActive('/lyrics') ? 'active' : ''}>
            ✍️ Söz Yaz
          </Link>
          <Link to="/top" className={isActive('/top') ? 'active' : ''}>
            🏆 Top 10
          </Link>
          {user ? (
            <>
              <Link to="/profile" className={isActive('/profile') ? 'active' : ''}>
                👤 {user.username}
              </Link>
              <button onClick={logout} className="nav-logout-btn">
                🚪 Çıkış
              </button>
            </>
          ) : (
            <Link to="/login">🔐 Giriş</Link>
          )}
        </nav>
      </header>

      <main>
        {children}
      </main>
    </>
  )
}

export default Layout
