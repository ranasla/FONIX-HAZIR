import React, { useState, useRef, useEffect } from 'react'
import { chatAPI } from '../services/api'
import './ChatBot.css'

const ChatBot = ({ context = {}, onLyricsGenerated, expanded = false }) => {
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      text: '👋 Merhaba! Ben FONİX AI - profesyonel şarkı yazım asistanınım!\n\n🎵 **Yapabileceklerim:**\n• Verse, nakarat, köprü yazma\n• Kafiye ve kelime önerileri\n• Tema ve duygu analizi\n• Flow ve ritim önerileri\n• Farklı tarzlarda söz yazma\n\n💡 Hemen başlamak için aşağıdaki butonları kullan veya bir şey sor!'
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedStyle, setSelectedStyle] = useState('rap')
  const [selectedMood, setSelectedMood] = useState('emotional')
  const messagesEndRef = useRef(null)

  const STYLES = [
    { id: 'rap', label: '🎤 Rap', desc: 'Hızlı, punchline dolu' },
    { id: 'pop', label: '🎵 Pop', desc: 'Akılda kalıcı, melodik' },
    { id: 'rnb', label: '💜 R&B', desc: 'Duygusal, akıcı' },
    { id: 'rock', label: '🎸 Rock', desc: 'Güçlü, isyankar' },
    { id: 'drill', label: '🔥 Drill', desc: 'Agresif, soğuk' },
    { id: 'acoustic', label: '🎻 Akustik', desc: 'Samimi, sade' }
  ]

  const MOODS = [
    { id: 'emotional', label: '💔 Duygusal' },
    { id: 'happy', label: '😊 Mutlu' },
    { id: 'angry', label: '😤 Öfkeli' },
    { id: 'chill', label: '😌 Sakin' },
    { id: 'motivational', label: '💪 Motive' },
    { id: 'romantic', label: '❤️ Romantik' },
    { id: 'dark', label: '🌑 Karanlık' },
    { id: 'party', label: '🎉 Parti' }
  ]

  const QUICK_PROMPTS = [
    { icon: '✍️', label: 'Verse Yaz', prompt: `${selectedStyle} tarzında ${selectedMood} bir verse yaz` },
    { icon: '🎶', label: 'Nakarat', prompt: `${selectedStyle} için akılda kalıcı bir nakarat yaz` },
    { icon: '🌉', label: 'Köprü', prompt: 'Şarkı için duygusal bir köprü bölümü yaz' },
    { icon: '🔤', label: 'Kafiye', prompt: 'Bu kelimeler için kafiye öner: aşk, kalp, gece' },
    { icon: '💡', label: 'Tema', prompt: 'Şarkı için yaratıcı tema öner' },
    { icon: '🎯', label: 'Punchline', prompt: 'Güçlü bir punchline yaz' },
    { icon: '📝', label: 'Başlık', prompt: 'Şarkı için akılda kalıcı isim öner' },
    { icon: '🔄', label: 'Yeniden Yaz', prompt: 'Son yazdığın sözleri farklı bir şekilde yaz' }
  ]

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async (customMessage = null) => {
    const messageToSend = customMessage || input.trim()
    if (!messageToSend || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: messageToSend }])
    setLoading(true)

    try {
      const enhancedContext = {
        ...context,
        style: selectedStyle,
        mood: selectedMood
      }
      
      const response = await chatAPI.send(messageToSend, enhancedContext)
      const botResponse = response.data.response

      setMessages(prev => [...prev, { role: 'bot', text: botResponse }])
      
      // Söz üretildiyse callback
      if (onLyricsGenerated && (
        messageToSend.toLowerCase().includes('yaz') || 
        messageToSend.toLowerCase().includes('verse') ||
        messageToSend.toLowerCase().includes('nakarat')
      )) {
        const lyricsMatch = botResponse.match(/önerisi:\n\n([\s\S]*?)\n\n💡/) ||
                          botResponse.match(/```\n([\s\S]*?)\n```/)
        if (lyricsMatch) {
          onLyricsGenerated(lyricsMatch[1])
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'bot', 
        text: '❌ Bir hata oluştu. Lütfen tekrar deneyin.' 
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatMessage = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br />')
  }

  const copyToClipboard = (text) => {
    const cleanText = text.replace(/<[^>]*>/g, '').replace(/<br \/>/g, '\n')
    navigator.clipboard.writeText(cleanText)
  }

  return (
    <div className={`chatbot-panel ${expanded ? 'expanded' : ''}`}>
      <div className="chatbot-header">
        <div className="bot-avatar">🤖</div>
        <div className="header-info">
          <h3>FONİX AI</h3>
          <p>Profesyonel Şarkı Yazım Asistanı</p>
        </div>
        <div className="header-status">
          <span className="status-dot"></span>
          Online
        </div>
      </div>

      {/* Style & Mood Selector */}
      <div className="chatbot-settings">
        <div className="setting-group">
          <label>🎨 Tarz</label>
          <div className="setting-options">
            {STYLES.map(style => (
              <button 
                key={style.id}
                className={`option-btn ${selectedStyle === style.id ? 'active' : ''}`}
                onClick={() => setSelectedStyle(style.id)}
                title={style.desc}
              >
                {style.label}
              </button>
            ))}
          </div>
        </div>
        
        <div className="setting-group">
          <label>💭 Mood</label>
          <div className="setting-options">
            {MOODS.map(mood => (
              <button 
                key={mood.id}
                className={`option-btn ${selectedMood === mood.id ? 'active' : ''}`}
                onClick={() => setSelectedMood(mood.id)}
              >
                {mood.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            <div 
              className="message-content"
              dangerouslySetInnerHTML={{ __html: formatMessage(msg.text) }}
            />
            {msg.role === 'bot' && index > 0 && (
              <div className="message-actions">
                <button onClick={() => copyToClipboard(msg.text)} title="Kopyala">
                  📋
                </button>
                {onLyricsGenerated && (
                  <button onClick={() => onLyricsGenerated(msg.text.replace(/<[^>]*>/g, ''))} title="Editöre Ekle">
                    ➕
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="message bot">
            <div className="typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      <div className="quick-actions-grid">
        {QUICK_PROMPTS.map((item, idx) => (
          <button 
            key={idx} 
            className="quick-btn"
            onClick={() => sendMessage(item.prompt)}
            disabled={loading}
          >
            <span className="quick-icon">{item.icon}</span>
            <span className="quick-label">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Söz yazım için bir şey sor..."
          disabled={loading}
          rows={2}
        />
        <button 
          className="send-btn"
          onClick={() => sendMessage()} 
          disabled={loading || !input.trim()}
        >
          {loading ? '⏳' : '📤'}
        </button>
      </div>
    </div>
  )
}

export default ChatBot
