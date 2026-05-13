import React, { useState } from 'react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import './GoogleAuthModal.css'

const GOOGLE_ACCOUNTS = [
  {
    name: 'Rana Sıla',
    email: 'ranasila@gmail.com',
    avatar: 'R',
    color: '#4AADE8'
  },
  {
    name: 'Fonix Kullanıcı',
    email: 'fonix.user@gmail.com',
    avatar: 'F',
    color: '#ff146a'
  }
]

const GoogleAuthModal = ({ isOpen, onClose, mode = 'login' }) => {
  const [loading, setLoading] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [error, setError] = useState('')
  const { checkAuth } = useAuth()
  const navigate = useNavigate()

  if (!isOpen) return null

  const handleSelectAccount = async (account) => {
    setSelectedAccount(account)
    setLoading(true)
    setError('')

    try {
      const response = await api.post('/api/auth/google-simulate', {
        email: account.email,
        name: account.name,
        avatar: account.avatar
      })

      const { token, user } = response.data
      localStorage.setItem('token', token)
      await checkAuth()
      onClose()
      navigate('/discover')
    } catch (err) {
      setError(err.response?.data?.error || 'Google ile giriş başarısız.')
      setSelectedAccount(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="google-modal-overlay" onClick={onClose}>
      <div className="google-modal" onClick={(e) => e.stopPropagation()}>
        {/* Google Logo Header */}
        <div className="google-modal-header">
          <svg className="google-logo-svg" viewBox="0 0 24 24" width="24" height="24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          <span className="google-modal-title">Google</span>
          <button className="google-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="google-modal-body">
          <h2 className="google-choose-title">Hesap seçin</h2>
          <p className="google-choose-sub">
            FONIX'e {mode === 'login' ? 'giriş yapmak' : 'devam etmek'} için
          </p>

          {error && <div className="google-error">{error}</div>}

          <div className="google-accounts-list">
            {GOOGLE_ACCOUNTS.map((account, i) => (
              <button
                key={i}
                className={`google-account-item ${selectedAccount?.email === account.email && loading ? 'loading' : ''}`}
                onClick={() => handleSelectAccount(account)}
                disabled={loading}
              >
                <div className="google-account-avatar" style={{ background: account.color }}>
                  {account.avatar}
                </div>
                <div className="google-account-info">
                  <span className="google-account-name">{account.name}</span>
                  <span className="google-account-email">{account.email}</span>
                </div>
                {selectedAccount?.email === account.email && loading ? (
                  <div className="google-spinner" />
                ) : (
                  <svg className="google-arrow" viewBox="0 0 24 24" width="18" height="18">
                    <path fill="#5f6368" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                  </svg>
                )}
              </button>
            ))}

            <button className="google-add-account" onClick={() => {}}>
              <div className="google-add-icon">
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="#5f6368" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
                </svg>
              </div>
              <span>Başka bir hesap kullan</span>
            </button>
          </div>

          <div className="google-modal-footer">
            <a href="#terms" className="google-footer-link">Gizlilik Politikası</a>
            <span className="google-footer-dot">•</span>
            <a href="#terms" className="google-footer-link">Hizmet Şartları</a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GoogleAuthModal
