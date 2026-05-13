import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { beatsAPI, projectsAPI } from '../services/api'
import './Mixer.css'

const Mixer = () => {
  const [beats, setBeats] = useState([])
  const [selectedBeat, setSelectedBeat] = useState(null)
  const [recordings, setRecordings] = useState([])
  const [mixedAudio, setMixedAudio] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [beatVolume, setBeatVolume] = useState(70)
  const [voiceVolume, setVoiceVolume] = useState(100)
  const [voiceDelay, setVoiceDelay] = useState(0)
  const [reverbAmount, setReverbAmount] = useState(20)
  const [isExporting, setIsExporting] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  
  const canvasRef = useRef(null)
  const beatAudioRef = useRef(null)
  const voiceAudioRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const animationRef = useRef(null)
  
  const navigate = useNavigate()

  useEffect(() => {
    fetchBeats()
    loadRecordings()
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  const fetchBeats = async () => {
    try {
      const response = await beatsAPI.getAll()
      setBeats(response.data.beats)
    } catch (error) {
      console.error('Beat yüklenirken hata:', error)
    }
  }

  const loadRecordings = () => {
    const savedRecordings = JSON.parse(localStorage.getItem('fonix_recordings') || '[]')
    setRecordings(savedRecordings)
  }

  const setupAudioContext = (audioElement) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      
      const source = audioContextRef.current.createMediaElementSource(audioElement)
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
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      const barWidth = (canvas.width / bufferLength) * 2.5
      let x = 0
      
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.8
        
        // Vibrating effect
        const vibrate = Math.sin(Date.now() / 50 + i) * 3
        
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight)
        gradient.addColorStop(0, '#ff146a')
        gradient.addColorStop(0.5, '#ff7ab8')
        gradient.addColorStop(1, '#9b59b6')
        
        ctx.fillStyle = gradient
        ctx.fillRect(x, canvas.height - barHeight + vibrate, barWidth - 2, barHeight)
        
        // Mirror effect
        ctx.fillStyle = gradient
        ctx.globalAlpha = 0.3
        ctx.fillRect(x, 0, barWidth - 2, barHeight / 3 + vibrate)
        ctx.globalAlpha = 1
        
        x += barWidth
      }
      
      // Center glow
      const centerGradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width / 2
      )
      centerGradient.addColorStop(0, 'rgba(255, 20, 106, 0.1)')
      centerGradient.addColorStop(1, 'transparent')
      ctx.fillStyle = centerGradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    
    draw()
  }

  const handleBeatSelect = (beat) => {
    setSelectedBeat(beat)
    if (beatAudioRef.current) {
      // file_url veya url kullan
      const audioUrl = beat.file_url || beat.url
      const fullUrl = audioUrl.startsWith('http') ? audioUrl : `http://localhost:5000${audioUrl}`
      beatAudioRef.current.src = fullUrl
      beatAudioRef.current.volume = beatVolume / 100
    }
  }

  const handleVoiceSelect = (recording) => {
    if (voiceAudioRef.current) {
      voiceAudioRef.current.src = recording.blob
      voiceAudioRef.current.volume = voiceVolume / 100
    }
  }

  const playMix = () => {
    if (beatAudioRef.current && selectedBeat) {
      setupAudioContext(beatAudioRef.current)
      
      // Apply delay to voice
      setTimeout(() => {
        if (voiceAudioRef.current && voiceAudioRef.current.src) {
          voiceAudioRef.current.play()
        }
      }, voiceDelay * 1000)
      
      beatAudioRef.current.play()
      setIsPlaying(true)
      visualize()
    }
  }

  const pauseMix = () => {
    if (beatAudioRef.current) beatAudioRef.current.pause()
    if (voiceAudioRef.current) voiceAudioRef.current.pause()
    setIsPlaying(false)
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
  }

  const stopMix = () => {
    if (beatAudioRef.current) {
      beatAudioRef.current.pause()
      beatAudioRef.current.currentTime = 0
    }
    if (voiceAudioRef.current) {
      voiceAudioRef.current.pause()
      voiceAudioRef.current.currentTime = 0
    }
    setIsPlaying(false)
    setCurrentTime(0)
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
  }

  const handleBeatVolumeChange = (e) => {
    const value = parseInt(e.target.value)
    setBeatVolume(value)
    if (beatAudioRef.current) {
      beatAudioRef.current.volume = value / 100
    }
  }

  const handleVoiceVolumeChange = (e) => {
    const value = parseInt(e.target.value)
    setVoiceVolume(value)
    if (voiceAudioRef.current) {
      voiceAudioRef.current.volume = value / 100
    }
  }

  const exportMix = async () => {
    setIsExporting(true)
    // Simulating export process
    setTimeout(() => {
      alert('Mix başarıyla dışa aktarıldı!')
      setIsExporting(false)
    }, 2000)
  }

  const formatTime = (time) => {
    const mins = Math.floor(time / 60)
    const secs = Math.floor(time % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Layout title="Mikser">
      <div className="mixer-container">
        <div className="mixer-hero">
          <h1>🎚️ Ses Mikseri</h1>
          <p>Beat ve ses kaydını birleştir, profesyonel parçalar oluştur!</p>
        </div>

        <div className="mixer-main">
          {/* Visualization */}
          <div className="visualization-section">
            <canvas ref={canvasRef} width="800" height="200" className="mixer-canvas"></canvas>
            
            <div className="playback-controls">
              <button className="control-btn" onClick={stopMix}>
                ⏹️
              </button>
              {isPlaying ? (
                <button className="control-btn play-btn" onClick={pauseMix}>
                  ⏸️
                </button>
              ) : (
                <button className="control-btn play-btn" onClick={playMix} disabled={!selectedBeat}>
                  ▶️
                </button>
              )}
              <div className="time-display">
                <span>{formatTime(currentTime)}</span>
                <span>/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>

          <div className="mixer-content">
            {/* Beat Track */}
            <div className="track-section">
              <div className="track-header">
                <span className="track-icon">🎵</span>
                <h3>Beat Kanalı</h3>
              </div>
              
              <div className="beat-selector">
                <select 
                  onChange={(e) => {
                    const beat = beats.find(b => b.id === parseInt(e.target.value))
                    if (beat) handleBeatSelect(beat)
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>Beat seçin...</option>
                  {beats.map(beat => (
                    <option key={beat.id} value={beat.id}>{beat.name} - {beat.bpm} BPM</option>
                  ))}
                </select>
              </div>

              {selectedBeat && (
                <div className="selected-beat-info">
                  <span>🎶 {selectedBeat.name}</span>
                  <span>🎹 {selectedBeat.bpm} BPM</span>
                  <span>🎸 {selectedBeat.genre}</span>
                </div>
              )}

              <div className="volume-control">
                <label>Beat Ses Seviyesi</label>
                <div className="volume-slider">
                  <span>🔈</span>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={beatVolume}
                    onChange={handleBeatVolumeChange}
                  />
                  <span>🔊</span>
                  <span className="volume-value">{beatVolume}%</span>
                </div>
              </div>
            </div>

            {/* Voice Track */}
            <div className="track-section">
              <div className="track-header">
                <span className="track-icon">🎤</span>
                <h3>Ses Kanalı</h3>
              </div>
              
              <div className="voice-selector">
                {recordings.length > 0 ? (
                  <select 
                    onChange={(e) => {
                      const rec = recordings[parseInt(e.target.value)]
                      if (rec) handleVoiceSelect(rec)
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>Kayıt seçin...</option>
                    {recordings.map((rec, idx) => (
                      <option key={idx} value={idx}>
                        Kayıt {idx + 1} - {new Date(rec.timestamp).toLocaleDateString('tr-TR')}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="no-recordings">
                    <p>Henüz kayıt yok</p>
                    <button onClick={() => navigate('/studio')} className="btn-studio">
                      🎙️ Stüdyoya Git
                    </button>
                  </div>
                )}
              </div>

              <div className="volume-control">
                <label>Ses Seviyesi</label>
                <div className="volume-slider">
                  <span>🔈</span>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={voiceVolume}
                    onChange={handleVoiceVolumeChange}
                  />
                  <span>🔊</span>
                  <span className="volume-value">{voiceVolume}%</span>
                </div>
              </div>

              <div className="delay-control">
                <label>Ses Gecikmesi</label>
                <div className="delay-slider">
                  <span>0s</span>
                  <input 
                    type="range" 
                    min="0" 
                    max="5" 
                    step="0.1"
                    value={voiceDelay}
                    onChange={(e) => setVoiceDelay(parseFloat(e.target.value))}
                  />
                  <span>5s</span>
                  <span className="delay-value">{voiceDelay.toFixed(1)}s</span>
                </div>
              </div>
            </div>

            {/* Effects */}
            <div className="effects-section">
              <h3>🎛️ Efektler</h3>
              
              <div className="effect-control">
                <label>Reverb</label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={reverbAmount}
                  onChange={(e) => setReverbAmount(parseInt(e.target.value))}
                />
                <span>{reverbAmount}%</span>
              </div>
            </div>
          </div>

          {/* Export Section */}
          <div className="export-section">
            <button 
              className="export-btn"
              onClick={exportMix}
              disabled={!selectedBeat || isExporting}
            >
              {isExporting ? (
                <>⏳ Dışa Aktarılıyor...</>
              ) : (
                <>💾 Mix'i Dışa Aktar</>
              )}
            </button>
            
            <button 
              className="save-project-btn"
              onClick={() => {
                // Save as project
                alert('Proje kaydedildi!')
              }}
              disabled={!selectedBeat}
            >
              📁 Proje Olarak Kaydet
            </button>
          </div>
        </div>

        {/* Hidden Audio Elements */}
        <audio 
          ref={beatAudioRef} 
          onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.target.duration)}
          onEnded={() => setIsPlaying(false)}
        />
        <audio ref={voiceAudioRef} />
      </div>
    </Layout>
  )
}

export default Mixer
