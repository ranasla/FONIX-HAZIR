import React, { useState, useRef } from 'react'
import './BeatCard.css'

const API_URL = 'http://localhost:5000'

// Genre'ye göre gerçek kapak resimleri
const genreImages = {
  'Trap': 'https://images.unsplash.com/photo-1571974599782-87624638275e?w=300&h=300&fit=crop',
  'Drill': 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
  'Lo-fi': 'https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?w=300&h=300&fit=crop',
  'Boom Bap': 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop',
  'R&B': 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=300&h=300&fit=crop',
  'Pop': 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop',
  'Rap': 'https://images.unsplash.com/photo-1499415479124-43c32433a620?w=300&h=300&fit=crop',
  'Hip-Hop': 'https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=300&h=300&fit=crop',
  'Rock': 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=300&h=300&fit=crop',
  'Elektronik': 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?w=300&h=300&fit=crop',
  'Jazz': 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=300&h=300&fit=crop',
  'Chill': 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300&h=300&fit=crop',
  'default': 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=300&h=300&fit=crop'
}

const BeatCard = ({ beat, onPlay, onAddToPlaylist, isInPlaylist, onSelect, isSelected }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [imageError, setImageError] = useState(false)
  const audioRef = useRef(null)

  const handlePlayClick = (e) => {
    e.stopPropagation()
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        audioRef.current.play()
        setIsPlaying(true)
      }
    }
    if (onPlay) onPlay(beat)
  }

  const getAudioUrl = () => {
    if (beat.file_url) {
      return `${API_URL}${beat.file_url}`
    }
    if (beat.url) {
      if (beat.url.startsWith('http')) return beat.url
      return `${API_URL}${beat.url}`
    }
    return null
  }

  const audioUrl = getAudioUrl()
  
  // Genre'ye göre kapak resmi seç
  const getCoverImage = () => {
    if (beat.cover_image && !imageError) return beat.cover_image
    return genreImages[beat.genre] || genreImages['default']
  }

  return (
    <div className={`beat-card ${isSelected ? 'selected' : ''}`} onClick={onSelect}>
      <div className="beat-header">
        <div className="beat-cover">
          <img 
            src={getCoverImage()} 
            alt={beat.name}
            onError={() => setImageError(true)}
          />
          <div className="beat-cover-overlay">
            {isPlaying ? '🎶' : '▶️'}
          </div>
        </div>
        <div className="beat-info">
          <h3>{beat.name}</h3>
          <p>{beat.artist || 'FONIX'}</p>
          <div className="beat-tags">
            <span className="beat-tag">{beat.genre}</span>
            <span className="beat-tag">{beat.mood}</span>
          </div>
        </div>
      </div>

      <div className="beat-meta">
        <span>🎹 {beat.bpm} BPM</span>
        {beat.duration && <span>⏱️ {beat.duration}s</span>}
        <span>📜 {beat.license_info || 'Free'}</span>
      </div>

      {audioUrl && (
        <div className="beat-player">
          <audio 
            ref={audioRef}
            controls 
            src={audioUrl} 
            preload="none"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
          >
            Tarayıcınız ses öğesini desteklemiyor.
          </audio>
        </div>
      )}

      <div className="beat-actions">
        {audioUrl && (
          <button 
            className={`btn ${isPlaying ? 'btn-playing' : 'btn-primary'}`} 
            onClick={handlePlayClick}
          >
            {isPlaying ? '⏸️ Duraklat' : '▶️ Dinle'}
          </button>
        )}
        {onAddToPlaylist && (
          <button 
            className={`btn ${isInPlaylist ? 'btn-danger' : 'btn-secondary'}`}
            onClick={(e) => { e.stopPropagation(); onAddToPlaylist(beat); }}
          >
            {isInPlaylist ? '💔 Kaldır' : '❤️ Ekle'}
          </button>
        )}
      </div>
    </div>
  )
}

export default BeatCard
