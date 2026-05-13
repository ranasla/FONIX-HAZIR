import React, { useState, useEffect, useRef, useCallback } from 'react'
import Layout from '../components/Layout'
import { beatsAPI, projectsAPI } from '../services/api'
import './Studio.css'

const Studio = () => {
  // Beat state
  const [beats, setBeats] = useState([])
  const [selectedBeat, setSelectedBeat] = useState(null)
  const [beatSearch, setBeatSearch] = useState('')
  const [beatVolume, setBeatVolume] = useState(0.7)
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [recordings, setRecordings] = useState([])
  const [activeRecording, setActiveRecording] = useState(null)
  
  // Audio visualization
  const [audioData, setAudioData] = useState(new Uint8Array(0))
  const [isPlaying, setIsPlaying] = useState(false)
  
  // Project state
  const [projectTitle, setProjectTitle] = useState('')
  const [projectLyrics, setProjectLyrics] = useState('')
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Refs
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const beatAudioRef = useRef(null)
  const recordedAudioRef = useRef(null)
  const timerRef = useRef(null)
  const analyserRef = useRef(null)
  const audioContextRef = useRef(null)
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    fetchBeats()
    return () => {
      cleanup()
    }
  }, [])

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
    }
  }

  const fetchBeats = async () => {
    try {
      const response = await beatsAPI.getAll()
      setBeats(response.data.beats)
    } catch (error) {
      console.error('Beat listesi yüklenemedi:', error)
    }
  }

  // Audio Visualization
  const setupAudioVisualization = useCallback((stream) => {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
    analyserRef.current = audioContextRef.current.createAnalyser()
    const source = audioContextRef.current.createMediaStreamSource(stream)
    source.connect(analyserRef.current)
    analyserRef.current.fftSize = 256
    
    const bufferLength = analyserRef.current.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    
    const draw = () => {
      if (!analyserRef.current) return
      animationRef.current = requestAnimationFrame(draw)
      analyserRef.current.getByteFrequencyData(dataArray)
      setAudioData(new Uint8Array(dataArray))
      drawWaveform(dataArray)
    }
    
    draw()
  }, [])

  const drawWaveform = (dataArray) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height
    
    ctx.fillStyle = 'rgba(15, 15, 26, 0.3)'
    ctx.fillRect(0, 0, width, height)
    
    const barWidth = (width / dataArray.length) * 2.5
    let x = 0
    
    for (let i = 0; i < dataArray.length; i++) {
      const barHeight = (dataArray[i] / 255) * height * 0.8
      
      const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height)
      gradient.addColorStop(0, '#ff146a')
      gradient.addColorStop(0.5, '#ff7ab8')
      gradient.addColorStop(1, '#9b59b6')
      
      ctx.fillStyle = gradient
      ctx.fillRect(x, height - barHeight, barWidth - 2, barHeight)
      
      x += barWidth
    }
  }

  // Beat selection
  const selectBeat = (beat) => {
    setSelectedBeat(beat)
    if (beatAudioRef.current) {
      // file_url veya url kullan, http ile başlamıyorsa API URL ekle
      const audioUrl = beat.file_url || beat.url
      const fullUrl = audioUrl.startsWith('http') ? audioUrl : `http://localhost:5000${audioUrl}`
      beatAudioRef.current.src = fullUrl
      beatAudioRef.current.volume = beatVolume
      beatAudioRef.current.load()
    }
  }

  const toggleBeatPlay = () => {
    if (!beatAudioRef.current || !selectedBeat) return
    
    if (beatAudioRef.current.paused) {
      beatAudioRef.current.play()
    } else {
      beatAudioRef.current.pause()
    }
  }

  // Recording functions
  const startRecording = async () => {
    try {
      // Önceki kaydı sıfırla
      audioChunksRef.current = []
      setRecordingTime(0)
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          latency: 0,
          channelCount: 1
        } 
      })
      
      streamRef.current = stream
      setupAudioVisualization(stream)
      
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      audioChunksRef.current = []
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        const newRecording = {
          id: Date.now(),
          blob,
          url,
          duration: recordingTime,
          timestamp: new Date().toLocaleTimeString('tr'),
          name: `Kayıt ${recordings.length + 1}`
        }
        setRecordings(prev => [...prev, newRecording])
        setActiveRecording(newRecording)
      }
      
      mediaRecorderRef.current.start(100)
      setIsRecording(true)
      setIsPaused(false)
      setRecordingTime(0)
      
      // Start beat if selected
      if (beatAudioRef.current && selectedBeat) {
        beatAudioRef.current.currentTime = 0
        beatAudioRef.current.play()
      }
      
      // Timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
      
    } catch (error) {
      console.error('Mikrofon erişimi hatası:', error)
      alert('Mikrofon erişimi sağlanamadı! Lütfen tarayıcı izinlerini kontrol edin.')
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume()
        if (beatAudioRef.current) beatAudioRef.current.play()
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1)
        }, 1000)
      } else {
        mediaRecorderRef.current.pause()
        if (beatAudioRef.current) beatAudioRef.current.pause()
        clearInterval(timerRef.current)
      }
      setIsPaused(!isPaused)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsPaused(false)
      setRecordingTime(0)  // Süreyi sıfırla
      
      if (beatAudioRef.current) {
        beatAudioRef.current.pause()
        beatAudioRef.current.currentTime = 0
      }
      
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      
      // Canvas'ı temizle
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')
        ctx.fillStyle = 'rgba(15, 15, 26, 1)'
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
      
      // Audio context'i kapat
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
    }
  }

  // Playback functions
  const playRecording = (recording) => {
    setActiveRecording(recording)
    if (recordedAudioRef.current) {
      recordedAudioRef.current.src = recording.url
      
      // Sync with beat
      if (beatAudioRef.current && selectedBeat) {
        beatAudioRef.current.currentTime = 0
        beatAudioRef.current.play()
      }
      
      recordedAudioRef.current.play()
      setIsPlaying(true)
    }
  }

  const stopPlayback = () => {
    if (recordedAudioRef.current) {
      recordedAudioRef.current.pause()
      recordedAudioRef.current.currentTime = 0
    }
    if (beatAudioRef.current) {
      beatAudioRef.current.pause()
      beatAudioRef.current.currentTime = 0
    }
    setIsPlaying(false)
  }

  const deleteRecording = (id) => {
    setRecordings(prev => prev.filter(r => r.id !== id))
    if (activeRecording?.id === id) {
      setActiveRecording(null)
    }
  }

  const downloadRecording = (recording) => {
    const a = document.createElement('a')
    a.href = recording.url
    a.download = `${recording.name.replace(/\s/g, '_')}_${Date.now()}.webm`
    a.click()
  }

  // Save as project
  const saveAsProject = async () => {
    if (!projectTitle.trim()) {
      alert('Proje adı gerekli!')
      return
    }

    setSaving(true)
    try {
      await projectsAPI.create({
        title: projectTitle,
        lyrics: projectLyrics,
        beat_id: selectedBeat?.id,
        mood: 'enerjik',
        energy_level: 'yüksek'
      })
      
      setShowSaveModal(false)
      setProjectTitle('')
      alert('Proje kaydedildi!')
    } catch (error) {
      console.error('Proje kaydetme hatası:', error)
      alert('Proje kaydedilemedi!')
    } finally {
      setSaving(false)
    }
  }

  // Utility functions
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const filteredBeats = beats.filter(beat => 
    beat.name.toLowerCase().includes(beatSearch.toLowerCase()) ||
    beat.genre?.toLowerCase().includes(beatSearch.toLowerCase())
  )

  return (
    <Layout title="Stüdyo">
      <div className="studio-container">
        {/* Main Recording Area */}
        <div className="studio-main">
          <div className="recording-panel">
            <div className="panel-header">
              <h2>🎙️ Kayıt Stüdyosu</h2>
              <p>Beat seç, mikrofonu aç ve şarkını kaydet!</p>
            </div>

            {/* Waveform Visualization */}
            <div className="waveform-container">
              <canvas 
                ref={canvasRef} 
                width={800} 
                height={200}
                className="waveform-canvas"
              />
              
              {/* Recording indicator */}
              {isRecording && (
                <div className={`recording-indicator ${isPaused ? 'paused' : ''}`}>
                  <span className="rec-dot"></span>
                  {isPaused ? 'DURAKLATILDI' : 'KAYIT'}
                </div>
              )}
            </div>

            {/* Timer */}
            <div className="timer-display">
              <span className={isRecording ? 'active' : ''}>
                {formatTime(recordingTime)}
              </span>
            </div>

            {/* Selected Beat Info */}
            {selectedBeat && (
              <div className="selected-beat-banner">
                <div 
                  className="beat-mini-cover"
                  style={{ background: `linear-gradient(135deg, ${selectedBeat.cover_color}, ${selectedBeat.cover_color}99)` }}
                >
                  🎵
                </div>
                <div className="beat-mini-info">
                  <span className="name">{selectedBeat.name}</span>
                  <span className="meta">{selectedBeat.artist} • {selectedBeat.bpm} BPM</span>
                </div>
                <button className="btn btn-icon" onClick={toggleBeatPlay}>
                  {beatAudioRef.current?.paused !== false ? '▶️' : '⏸️'}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={beatVolume}
                  onChange={(e) => {
                    setBeatVolume(e.target.value)
                    if (beatAudioRef.current) beatAudioRef.current.volume = e.target.value
                  }}
                  className="volume-slider"
                />
              </div>
            )}

            {/* Recording Controls */}
            <div className="recording-controls">
              {!isRecording ? (
                <button className="btn btn-record" onClick={startRecording}>
                  <span className="btn-icon">🎙️</span>
                  Kayıt Başlat
                </button>
              ) : (
                <>
                  <button className="btn btn-pause" onClick={pauseRecording}>
                    <span className="btn-icon">{isPaused ? '▶️' : '⏸️'}</span>
                    {isPaused ? 'Devam' : 'Duraklat'}
                  </button>
                  <button className="btn btn-stop" onClick={stopRecording}>
                    <span className="btn-icon">⏹️</span>
                    Durdur
                  </button>
                </>
              )}
            </div>

            {/* Recording Tips */}
            <div className="recording-tips">
              <h4>💡 İpuçları</h4>
              <ul>
                <li>Sessiz bir ortamda kayıt yapın</li>
                <li>Mikrofona 15-20 cm mesafede durun</li>
                <li>Önce beat'i dinleyerek ritmi yakalayın</li>
                <li>Birden fazla kayıt yapıp en iyisini seçin</li>
              </ul>
            </div>
          </div>

          {/* Recordings List */}
          <div className="recordings-panel">
            <div className="panel-header">
              <h3>📁 Kayıtlarım</h3>
              <span className="count">{recordings.length} kayıt</span>
            </div>

            {recordings.length === 0 ? (
              <div className="empty-recordings">
                <span>🎤</span>
                <p>Henüz kayıt yok</p>
                <small>Kayıt başlat butonuna tıklayarak ilk kaydını oluştur!</small>
              </div>
            ) : (
              <div className="recordings-list">
                {recordings.map(recording => (
                  <div 
                    key={recording.id} 
                    className={`recording-item ${activeRecording?.id === recording.id ? 'active' : ''}`}
                  >
                    <div className="recording-info">
                      <input
                        type="text"
                        value={recording.name}
                        onChange={(e) => {
                          setRecordings(prev => prev.map(r => 
                            r.id === recording.id ? {...r, name: e.target.value} : r
                          ))
                        }}
                        className="recording-name-input"
                      />
                      <span className="recording-meta">
                        {formatTime(recording.duration)} • {recording.timestamp}
                      </span>
                    </div>
                    <div className="recording-actions">
                      <button 
                        className="btn btn-sm"
                        onClick={() => isPlaying && activeRecording?.id === recording.id 
                          ? stopPlayback() 
                          : playRecording(recording)
                        }
                      >
                        {isPlaying && activeRecording?.id === recording.id ? '⏹️' : '▶️'}
                      </button>
                      <button 
                        className="btn btn-sm"
                        onClick={() => downloadRecording(recording)}
                      >
                        💾
                      </button>
                      <button 
                        className="btn btn-sm btn-danger"
                        onClick={() => deleteRecording(recording.id)}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {recordings.length > 0 && (
              <button 
                className="btn btn-primary btn-full"
                onClick={() => setShowSaveModal(true)}
              >
                💾 Proje Olarak Kaydet
              </button>
            )}
          </div>
        </div>

        {/* Sidebar - Beats & Lyrics */}
        <div className="studio-sidebar">
          {/* Beat Selector */}
          <div className="sidebar-panel beat-selector">
            <div className="panel-header">
              <h3>🎵 Beat Seç</h3>
            </div>
            
            <div className="beat-search">
              <input
                type="text"
                placeholder="Beat ara..."
                value={beatSearch}
                onChange={(e) => setBeatSearch(e.target.value)}
              />
            </div>

            <div className="beat-list">
              {filteredBeats.map(beat => (
                <div
                  key={beat.id}
                  className={`beat-item ${selectedBeat?.id === beat.id ? 'selected' : ''}`}
                  onClick={() => selectBeat(beat)}
                >
                  <div 
                    className="beat-cover"
                    style={{ background: `linear-gradient(135deg, ${beat.cover_color}, ${beat.cover_color}99)` }}
                  >
                    🎵
                  </div>
                  <div className="beat-info">
                    <span className="beat-name">{beat.name}</span>
                    <span className="beat-meta">{beat.genre} • {beat.bpm} BPM</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lyrics Panel */}
          <div className="sidebar-panel lyrics-panel">
            <div className="panel-header">
              <h3>📝 Sözler</h3>
            </div>
            <textarea
              value={projectLyrics}
              onChange={(e) => setProjectLyrics(e.target.value)}
              placeholder="Şarkı sözlerini buraya yaz veya yapıştır...

Kayıt yaparken bu sözleri okuyabilirsin."
              className="lyrics-textarea"
            />
            <div className="lyrics-stats">
              <span>{projectLyrics.split(/\s+/).filter(w => w).length} kelime</span>
              <span>{projectLyrics.split('\n').filter(l => l.trim()).length} satır</span>
            </div>
          </div>
        </div>

        {/* Hidden Audio Elements */}
        <audio ref={beatAudioRef} loop hidden />
        <audio 
          ref={recordedAudioRef} 
          hidden 
          onEnded={() => setIsPlaying(false)}
        />

        {/* Save Modal */}
        {showSaveModal && (
          <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>💾 Projeyi Kaydet</h2>
              
              <div className="form-group">
                <label>Proje Adı</label>
                <input
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  placeholder="Şarkı adı..."
                />
              </div>

              {selectedBeat && (
                <div className="modal-info">
                  <span>🎵 Beat:</span> {selectedBeat.name}
                </div>
              )}

              <div className="modal-info">
                <span>🎤 Kayıtlar:</span> {recordings.length} adet
              </div>

              <div className="modal-actions">
                <button 
                  className="btn btn-secondary"
                  onClick={() => setShowSaveModal(false)}
                >
                  İptal
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={saveAsProject}
                  disabled={saving}
                >
                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default Studio
