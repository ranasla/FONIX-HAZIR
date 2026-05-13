import React, { useEffect, useRef } from 'react'

const FloatingNotes = () => {
  const containerRef = useRef(null)
  
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    
    const notes = ['♪', '♫', '♬', '🎵', '🎶', '🎤', '🎧', '🎹']
    const noteElements = []
    
    for (let i = 0; i < 20; i++) {
      const note = document.createElement('span')
      note.className = 'note'
      note.textContent = notes[Math.floor(Math.random() * notes.length)]
      note.style.left = `${Math.random() * 100}%`
      note.style.animationDuration = `${10 + Math.random() * 20}s`
      note.style.animationDelay = `${Math.random() * 10}s`
      container.appendChild(note)
      noteElements.push(note)
    }
    
    return () => {
      noteElements.forEach(note => note.remove())
    }
  }, [])

  return <div ref={containerRef} className="floating-notes" />
}

export default FloatingNotes
