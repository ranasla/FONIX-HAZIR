import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import ChatBot from '../components/ChatBot'
import BeatCard from '../components/BeatCard'
import { beatsAPI, projectsAPI, lyricsAPI } from '../services/api'
import './Lyrics.css'

const Lyrics = () => {
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('project_id')

  const [project, setProject] = useState(null)
  const [lyrics, setLyrics] = useState('')
  const [title, setTitle] = useState('Adsız Proje')
  const [selectedBeat, setSelectedBeat] = useState(null)
  const [beats, setBeats] = useState([])
  const [showBeats, setShowBeats] = useState(false)

  const [energyLevel, setEnergyLevel] = useState('mid')
  const [mood, setMood] = useState('neutral')
  const [theme, setTheme] = useState('general')

  const [audioUrl, setAudioUrl] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [analysis, setAnalysis] = useState(null)

  useEffect(() => {
    fetchBeats()
    if (projectId) {
      fetchProject(projectId)
    }
  }, [projectId])

  const fetchBeats = async () => {
    try {
      const response = await beatsAPI.getAll({ genre: 'Tümü' })
      setBeats(response.data.beats)
    } catch (error) {
      console.error('Beat yükleme hatası:', error)
    }
  }

  const fetchProject = async (id) => {
    try {
      const response = await projectsAPI.getById(id)
      const proj = response.data.project
      setProject(proj)
      setLyrics(proj.lyrics || '')
      setTitle(proj.title)
      setEnergyLevel(proj.energy_level)
      setMood(proj.mood)
      setTheme(proj.theme)
      if (proj.beat) {
        setSelectedBeat(proj.beat)
      }
    } catch (error) {
      console.error('Proje yükleme hatası:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const data = {
        title,
        lyrics,
        energy_level: energyLevel,
        mood,
        theme,
        beat_id: selectedBeat?.id
      }

      if (project) {
        await projectsAPI.update(project.id, data)
      } else {
        const response = await projectsAPI.create(data)
        setProject(response.data.project)
      }
      alert('Proje başarıyla kaydedildi!')
    } catch (error) {
      setError('Kaydetme hatası: ' + (error.response?.data?.error || 'Bilinmeyen hata'))
    } finally {
      setSaving(false)
    }
  }

  const handleGenerate = async () => {
    if (!lyrics.trim()) {
      setError('Lütfen söz giriniz.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await lyricsAPI.generate(lyrics)
      setAudioUrl(response.data.audio_url)
    } catch (error) {
      setError(error.response?.data?.error || 'Ses oluşturma hatası')
    } finally {
      setLoading(false)
    }
  }

  const handleAnalyze = async () => {
    if (!lyrics.trim()) return

    try {
      const response = await lyricsAPI.analyze(lyrics)
      setAnalysis(response.data.analysis)
    } catch (error) {
      console.error('Analiz hatası:', error)
    }
  }

  const handleLyricsGenerated = (newLyrics) => {
    setLyrics(prev => prev ? prev + '\n\n' + newLyrics : newLyrics)
  }

  const wordCount = lyrics.split(/\s+/).filter(w => w).length
  const lineCount = lyrics.split('\n').filter(l => l.trim()).length

  return (
    <Layout title="Söz Yaz">
      <div className="lyrics-page">
        <div className="editor-panel">
          <h1>✍️ Söz Yaz</h1>
          <p>Şarkı sözlerini yaz, asistan yardım alsın!</p>

          {/* Project Title */}
          <div className="project-title-input">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Proje Adı..."
            />
          </div>

          {/* Direction Panel */}
          <div className="direction-panel">
            <h3>🎯 Şarkı Yönlendirme</h3>
            <div className="direction-row">
              <div className="direction-group">
                <label>Enerji Seviyesi</label>
                <select value={energyLevel} onChange={(e) => setEnergyLevel(e.target.value)}>
                  <option value="low">🌙 Düşük</option>
                  <option value="mid">⚡ Orta</option>
                  <option value="high">🔥 Yüksek</option>
                </select>
              </div>
              <div className="direction-group">
                <label>Mood</label>
                <select value={mood} onChange={(e) => setMood(e.target.value)}>
                  <option value="neutral">😐 Nötr</option>
                  <option value="sad">😢 Üzgün</option>
                  <option value="happy">😊 Mutlu</option>
                  <option value="dark">🖤 Karanlık</option>
                  <option value="motivating">💪 Motive</option>
                </select>
              </div>
              <div className="direction-group">
                <label>Tema</label>
                <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                  <option value="general">📝 Genel</option>
                  <option value="love">💕 Aşk</option>
                  <option value="success">🏆 Başarı</option>
                  <option value="street">🌃 Sokak</option>
                  <option value="dark_past">🌑 Karanlık Geçmiş</option>
                </select>
              </div>
            </div>
          </div>

          {/* Beat Selection */}
          <div className="beat-selection">
            <div className="beat-header">
              <h3>🎹 Beat Seç</h3>
              <button 
                className="btn btn-secondary"
                onClick={() => setShowBeats(!showBeats)}
              >
                {showBeats ? 'Gizle' : 'Beat Seç'}
              </button>
            </div>
            
            {selectedBeat && (
              <div className="selected-beat">
                <span style={{ color: selectedBeat.cover_color }}>🎵</span>
                <span>{selectedBeat.name}</span>
                <span className="beat-bpm">{selectedBeat.bpm} BPM</span>
                <button onClick={() => setSelectedBeat(null)}>✕</button>
              </div>
            )}

            {showBeats && (
              <div className="beats-list">
                {beats.slice(0, 6).map(beat => (
                  <div 
                    key={beat.id}
                    className={`beat-item ${selectedBeat?.id === beat.id ? 'selected' : ''}`}
                    onClick={() => { setSelectedBeat(beat); setShowBeats(false); }}
                  >
                    <span style={{ color: beat.cover_color }}>🎵</span>
                    <span>{beat.name}</span>
                    <span className="beat-bpm">{beat.bpm} BPM</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lyrics Textarea */}
          <textarea
            className="lyrics-textarea"
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            onBlur={handleAnalyze}
            placeholder="Şarkı sözlerini buraya yaz...

[Verse 1]
Yıldızlar altında düşledim seni
Her nefeste hissettim gölgeni

[Nakarat]
Sensiz geçen her an bir yıl gibi
Gözyaşlarım sel olur sanki..."
          />

          <div className="word-count">
            <span>📝 {wordCount} kelime</span>
            <span>📄 {lineCount} satır</span>
          </div>

          {/* Analysis */}
          {analysis && (
            <div className="analysis-panel">
              <h4>📊 Söz Analizi</h4>
              <div className="analysis-tags">
                <span>Mood: {analysis.mood}</span>
                <span>Tür: {analysis.genre}</span>
                <span>Tema: {analysis.theme}</span>
                <span>Enerji: {analysis.energy}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="action-buttons">
            <button 
              className="btn btn-success"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? '⏳ Kaydediliyor...' : '💾 Kaydet'}
            </button>
            <button 
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={loading || !lyrics.trim()}
            >
              {loading ? '⏳ Oluşturuluyor...' : '🎤 Seslendir'}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="error-box">
              ⚠️ {error}
            </div>
          )}

          {/* Audio Result */}
          {audioUrl && (
            <div className="audio-result">
              <h4>🎧 Oluşturulan Ses</h4>
              <audio controls src={audioUrl}>
                Tarayıcınız ses öğesini desteklemiyor.
              </audio>
            </div>
          )}
        </div>

        {/* ChatBot */}
        <ChatBot 
          context={{ 
            genre: selectedBeat?.genre || 'trap',
            lyrics,
            mood,
            energy: energyLevel,
            project_id: project?.id
          }}
          onLyricsGenerated={handleLyricsGenerated}
        />
      </div>
    </Layout>
  )
}

export default Lyrics
