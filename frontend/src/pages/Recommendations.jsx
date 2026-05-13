import React, { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import SongCard from '../components/SongCard'
import { songsAPI } from '../services/api'
import './Recommendations.css'

const Recommendations = () => {
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRecommendations()
  }, [])

  const fetchRecommendations = async () => {
    try {
      const response = await songsAPI.getRecommendations()
      setRecommendations(response.data.recommendations)
    } catch (error) {
      console.error('Öneriler yüklenirken hata:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout title="Öneriler">
      <div className="hero">
        <h1>✨ Senin İçin Öneriler</h1>
        <p>Dinleme geçmişine ve beğenilerine göre seçilmiş şarkılar</p>
      </div>

      {loading ? (
        <div className="loading">Öneriler yükleniyor...</div>
      ) : recommendations.length === 0 ? (
        <div className="empty-state">
          <span>🎵</span>
          <p>Henüz yeterli veri yok. Daha fazla şarkı dinle!</p>
          <a href="/discover" className="btn btn-primary">Keşfet</a>
        </div>
      ) : (
        <div className="recommendations-grid">
          {recommendations.map(rec => (
            <div key={rec.song.id} className="recommendation-card">
              <div className="recommendation-reason">
                <span className="reason-icon">💡</span>
                <span className="reason-text">{rec.reason}</span>
              </div>
              <SongCard song={rec.song} />
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}

export default Recommendations
