import React, { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import SongCard from '../components/SongCard'
import { songsAPI } from '../services/api'
import './Top.css'

const Top = () => {
  const [topSongs, setTopSongs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTopSongs()
  }, [])

  const fetchTopSongs = async () => {
    try {
      const response = await songsAPI.getTop()
      setTopSongs(response.data.songs)
    } catch (error) {
      console.error('Top şarkılar yüklenirken hata:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout title="Top 50">
      <div className="hero top-hero">
        <div className="hero-badge">🏆</div>
        <h1>Top 50</h1>
        <p>En çok dinlenen ve beğenilen şarkılar</p>
      </div>

      {loading ? (
        <div className="loading">Yükleniyor...</div>
      ) : topSongs.length === 0 ? (
        <div className="empty-state">
          <span>🎵</span>
          <p>Henüz yeterli veri yok</p>
        </div>
      ) : (
        <div className="top-list">
          {topSongs.map((song, index) => (
            <div key={song.id} className="top-item">
              <div className={`rank ${index < 3 ? 'top-three' : ''}`}>
                {index === 0 && '🥇'}
                {index === 1 && '🥈'}
                {index === 2 && '🥉'}
                {index > 2 && (index + 1)}
              </div>
              <SongCard song={song} compact />
              <div className="stats">
                <span className="plays">▶️ {song.plays || 0}</span>
                <span className="rating">⭐ {song.rating?.toFixed(1) || '—'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}

export default Top
