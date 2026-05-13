import React, { createContext, useState, useContext, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token')
      if (token) {
        const response = await api.get('/api/auth/me')
        setUser(response.data.user)
      }
    } catch (error) {
      localStorage.removeItem('token')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const login = async (usernameOrEmail, password, remember = false) => {
    const response = await api.post('/api/auth/login', {
      username_or_email: usernameOrEmail,
      password,
      remember
    })
    
    const { token, user: userData } = response.data
    localStorage.setItem('token', token)
    setUser(userData)
    return userData
  }

  const register = async (username, email, password, fullName = '') => {
    const response = await api.post('/api/auth/register', {
      username,
      email,
      password,
      full_name: fullName
    })
    
    const { token, user: userData } = response.data
    localStorage.setItem('token', token)
    setUser(userData)
    return userData
  }

  const logout = async () => {
    try {
      await api.post('/api/auth/logout')
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      localStorage.removeItem('token')
      setUser(null)
    }
  }

  const updateProfile = async (data) => {
    const response = await api.put('/api/auth/profile', data)
    setUser(response.data.user)
    return response.data.user
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      register, 
      logout, 
      updateProfile,
      checkAuth 
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
