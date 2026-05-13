import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { playlistAPI } from '../services/api'
import './Playlist.css'

const Playlist = () => {
  const [playlist, setPlaylist] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentPlaying, setCurrentPlaying] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState(false)
  
  const audioRef = useRef(null)
  const canvasRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const animationRef = useRef(null)
  
  const navigate = useNavigate()

  useEffect(() => {
    fetchPlaylist()
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  const fetchPlaylist = async () => {
    try {
      const response = await playlistAPI.getAll()
      setPlaylist(response.data.playlist)
    } catch (error) {
      console.error('Playlist yüklenirken hata:', error)
    } finally {
      setLoading(false)
    }
  }

  const setupAudioContext = () => {
    if (!audioContextRef.current && audioRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 128
      
      const source = audioContextRef.current.createMediaElementSource(audioRef.current)
      source.connect(analyserRef.current)
      analyserRef.current.connect(audioContextRef.current.destination)
    }
  }

  const visualize = () => {
    const canvas = canvasRef.current
    if (!canvas || !analyserRef.current) return
    
    const ctx = canvas.getContext('2d')
    const bufferLength = analyserRef.current.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    
    const draw = () => {
      animationRef.current = requestAnimationFrame(draw)
      analyserRef.current.getByteFrequencyData(dataArray)
      
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      const centerX = canvas.width / 2
      const centerY = canvas.height / 2
      const radius = 60
      
      for (let i = 0; i < bufferLength; i++) {
        const amplitude = dataArray[i] / 255
        const angle = (i / bufferLength) * Math.PI * 2
        const barHeight = amplitude * 50
        
        // Vibrating effect
        const vibrate = Math.sin(Date.now() / 30 + i * 0.5) * amplitude * 5
        
        const x1 = centerX + Math.cos(angle) * (radius + vibrate)
        const y1 = centerY + Math.sin(angle) * (radius + vibrate)
        const x2 = centerX + Math.cos(angle) * (radius + barHeight + vibrate)
        const y2 = centerY + Math.sin(angle) * (radius + barHeight + vibrate)
        
        const gradient = ctx.createLinearGradient(x1, y1, x2, y2)
        gradient.addColorStop(0, `rgba(255, 20, 106, ${0.5 + amplitude * 0.5})`)
        gradient.addColorStop(1, `rgba(155, 89, 182, ${0.3 + amplitude * 0.7})`)
        
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.strokeStyle = gradient
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        ctx.stroke()
      }
      
      // Center glow
      const glowGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)
      glowGradient.addColorStop(0, 'rgba(255, 20, 106, 0.3)')
      glowGradient.addColorStop(1, 'rgba(255, 20, 106, 0)')
      ctx.fillStyle = glowGradient
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
      ctx.fill()
    }
    
    draw()
  }

  const playBeat = (item) => {
    if (currentPlaying?.id === item.id && isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
      cancelAnimationFrame(animationRef.current)
    } else {
      setCurrentPlaying(item)
      if (audioRef.current) {
        audioRef.current.src = `http://localhost:5000${item.beat.file_url}`
        audioRef.current.play()
        setupAudioContext()
        setIsPlaying(true)
        visualize()
      }
    }
  }

  const handleRemove = async (e, beatId) => {
    e.stopPropagation()
    try {
      await playlistAPI.remove(beatId)
      setPlaylist(playlist.filter(item => item.beat_id !== beatId))
      if (currentPlaying?.beat_id === beatId) {
        audioRef.current?.pause()
        setCurrentPlaying(null)
        setIsPlaying(false)
      }
    } catch (error) {
      console.error('Kaldırma hatası:', error)
    }
  }

  const playNext = () => {
    if (!playlist.length) return
    const currentIndex = playlist.findIndex(item => item.id === currentPlaying?.id)
    let nextIndex
    
    if (shuffle) {
      nextIndex = Math.floor(Math.random() * playlist.length)
    } else {
      nextIndex = (currentIndex + 1) % playlist.length
    }
    
    playBeat(playlist[nextIndex])
  }

  const playPrev = () => {
    if (!playlist.length) return
    const currentIndex = playlist.findIndex(item => item.id === currentPlaying?.id)
    const prevIndex = currentIndex <= 0 ? playlist.length - 1 : currentIndex - 1
    playBeat(playlist[prevIndex])
  }

  const formatTime = (time) => {
    const mins = Math.floor(time / 60)
    const secs = Math.floor(time % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleSeek = (e) => {
    const rect = e.target.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    if (audioRef.current) {
      audioRef.current.currentTime = percent * duration
    }
  }

  const totalDuration = playlist.reduce((acc, item) => acc + (item.beat?.duration || 0), 0)

  return (
    <Layout title="Playlistim">
      <div className="playlist-container">
        <div className="playlist-hero">
          <div className="playlist-hero-content">
            <div className="playlist-cover">
              <canvas ref={canvasRef} width="200" height="200" className="visualizer-canvas"></canvas>
              {!isPlaying && <span className="playlist-icon">❤️</span>}
            </div>
            <div className="playlist-info">
              <span className="playlist-label">PLAYLIST</span>
              <h1>Favori Beat'lerim</h1>
              <p className="playlist-meta">
                <span>🎵 {playlist.length} şarkı</span>
                <span>•</span>
                <span>⏱️ {Math.floor(totalDuration / 60)} dakika</span>
              </p>
              <div className="playlist-actions">
                <button 
                  className="btn-play-all"
                  onClick={() => playlist.length > 0 && playBeat(playlist[0])}
                  disabled={playlist.length === 0}
                >
                  {isPlaying ? '⏸️ Duraklat' : '▶️ Tümünü Çal'}
                </button>
                <button 
                  className={`btn-shuffle ${shuffle ? 'active' : ''}`}
                  onClick={() => setShuffle(!shuffle)}
                >
                  🔀
                </button>
                <button 
                  className={`btn-repeat ${repeat ? 'active' : ''}`}
                  onClick={() => setRepeat(!repeat)}
                >
                  🔁
                </button>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Yükleniyor...</p>
          </div>
        ) : playlist.length === 0 ? (
          <div className="empty-playlist">
            <div className="empty-icon">💔</div>
            <h2>Playlist'in Boş</h2>
            <p>Beat'leri keşfet ve favorilerine ekle!</p>
            <button onClick={() => navigate('/beats')} className="btn-discover">
              🎵 Beat Keşfet
            </button>
          </div>
        ) : (
          <div className="playlist-tracks">
            <div className="tracks-header">
              <span className="track-number">#</span>
              <span className="track-title">BAŞLIK</span>
              <span className="track-genre">TÜR</span>
              <span className="track-bpm">BPM</span>
              <span className="track-duration">⏱️</span>
              <span className="track-actions"></span>
            </div>
            
            {playlist.map((item, index) => (
              <div 
                key={item.id} 
                className={`track-row ${currentPlaying?.id === item.id ? 'playing' : ''}`}
                onClick={() => playBeat(item)}
              >
                <span className="track-number">
                  {currentPlaying?.id === item.id && isPlaying ? (
                    <span className="playing-animation">
                      <span></span>
                      <span></span>
                      <span></span>
                    </span>
                  ) : (
                    index + 1
                  )}
                </span>
                <div className="track-title">
                  <div className="track-cover">
                    {item.beat?.cover_image ? (
                      <img src={`http://localhost:5000${item.beat.cover_image}`} alt="" />
                    ) : (
                      <span>🎵</span>
                    )}
                  </div>
                  <div className="track-info">
                    <span className="track-name">{item.beat?.name}</span>
                    <span className="track-artist">{item.beat?.mood}</span>
                  </div>
                </div>
                <span className="track-genre">{item.beat?.genre}</span>
                <span className="track-bpm">{item.beat?.bpm}</span>
                <span className="track-duration">{item.beat?.duration ? formatTime(item.beat.duration) : '--:--'}</span>
                <div className="track-actions">
                  <button 
                    className="btn-use-studio"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate('/studio', { state: { beatId: item.beat?.id } })
                    }}
                  >
                    🎙️
                  </button>
                  <button 
                    className="btn-remove"
                    onClick={(e) => handleRemove(e, item.beat?.id)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Now Playing Bar */}
        {currentPlaying && (
          <div className="now-playing-bar">
            <div className="now-playing-info">
              <div className="now-playing-cover">
                {currentPlaying.beat?.cover_image ? (
                  <img src={`http://localhost:5000${currentPlaying.beat.cover_image}`} alt="" />
                ) : (
                  <span>🎵</span>
                )}
              </div>
              <div className="now-playing-text">
                <span className="now-playing-name">{currentPlaying.beat?.name}</span>
                <span className="now-playing-genre">{currentPlaying.beat?.genre}</span>
              </div>
            </div>
            
            <div className="now-playing-controls">
              <button onClick={playPrev}>⏮️</button>
              <button className="play-pause" onClick={() => playBeat(currentPlaying)}>
                {isPlaying ? '⏸️' : '▶️'}
              </button>
              <button onClick={playNext}>⏭️</button>
            </div>
            
            <div className="now-playing-progress">
              <span>{formatTime(currentTime)}</span>
              <div className="progress-bar" onClick={handleSeek}>
                <div 
                  className="progress-fill" 
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                ></div>
              </div>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        )}

        <audio 
          ref={audioRef}
          onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.target.duration)}
          onEnded={() => {
            if (repeat) {
              audioRef.current.currentTime = 0
              audioRef.current.play()
            } else {
              playNext()
            }
          }}
        />
      </div>
    </Layout>
  )
}

export default Playlist
