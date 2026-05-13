import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { io } from 'socket.io-client'
import './KaraokeRoom.css'

const KaraokeRoom = () => {
    const { roomCode } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()

    const [room, setRoom] = useState(null)
    const [participants, setParticipants] = useState([])
    const [messages, setMessages] = useState([])
    const [newMessage, setNewMessage] = useState('')
    const [beats, setBeats] = useState([])
    const [selectedBeat, setSelectedBeat] = useState(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // YouTube & lyrics state
    const [youtubeUrl, setYoutubeUrl] = useState('')
    const [youtubeLoading, setYoutubeLoading] = useState(false)
    const [youtubeData, setYoutubeData] = useState(null)
    const [songMode, setSongMode] = useState('beat')

    // Lyrics — timed array [{text, start}] + plain fallback
    const [lyricsTimed, setLyricsTimed] = useState([])   // [{text, start}]
    const [lyricsPlain, setLyricsPlain] = useState('')    // textarea için
    const [lyricsLines, setLyricsLines] = useState([])    // plain string[]
    const [lyricsLoading, setLyricsLoading] = useState(false)
    const [activeLine, setActiveLine] = useState(-1)
    const [currentTime, setCurrentTime] = useState(0)

    const socketRef = useRef(null)
    const audioRef = useRef(null)
    const lyricsContainerRef = useRef(null)
    const activeLineRef = useRef(null)

    // ─── Sync: audio time → active lyric ────────────────────────────────────
    useEffect(() => {
        if (!isPlaying && currentTime === 0) return

        if (lyricsTimed.length > 0) {
            // Timestamp'li mod: binary search
            let lo = 0, hi = lyricsTimed.length - 1, idx = 0
            while (lo <= hi) {
                const mid = (lo + hi) >> 1
                if (lyricsTimed[mid].start <= currentTime) { idx = mid; lo = mid + 1 }
                else hi = mid - 1
            }
            if (idx !== activeLine) setActiveLine(idx)
        } else if (lyricsLines.length > 0) {
            // Plain lyrics modu: ses süresine orantılı dağıt
            const duration = audioRef.current?.duration
            if (duration > 0) {
                const idx = Math.min(
                    Math.floor((currentTime / duration) * lyricsLines.length),
                    lyricsLines.length - 1
                )
                if (idx !== activeLine) setActiveLine(idx)
            }
        }
    }, [currentTime, lyricsTimed, lyricsLines, isPlaying])

    // ─── Auto-scroll ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (activeLineRef.current) {
            activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
    }, [activeLine])

    // ─── Init ────────────────────────────────────────────────────────────────
    useEffect(() => {
        fetchRoomData()
        fetchBeats()
        connectSocket()
        return () => { socketRef.current?.disconnect() }
    }, [roomCode])

    const applyLyrics = useCallback((timed, plain) => {
        if (timed?.length) {
            setLyricsTimed(timed)
            setLyricsLines(timed.map(e => e.text))
            setLyricsPlain(plain || timed.map(e => e.text).join('\n'))
        } else if (plain) {
            const lines = plain.split('\n').filter(l => l.trim())
            setLyricsPlain(plain)
            setLyricsLines(lines)
            setLyricsTimed([]) // plain moda düş
        } else {
            setLyricsTimed([])
            setLyricsLines([])
            setLyricsPlain('')
        }
        setActiveLine(-1)
    }, [])

    const fetchRoomData = async () => {
        try {
            const res = await api.get(`/api/karaoke/rooms/${roomCode}`)
            setRoom(res.data.room)
            setParticipants(res.data.participants || [])
            if (res.data.room.beat) setSelectedBeat(res.data.room.beat)
            if (res.data.room.youtube_url) {
                setSongMode('youtube')
                setYoutubeData({ audio_url: res.data.room.youtube_url, title: res.data.room.current_song_title })
            }
            if (res.data.room.lyrics) applyLyrics(null, res.data.room.lyrics)
        } catch {
            setError('Oda bulunamadı')
            setTimeout(() => navigate('/karaoke'), 2000)
        } finally {
            setLoading(false)
        }
    }

    const fetchBeats = async () => {
        try {
            const res = await api.get('/api/beats')
            setBeats(res.data.beats || [])
        } catch { }
    }

    const connectSocket = () => {
        socketRef.current = io('http://localhost:5000', { transports: ['websocket', 'polling'] })

        socketRef.current.on('connect', () => {
            socketRef.current.emit('join_room', { room_code: roomCode, user_id: user?.id, username: user?.username })
        })
        socketRef.current.on('user_joined', (data) => {
            setParticipants(prev => prev.find(p => p.user_id === data.user_id) ? prev : [...prev, data])
            addSysMsg(`${data.username} odaya katıldı`)
        })
        socketRef.current.on('user_left', (data) => {
            setParticipants(prev => prev.filter(p => p.user_id !== data.user_id))
            addSysMsg(`${data.username} odadan ayrıldı`)
        })
        socketRef.current.on('new_message', (data) => setMessages(prev => [...prev, data]))
        socketRef.current.on('beat_changed', (data) => {
            setSelectedBeat({ id: data.beat_id, name: data.beat_name, url: data.beat_url, artist: data.beat_artist })
            setSongMode('beat')
            applyLyrics(null, data.beat_lyrics || '')
            addSysMsg(`Beat: ${data.beat_name}`)
        })
        socketRef.current.on('youtube_changed', (data) => {
            setYoutubeData(data.youtube_data)
            setSongMode('youtube')
            applyLyrics(data.lyrics_timed || null, data.lyrics || '')
            addSysMsg(`Şarkı: ${data.youtube_data?.title}`)
        })
        socketRef.current.on('playback_sync', (data) => {
            setIsPlaying(data.is_playing)
            if (audioRef.current) {
                audioRef.current.currentTime = data.current_time
                data.is_playing ? audioRef.current.play() : audioRef.current.pause()
            }
        })
    }

    const addSysMsg = (text) => setMessages(prev => [...prev, { type: 'system', message: text }])

    // ─── YouTube yükle ────────────────────────────────────────────────────────
    const loadYouTubeAudio = async () => {
        if (!youtubeUrl.trim()) return
        setYoutubeLoading(true)
        setLyricsLoading(true)
        setError('')
        try {
            const res = await api.post('/api/karaoke/youtube', { url: youtubeUrl })
            const yt = res.data
            setYoutubeData(yt)
            setSongMode('youtube')

            if (yt.lyrics_found && yt.lyrics_timed?.length) {
                applyLyrics(yt.lyrics_timed, yt.lyrics)
            } else if (yt.lyrics_found) {
                applyLyrics(null, yt.lyrics)
            } else {
                await fetchLyricsFallback(yt.artist, yt.title)
            }

            if (room?.host_id === user?.id) {
                await api.post(`/api/karaoke/rooms/${roomCode}/youtube`, {
                    youtube_data: yt,
                    lyrics: yt.lyrics || lyricsPlain
                })
            }

            socketRef.current.emit('youtube_selected', {
                room_code: roomCode,
                youtube_data: yt,
                lyrics: yt.lyrics || lyricsPlain,
                lyrics_timed: yt.lyrics_timed || []
            })
        } catch (err) {
            setError(err.response?.data?.error || 'YouTube yüklenemedi')
        } finally {
            setYoutubeLoading(false)
            setLyricsLoading(false)
        }
    }

    const fetchLyricsFallback = async (artist, title) => {
        try {
            const res = await api.get(`/api/lyrics/fetch?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`)
            if (res.data.found) applyLyrics(null, res.data.lyrics)
        } catch { }
    }

    // ─── Playback ─────────────────────────────────────────────────────────────
    const togglePlayback = () => {
        const next = !isPlaying
        socketRef.current.emit('play_pause', { room_code: roomCode, is_playing: next, current_time: audioRef.current?.currentTime || 0, user_id: user?.id })
        setIsPlaying(next)
        if (audioRef.current) next ? audioRef.current.play() : audioRef.current.pause()
    }

    const rafRef = useRef(null)
    const handleTimeUpdate = (e) => {
        const t = e.target.currentTime
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(() => setCurrentTime(t))
    }

    const selectBeat = (beat) => {
        socketRef.current.emit('select_beat', { room_code: roomCode, beat_id: beat.id, user_id: user?.id })
        setSelectedBeat(beat)
        setSongMode('beat')
        applyLyrics(null, beat.lyrics || '')
    }

    const leaveRoom = async () => {
        try { await api.post(`/api/karaoke/rooms/${roomCode}/leave`) } catch { }
        socketRef.current?.emit('leave_room', { room_code: roomCode, user_id: user?.id })
        navigate('/karaoke')
    }

    const audioSrc = songMode === 'youtube' && youtubeData?.audio_url ? youtubeData.audio_url : selectedBeat?.url

    useEffect(() => {
        if (audioRef.current && audioSrc) {
            audioRef.current.load()
            setIsPlaying(false)
            setCurrentTime(0)
            setActiveLine(-1)
        }
    }, [audioSrc])

    // Plain textarea'yı manuel değiştirince timed'ı sıfırla (eşit dağıtım)
    const handleManualLyrics = (val) => {
        setLyricsPlain(val)
        const lines = val.split('\n').filter(l => l.trim())
        setLyricsLines(lines)
        setLyricsTimed([])
    }

    const isHost = room?.host_id === user?.id
    const songTitle = songMode === 'youtube' && youtubeData?.title ? youtubeData.title : selectedBeat?.name || 'Şarkı Seçilmedi'

    // Gösterilecek satırlar: timed varsa oradan, yoksa plain
    const displayLines = lyricsTimed.length ? lyricsTimed.map(e => e.text) : lyricsLines

    // Aktif satır etrafında pencere: [-2, -1, 0, +1, +2]
    const WINDOW = 2
    // activeLine -1 iken 0'dan başlat (henüz başlamamış ama ilk satır görünsün)
    const centerLine = activeLine < 0 ? 0 : activeLine
    const windowLines = displayLines.length > 0
        ? Array.from({ length: WINDOW * 2 + 1 }, (_, i) => {
            const idx = centerLine + (i - WINDOW)
            return {
                text: idx >= 0 && idx < displayLines.length ? displayLines[idx] : '',
                offset: i - WINDOW,
                idx,
                isActive: activeLine >= 0 && idx === centerLine
            }
          })
        : []

    if (loading) return <div className="karaoke-room loading"><div className="spinner" /><p>Yükleniyor...</p></div>
    if (error && !room) return <div className="karaoke-room error"><p>{error}</p></div>

    return (
        <div className="karaoke-room">
            {/* Header */}
            <div className="room-header">
                <div className="room-info">
                    <h1>{room?.name || 'Karaoke'}</h1>
                    <span className="room-code">#{roomCode}</span>
                </div>
                <div className="header-center">
                    <span className="song-title-header">{songTitle}</span>
                    {isPlaying && <span className="now-playing-badge">▶ Çalıyor</span>}
                </div>
                <button className="leave-btn" onClick={leaveRoom}>Çık</button>
            </div>

            <div className="room-content">
                {/* Sol: Lyrics + Player + Kontroller */}
                <div className="main-area">

                    {/* Lyrics — karaoke penceresi */}
                    <div className="lyrics-display">
                        {lyricsLoading ? (
                            <div className="lyrics-status">
                                <div className="lyrics-spinner" />
                                <span>Şarkı sözleri aranıyor…</span>
                            </div>
                        ) : windowLines.length > 0 ? (
                            <div className="karaoke-window">
                                {windowLines.map(({ text, offset, idx, isActive }) => (
                                    <div
                                        key={idx}
                                        className={`kline offset-${offset < 0 ? 'n' : ''}${Math.abs(offset)}${isActive ? ' active' : ''}`}
                                        onClick={() => idx >= 0 && idx < displayLines.length && setActiveLine(idx)}
                                    >
                                        {text}
                                    </div>
                                ))}
                                {/* İlerleme: kaçıncı satır / toplam */}
                                {displayLines.length > 0 && (
                                    <div className="lyric-progress">
                                        {Math.max(0, activeLine + 1)} / {displayLines.length}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="lyrics-status">
                                <span>🎵 Söz bulunamadı</span>
                                {isHost && (
                                    <textarea
                                        className="manual-lyrics"
                                        placeholder="Manuel olarak söz ekleyin…"
                                        value={lyricsPlain}
                                        onChange={e => handleManualLyrics(e.target.value)}
                                    />
                                )}
                            </div>
                        )}
                    </div>

                    {/* Player */}
                    <div className="player-bar">
                        <button className="play-btn" onClick={togglePlayback}>
                            {isPlaying ? '⏸ Duraklat' : '▶ Başlat'}
                        </button>
                        {audioSrc && (
                            <audio ref={audioRef} src={audioSrc} onTimeUpdate={handleTimeUpdate}
                                onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />
                        )}
                        {audioRef.current && (
                            <span className="time-display">
                                {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')}
                            </span>
                        )}
                    </div>

                    {/* Şarkı Seçimi — sadece host */}
                    {isHost && (
                        <div className="song-selection">
                            <div className="selection-tabs">
                                <button className={songMode === 'youtube' ? 'active' : ''} onClick={() => setSongMode('youtube')}>📺 YouTube</button>
                                <button className={songMode === 'beat' ? 'active' : ''} onClick={() => setSongMode('beat')}>🎹 Beatler</button>
                            </div>

                            {songMode === 'youtube' && (
                                <div className="youtube-input">
                                    <input type="text" placeholder="YouTube linki yapıştır…" value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && loadYouTubeAudio()} />
                                    <button onClick={loadYouTubeAudio} disabled={youtubeLoading}>
                                        {youtubeLoading ? '⏳' : '🔗 Yükle'}
                                    </button>
                                </div>
                            )}

                            {songMode === 'beat' && (
                                <div className="beats-grid">
                                    {beats.slice(0, 8).map(beat => (
                                        <button key={beat.id}
                                            className={`beat-option${selectedBeat?.id === beat.id ? ' active' : ''}`}
                                            onClick={() => selectBeat(beat)}>
                                            <span className="beat-name">{beat.name}</span>
                                            <span className="beat-bpm">{beat.bpm} BPM</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Sağ: Katılımcılar + Chat */}
                <div className="sidebar">
                    <div className="participants">
                        <h3>👥 Katılımcılar ({participants.length})</h3>
                        <ul>
                            {participants.map((p, i) => (
                                <li key={i}>
                                    <span className="avatar" style={{ background: p.avatar_color || '#ff146a' }}>{p.username?.[0]?.toUpperCase()}</span>
                                    <span className="username">{p.username}</span>
                                    {p.user_id === room?.host_id && <span className="host-badge">Host</span>}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="chat">
                        <h3>💬 Sohbet</h3>
                        <div className="messages">
                            {messages.map((msg, i) => (
                                <div key={i} className={`message ${msg.type || 'user'}`}>
                                    {msg.type !== 'system' && <strong>{msg.username}: </strong>}
                                    {msg.message}
                                </div>
                            ))}
                        </div>
                        <form onSubmit={e => { e.preventDefault(); if (!newMessage.trim()) return; socketRef.current.emit('chat_message', { room_code: roomCode, user_id: user?.id, username: user?.username, message: newMessage }); setNewMessage('') }} className="chat-form">
                            <input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Mesaj…" />
                            <button type="submit">Gönder</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default KaraokeRoom
