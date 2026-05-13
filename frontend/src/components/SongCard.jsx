import React, { useState } from 'react'
import './SongCard.css'

// Genre'ye göre gerçek kapak resimleri
const genreImages = {
  'Pop': 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop',
  'Rap': 'https://images.unsplash.com/photo-1499415479124-43c32433a620?w=200&h=200&fit=crop',
  'Rock': 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=200&h=200&fit=crop',
  'Lo-fi': 'https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?w=200&h=200&fit=crop',
  'Chill': 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=200&h=200&fit=crop',
  'Elektronik': 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?w=200&h=200&fit=crop',
  'Arabesk': 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop',
  'Jazz': 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=200&h=200&fit=crop',
  'R&B': 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=200&h=200&fit=crop',
  'Hip-Hop': 'https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=200&h=200&fit=crop',
  'default': 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=200&h=200&fit=crop'
}

const SongCard = ({ song, onRate }) => {
  const [userRating, setUserRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [imageError, setImageError] = useState(false)

  const handleRate = (rating) => {
    setUserRating(rating)
    if (onRate) {
      onRate(song.id, rating)
    }
  }

  const getCoverImage = () => {
    if (song.cover_image && !imageError) return song.cover_image
    return genreImages[song.genre] || genreImages['default']
  }

  return (
    <div className="song-card">
      <div className="song-header">
        <div className="song-cover">
          <img 
            src={getCoverImage()} 
            alt={song.title}
            onError={() => setImageError(true)}
          />
        </div>
        <div className="song-info">
          <h3>{song.title}</h3>
          <p>{song.artist}</p>
        </div>
        <span className="song-genre">{song.genre}</span>
      </div>

      {song.url && (
        <div className="song-player">
          <audio controls src={song.url} preload="none">
            Tarayıcınız ses öğesini desteklemiyor.
          </audio>
        </div>
      )}

      <div className="song-footer">
        <div className="rating-section">
          <span className="avg-rating">⭐ {song.avg_rating || 0}</span>
          <span className="rating-count">({song.rating_count || 0} oy)</span>
        </div>

        <div className="rate-stars">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              className={`star-btn ${(hoveredRating || userRating) >= star ? 'active' : ''}`}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              onClick={() => handleRate(star)}
            >
              ⭐
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SongCard
