import React, { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import SongCard from '../components/SongCard'
import { songsAPI } from '../services/api'
import './Discover.css'

const Discover = () => {
  const [songs, setSongs] = useState([])
  const [topSongs, setTopSongs] = useState([])
  const [genres, setGenres] = useState([])
  const [activeGenre, setActiveGenre] = useState('Tümü')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSongs()
    fetchTopSongs()
  }, [activeGenre])

  const fetchSongs = async () => {
    try {
      const response = await songsAPI.getAll({ genre: activeGenre })
      setSongs(response.data?.songs || [])
      setGenres(response.data?.genres || [])
    } catch (error) {
      console.error('Şarkılar yüklenirken hata:', error)
      setSongs([])
      setGenres([])
    } finally {
      setLoading(false)
    }
  }

  const fetchTopSongs = async () => {
    try {
      const response = await songsAPI.getTop()
      setTopSongs(response.data?.songs?.slice(0, 5) || [])
    } catch (error) {
      console.error('Top şarkılar yüklenirken hata:', error)
      setTopSongs([])
    }
  }

  const handleRate = async (songId, rating) => {
    try {
      await songsAPI.rate(songId, rating)
      fetchSongs()
      fetchTopSongs()
    } catch (error) {
      console.error('Puanlama hatası:', error)
    }
  }

  return (
    <Layout title="Keşfet">
      <div className="hero">
        <h1>🎵 Müziğini Keşfet</h1>
        <p>Şarkıları dinle, puanla ve en iyileri top listesine taşı!</p>
      </div>

      <div className="genres-container">
        {genres.map((genre) => (
          <button
            key={genre}
            className={`genre-pill ${activeGenre === genre ? 'active' : ''}`}
            onClick={() => setActiveGenre(genre)}
          >
            {genre}
          </button>
        ))}
      </div>

      <div className="page-grid">
        <div className="songs-section">
          <h2 className="section-title">
            {activeGenre === 'Tümü' ? 'Tüm Şarkılar' : activeGenre}
            <span className="count">({songs.length})</span>
          </h2>

          {loading ? (
            <div className="loading">Yükleniyor...</div>
          ) : songs.length === 0 ? (
            <div className="empty-state">
              <span>🎵</span>
              <p>Bu kategoride henüz şarkı yok</p>
            </div>
          ) : (
            <div className="songs-list">
              {songs.map((song) => (
                <SongCard key={song.id} song={song} onRate={handleRate} />
              ))}
            </div>
          )}
        </div>

        <aside className="sidebar">
          <div className="top-songs-card">
            <h3>🔥 Top 5</h3>
            <p className="sidebar-desc">Henüz puanlama yapılmadı.</p>

            <div className="top-list">
              {topSongs.map((song, index) => (
                <div key={song.id} className="top-item">
                  <span className="rank">{index + 1}</span>
                  <div className="top-info">
                    <h4>{song.title}</h4>
                    <p>{song.artist}</p>
                  </div>
                  <span className="top-rating">⭐ {song.avg_rating}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="cta-card">
            <h3>✨ Hızlı Erişim</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a href="/beats" className="btn btn-secondary" style={{ justifyContent: 'center' }}>🎹 Free Beatler</a>
              <a href="/lyrics" className="btn btn-secondary" style={{ justifyContent: 'center' }}>✍️ Söz Yaz</a>
              <a href="/studio" className="btn btn-secondary" style={{ justifyContent: 'center' }}>➕ Şarkı Ekle</a>
            </div>
          </div>
        </aside>
      </div>
    </Layout>
  )
}

export default Discover
