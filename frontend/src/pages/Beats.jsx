import React, { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import BeatCard from '../components/BeatCard'
import { beatsAPI, playlistAPI } from '../services/api'
import './Beats.css'

const Beats = () => {
  const [beats, setBeats] = useState([])
  const [genres, setGenres] = useState([])
  const [moods, setMoods] = useState([])
  const [activeGenre, setActiveGenre] = useState('Tümü')
  const [activeMood, setActiveMood] = useState('Tümü')
  const [searchQuery, setSearchQuery] = useState('')
  const [bpmFilter, setBpmFilter] = useState('')
  const [playlist, setPlaylist] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBeats()
    fetchPlaylist()
  }, [activeGenre, activeMood, bpmFilter])

  const fetchBeats = async () => {
    try {
      const response = await beatsAPI.getAll({
        genre: activeGenre,
        mood: activeMood,
        bpm: bpmFilter,
        q: searchQuery
      })
      setBeats(response.data.beats)
      setGenres(response.data.genres)
      setMoods(response.data.moods)
    } catch (error) {
      console.error('Beatler yüklenirken hata:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPlaylist = async () => {
    try {
      const response = await playlistAPI.getAll()
      setPlaylist(response.data.playlist.map(item => item.beat_id))
    } catch (error) {
      console.error('Playlist yüklenirken hata:', error)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    fetchBeats()
  }

  const handleAddToPlaylist = async (beat) => {
    try {
      if (playlist.includes(beat.id)) {
        await playlistAPI.remove(beat.id)
        setPlaylist(playlist.filter(id => id !== beat.id))
      } else {
        await playlistAPI.add(beat.id)
        setPlaylist([...playlist, beat.id])
      }
    } catch (error) {
      console.error('Playlist hatası:', error)
    }
  }

  return (
    <Layout title="Free Beats">
      <div className="hero">
        <h1>🎹 Free Beats</h1>
        <p>Ücretsiz beat'leri keşfet, dinle ve projelerinde kullan!</p>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <form className="filters-row" onSubmit={handleSearch}>
          <div className="filter-group">
            <label>Tür</label>
            <select value={activeGenre} onChange={(e) => setActiveGenre(e.target.value)}>
              {genres.map((genre) => (
                <option key={genre} value={genre}>{genre}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Mood</label>
            <select value={activeMood} onChange={(e) => setActiveMood(e.target.value)}>
              {moods.map((mood) => (
                <option key={mood} value={mood}>{mood}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>BPM</label>
            <input
              type="number"
              placeholder="120"
              value={bpmFilter}
              onChange={(e) => setBpmFilter(e.target.value)}
            />
          </div>

          <div className="filter-group search-box">
            <label>Ara</label>
            <input
              type="text"
              placeholder="Beat adı veya etiket..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary">
            🔍 Ara
          </button>
        </form>
      </div>

      {/* Genre Pills */}
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

      {/* Beats Grid */}
      {loading ? (
        <div className="loading">Yükleniyor...</div>
      ) : beats.length === 0 ? (
        <div className="empty-state">
          <span>🎵</span>
          <p>Arama kriterlerine uygun beat bulunamadı</p>
        </div>
      ) : (
        <div className="beats-grid">
          {beats.map((beat) => (
            <BeatCard
              key={beat.id}
              beat={beat}
              isInPlaylist={playlist.includes(beat.id)}
              onAddToPlaylist={handleAddToPlaylist}
            />
          ))}
        </div>
      )}
    </Layout>
  )
}

export default Beats
