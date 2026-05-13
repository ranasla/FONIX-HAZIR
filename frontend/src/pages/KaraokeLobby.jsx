import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import './KaraokeLobby.css'

const KaraokeLobby = () => {
    const [rooms, setRooms] = useState([])
    const [roomName, setRoomName] = useState('')
    const [joinCode, setJoinCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const { user } = useAuth()
    const navigate = useNavigate()

    useEffect(() => { fetchRooms() }, [])

    const fetchRooms = async () => {
        try {
            const res = await api.get('/api/karaoke/rooms')
            setRooms(res.data.rooms || [])
        } catch { }
    }

    const createRoom = async () => {
        if (!roomName.trim()) { setError('Oda adı gerekli!'); return }
        setLoading(true); setError('')
        try {
            const res = await api.post('/api/karaoke/rooms', { name: roomName })
            navigate(`/karaoke/${res.data.room.room_code}`)
        } catch (err) {
            setError(err.response?.data?.error || 'Oda oluşturulamadı')
        } finally { setLoading(false) }
    }

    const joinRoom = async () => {
        if (!joinCode.trim()) { setError('Oda kodu gerekli!'); return }
        setLoading(true); setError('')
        try {
            await api.post(`/api/karaoke/rooms/${joinCode}/join`)
            navigate(`/karaoke/${joinCode}`)
        } catch (err) {
            setError(err.response?.data?.error || 'Odaya katılınamadı')
        } finally { setLoading(false) }
    }

    const deleteRoom = async (roomCode) => {
        if (!window.confirm('Bu odayı silmek istiyor musun?')) return
        try {
            await api.delete(`/api/karaoke/rooms/${roomCode}`)
            fetchRooms()
        } catch (err) {
            setError(err.response?.data?.error || 'Oda silinemedi')
        }
    }

    const songLabel = (room) =>
        room.beat?.name || room.current_song_title || 'Şarkı seçilmedi'

    const isFull = (room) => room.participant_count >= room.max_participants

    return (
        <div className="karaoke-lobby">
            {/* ── Header ── */}
            <div className="lobby-header">
                <div className="lobby-icon">🎤</div>
                <h1>Karaoke Lobby</h1>
                <p>Arkadaşlarınla birlikte şarkı söyle</p>
            </div>

            {error && (
                <div className="lobby-error">
                    <span>⚠️ {error}</span>
                    <button onClick={() => setError('')}>✕</button>
                </div>
            )}

            {/* ── Aksiyon kartları ── */}
            <div className="lobby-actions">
                <div className="action-card">
                    <div className="action-icon create-icon">🏠</div>
                    <h3>Yeni Oda Oluştur</h3>
                    <input
                        type="text"
                        placeholder="Oda adını girin…"
                        value={roomName}
                        onChange={e => setRoomName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && createRoom()}
                    />
                    <button className="btn-create" onClick={createRoom} disabled={loading}>
                        {loading ? 'Oluşturuluyor…' : '+ Oda Oluştur'}
                    </button>
                </div>

                <div className="action-card">
                    <div className="action-icon join-icon">🔗</div>
                    <h3>Odaya Katıl</h3>
                    <input
                        type="text"
                        placeholder="Oda kodunu girin…"
                        value={joinCode}
                        onChange={e => setJoinCode(e.target.value.toUpperCase())}
                        onKeyDown={e => e.key === 'Enter' && joinRoom()}
                        maxLength={6}
                    />
                    <button className="btn-join" onClick={joinRoom} disabled={loading}>
                        {loading ? 'Katılınıyor…' : '→ Katıl'}
                    </button>
                </div>
            </div>

            {/* ── Oda listesi ── */}
            <div className="active-rooms">
                <div className="rooms-header">
                    <h2>Aktif Odalar</h2>
                    <button className="refresh-btn" onClick={fetchRooms} title="Yenile">↻</button>
                </div>

                {rooms.length === 0 ? (
                    <div className="no-rooms">
                        <span>🎶</span>
                        <p>Henüz aktif oda yok.</p>
                        <small>İlk odayı sen oluştur!</small>
                    </div>
                ) : (
                    <div className="rooms-grid">
                        {rooms.map(room => (
                            <div key={room.room_code} className={`room-card${isFull(room) ? ' full' : ''}`}>
                                {/* Üst kısım */}
                                <div className="room-top">
                                    <div className="room-avatar">
                                        {room.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="room-title-block">
                                        <h4 className="room-name">{room.name}</h4>
                                        <span className="room-code-badge">#{room.room_code}</span>
                                    </div>
                                    {isFull(room) && <span className="full-badge">Dolu</span>}
                                </div>

                                {/* Bilgiler */}
                                <div className="room-meta">
                                    <div className="meta-item">
                                        <span className="meta-icon">👤</span>
                                        <span>{room.participant_count}/{room.max_participants} kişi</span>
                                    </div>
                                    <div className="meta-item">
                                        <span className="meta-icon">🎵</span>
                                        <span className="meta-song">{songLabel(room)}</span>
                                    </div>
                                    <div className="meta-item host-meta">
                                        <span className="meta-icon">🎙️</span>
                                        <span className="host-name">{room.host}</span>
                                    </div>
                                </div>

                                {/* Butonlar */}
                                <div className="room-footer">
                                    <button
                                        className="join-btn"
                                        onClick={() => navigate(`/karaoke/${room.room_code}`)}
                                        disabled={isFull(room)}
                                    >
                                        {isFull(room) ? 'Dolu' : 'Katıl'}
                                    </button>
                                    {user?.id === room.host_id && (
                                        <button className="delete-btn" onClick={() => deleteRoom(room.room_code)} title="Odayı Sil">
                                            🗑
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <button className="back-btn" onClick={() => navigate('/discover')}>
                ← Ana Sayfaya Dön
            </button>
        </div>
    )
}

export default KaraokeLobby
