import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import FloatingNotes from '../components/FloatingNotes'
import GoogleAuthModal from '../components/GoogleAuthModal'
import './Auth.css'

const Login = () => {
  const [loginType, setLoginType] = useState('username') // 'username' veya 'email'
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [emailUsername, setEmailUsername] = useState('')
  const [emailDomain, setEmailDomain] = useState('@gmail.com')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleModalOpen, setGoogleModalOpen] = useState(false)

  const { login, user } = useAuth()
  const navigate = useNavigate()

  // Giriş için kullanılacak değer
  const loginValue = loginType === 'email' ? emailUsername + emailDomain : usernameOrEmail

  useEffect(() => {
    if (user) {
      navigate('/discover')
    }
  }, [user, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      console.log('Giriş başlatılıyor:', loginValue)
      await login(loginValue, password, remember)
      console.log('Giriş başarılı!')
      navigate('/discover')
    } catch (err) {
      console.error('Giriş hatası:', err)
      const errorMessage = err.response?.data?.error || err.message || 'Giriş başarısız. Lütfen tekrar deneyin.'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <FloatingNotes />

      <div className="auth-container">
        <Link to="/discover" className="back-link">← Ana Sayfa</Link>

        <div className="auth-card">
          <div className="logo">
            <div className="logo-text">
              <span className="f">F</span>
              <span className="on">ON</span>
              <span className="ix">IX</span>
            </div>
            <p>Müzik yaratmaya başla</p>
          </div>

          <h2>Hoş Geldin! 👋</h2>
          <p className="subtitle">Hesabına giriş yap ve müzik yolculuğuna devam et</p>

          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Giriş Türü</label>
              <div className="login-type-toggle">
                <button
                  type="button"
                  className={`toggle-btn ${loginType === 'username' ? 'active' : ''}`}
                  onClick={() => setLoginType('username')}
                >
                  Kullanıcı Adı
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${loginType === 'email' ? 'active' : ''}`}
                  onClick={() => setLoginType('email')}
                >
                  E-posta
                </button>
              </div>
            </div>

            {loginType === 'username' ? (
              <div className="form-group">
                <label>Kullanıcı Adı</label>
                <input
                  type="text"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  placeholder="kullanici_adi"
                  required
                />
              </div>
            ) : (
              <div className="form-group">
                <label>E-posta</label>
                <div className="email-input-group">
                  <input
                    type="text"
                    value={emailUsername}
                    onChange={(e) => setEmailUsername(e.target.value)}
                    placeholder="kullanici"
                    required
                    className="email-username"
                  />
                  <select
                    value={emailDomain}
                    onChange={(e) => setEmailDomain(e.target.value)}
                    className="email-domain"
                  >
                    <option value="@gmail.com">@gmail.com</option>
                    <option value="@hotmail.com">@hotmail.com</option>
                    <option value="@outlook.com">@outlook.com</option>
                    <option value="@yahoo.com">@yahoo.com</option>
                    <option value="@icloud.com">@icloud.com</option>
                    <option value="@yandex.com">@yandex.com</option>
                  </select>
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Şifre</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <div className="remember-row">
              <label>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Beni hatırla
              </label>
              <a href="#forgot">Şifremi unuttum</a>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '⏳ Giriş yapılıyor...' : '🚀 Giriş Yap'}
            </button>
          </form>

          <div className="divider">
            <span>veya</span>
          </div>

          <div className="social-buttons">
            <button
              type="button"
              className="social-btn google"
              onClick={() => setGoogleModalOpen(true)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>Google ile Giriş</span>
            </button>
          </div>

          <GoogleAuthModal
            isOpen={googleModalOpen}
            onClose={() => setGoogleModalOpen(false)}
            mode="login"
          />

          <p className="auth-link">
            Hesabın yok mu? <Link to="/register">Kayıt Ol</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
