import React, { useState, useEffect, useRef, useCallback } from 'react';
import './BeatMaker.css';

const BeatMaker = () => {
  // Sequencer state
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState(16);
  const [swing, setSwing] = useState(0);
  const [masterVolume, setMasterVolume] = useState(0.8);
  
  // Instruments
  const [tracks, setTracks] = useState([
    { id: 'kick', name: 'Kick', color: '#ff146a', pattern: Array(16).fill(false), volume: 0.9, pan: 0, muted: false, solo: false },
    { id: 'snare', name: 'Snare', color: '#00d4ff', pattern: Array(16).fill(false), volume: 0.8, pan: 0, muted: false, solo: false },
    { id: 'hihat', name: 'Hi-Hat', color: '#ffd93d', pattern: Array(16).fill(false), volume: 0.6, pan: 0, muted: false, solo: false },
    { id: 'openhat', name: 'Open Hat', color: '#6bcb77', pattern: Array(16).fill(false), volume: 0.5, pan: 0, muted: false, solo: false },
    { id: 'clap', name: 'Clap', color: '#9b59b6', pattern: Array(16).fill(false), volume: 0.7, pan: 0, muted: false, solo: false },
    { id: 'perc', name: 'Perc', color: '#e74c3c', pattern: Array(16).fill(false), volume: 0.6, pan: 0, muted: false, solo: false },
    { id: '808', name: '808 Bass', color: '#3498db', pattern: Array(16).fill(false), volume: 0.85, pan: 0, muted: false, solo: false },
    { id: 'rim', name: 'Rim', color: '#1abc9c', pattern: Array(16).fill(false), volume: 0.5, pan: 0, muted: false, solo: false },
  ]);

  // AI Chat state
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Merhaba! Ben FONIX Beat AI. Sana beat yapmada yardımcı olabilirim. Hangi tarz bir beat istiyorsun? (Trap, Hip-Hop, Drill, Lo-fi, vs.)' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [showChat, setShowChat] = useState(true);

  // Presets
  const [presets] = useState([
    { name: 'Trap Basic', bpm: 140, pattern: { kick: [0,0,0,0,1,0,0,0,0,0,1,0,1,0,0,0], snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hihat: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1] }},
    { name: 'Boom Bap', bpm: 90, pattern: { kick: [1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0], snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hihat: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0] }},
    { name: 'Drill UK', bpm: 140, pattern: { kick: [1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,0], snare: [0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,1], hihat: [1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1] }},
    { name: 'Lo-fi Chill', bpm: 75, pattern: { kick: [1,0,0,0,0,0,1,0,0,1,0,0,0,0,1,0], snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hihat: [1,1,0,1,1,0,1,1,1,1,0,1,1,0,1,1] }},
    { name: 'House', bpm: 125, pattern: { kick: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hihat: [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0] }},
  ]);

  // Audio context refs
  const audioContextRef = useRef(null);
  const schedulerIntervalRef = useRef(null);
  const nextStepTimeRef = useRef(0);
  const chatEndRef = useRef(null);

  // Initialize Audio Context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return () => {
      if (schedulerIntervalRef.current) {
        clearInterval(schedulerIntervalRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Sound synthesis functions
  const playKick = useCallback((time, volume) => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
    
    gain.gain.setValueAtTime(volume * masterVolume, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
    
    osc.start(time);
    osc.stop(time + 0.5);
  }, [masterVolume]);

  const playSnare = useCallback((time, volume) => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    // Noise
    const bufferSize = ctx.sampleRate * 0.2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1000;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * masterVolume * 0.5, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    // Tone
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.1);
    oscGain.gain.setValueAtTime(volume * masterVolume * 0.7, time);
    oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    noise.start(time);
    osc.start(time);
    noise.stop(time + 0.2);
    osc.stop(time + 0.1);
  }, [masterVolume]);

  const playHiHat = useCallback((time, volume, open = false) => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    const duration = open ? 0.3 : 0.08;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = open ? 5000 : 7000;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * masterVolume * 0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(time);
    noise.stop(time + duration);
  }, [masterVolume]);

  const playClap = useCallback((time, volume) => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    for (let i = 0; i < 3; i++) {
      const bufferSize = ctx.sampleRate * 0.1;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let j = 0; j < bufferSize; j++) {
        data[j] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2000;

      const gain = ctx.createGain();
      const startTime = time + i * 0.01;
      gain.gain.setValueAtTime(volume * masterVolume * 0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.1);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(startTime);
      noise.stop(startTime + 0.1);
    }
  }, [masterVolume]);

  const play808 = useCallback((time, volume) => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.setValueAtTime(60, time);
    osc.frequency.exponentialRampToValueAtTime(30, time + 0.8);
    
    gain.gain.setValueAtTime(volume * masterVolume, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.8);
    
    osc.start(time);
    osc.stop(time + 0.8);
  }, [masterVolume]);

  const playPerc = useCallback((time, volume) => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, time);
    osc.frequency.exponentialRampToValueAtTime(400, time + 0.05);
    
    gain.gain.setValueAtTime(volume * masterVolume * 0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(time);
    osc.stop(time + 0.1);
  }, [masterVolume]);

  const playRim = useCallback((time, volume) => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, time);
    
    gain.gain.setValueAtTime(volume * masterVolume * 0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.03);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(time);
    osc.stop(time + 0.03);
  }, [masterVolume]);

  // Play sound by track id
  const playSound = useCallback((trackId, time, volume) => {
    switch (trackId) {
      case 'kick': playKick(time, volume); break;
      case 'snare': playSnare(time, volume); break;
      case 'hihat': playHiHat(time, volume, false); break;
      case 'openhat': playHiHat(time, volume, true); break;
      case 'clap': playClap(time, volume); break;
      case 'perc': playPerc(time, volume); break;
      case '808': play808(time, volume); break;
      case 'rim': playRim(time, volume); break;
      default: break;
    }
  }, [playKick, playSnare, playHiHat, playClap, playPerc, play808, playRim]);

  // Scheduler
  useEffect(() => {
    if (isPlaying) {
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      nextStepTimeRef.current = ctx.currentTime;
      let step = currentStep;

      const scheduleAhead = 0.1;
      const stepDuration = 60 / bpm / 4;

      schedulerIntervalRef.current = setInterval(() => {
        while (nextStepTimeRef.current < ctx.currentTime + scheduleAhead) {
          // Check for solo tracks
          const hasSolo = tracks.some(t => t.solo);
          
          tracks.forEach(track => {
            const shouldPlay = hasSolo ? track.solo : !track.muted;
            if (track.pattern[step] && shouldPlay) {
              const swingOffset = step % 2 === 1 ? (swing / 100) * stepDuration : 0;
              playSound(track.id, nextStepTimeRef.current + swingOffset, track.volume);
            }
          });

          setCurrentStep(step);
          step = (step + 1) % steps;
          nextStepTimeRef.current += stepDuration;
        }
      }, 25);
    } else {
      if (schedulerIntervalRef.current) {
        clearInterval(schedulerIntervalRef.current);
      }
    }

    return () => {
      if (schedulerIntervalRef.current) {
        clearInterval(schedulerIntervalRef.current);
      }
    };
  }, [isPlaying, bpm, steps, tracks, swing, playSound]);

  // Toggle step
  const toggleStep = (trackIndex, stepIndex) => {
    setTracks(prev => {
      const newTracks = [...prev];
      newTracks[trackIndex] = {
        ...newTracks[trackIndex],
        pattern: newTracks[trackIndex].pattern.map((v, i) => i === stepIndex ? !v : v)
      };
      return newTracks;
    });
  };

  // Track controls
  const toggleMute = (trackIndex) => {
    setTracks(prev => {
      const newTracks = [...prev];
      newTracks[trackIndex] = { ...newTracks[trackIndex], muted: !newTracks[trackIndex].muted };
      return newTracks;
    });
  };

  const toggleSolo = (trackIndex) => {
    setTracks(prev => {
      const newTracks = [...prev];
      newTracks[trackIndex] = { ...newTracks[trackIndex], solo: !newTracks[trackIndex].solo };
      return newTracks;
    });
  };

  const updateVolume = (trackIndex, volume) => {
    setTracks(prev => {
      const newTracks = [...prev];
      newTracks[trackIndex] = { ...newTracks[trackIndex], volume: parseFloat(volume) };
      return newTracks;
    });
  };

  // Clear pattern
  const clearPattern = () => {
    setTracks(prev => prev.map(track => ({
      ...track,
      pattern: Array(steps).fill(false)
    })));
  };

  // Load preset
  const loadPreset = (preset) => {
    setBpm(preset.bpm);
    setTracks(prev => prev.map(track => ({
      ...track,
      pattern: preset.pattern[track.id] 
        ? preset.pattern[track.id].map(v => Boolean(v))
        : Array(steps).fill(false)
    })));
  };

  // Random pattern
  const randomPattern = () => {
    setTracks(prev => prev.map(track => ({
      ...track,
      pattern: track.pattern.map(() => Math.random() > 0.7)
    })));
  };

  // AI Chat functions
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const generateAIResponse = async (userMessage) => {
    setIsAiThinking(true);
    
    // Simulate AI thinking
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

    const lowerMessage = userMessage.toLowerCase();
    let response = '';
    let action = null;

    // Beat style detection
    if (lowerMessage.includes('trap')) {
      response = "🔥 Trap beat için şunları yapıyorum:\n- BPM: 140\n- Kick'ler off-beat'te\n- Hi-hat'ler hızlı rolls\n- 808 bass ekliyorum\n\nPreset'i yükledim! Play'e bas ve dinle.";
      action = () => loadPreset(presets[0]);
    } else if (lowerMessage.includes('drill') || lowerMessage.includes('uk')) {
      response = "🇬🇧 UK Drill beat hazırlıyorum:\n- BPM: 140\n- Sliding 808s\n- Dark melodi\n- Bouncy hi-hats\n\nDrill pattern'i yükledim!";
      action = () => loadPreset(presets[2]);
    } else if (lowerMessage.includes('boom bap') || lowerMessage.includes('old school') || lowerMessage.includes('90')) {
      response = "🎤 Old school boom bap:\n- BPM: 90\n- Hard hitting kicks\n- Snappy snares\n- Classic groove\n\nBoom bap pattern hazır!";
      action = () => loadPreset(presets[1]);
    } else if (lowerMessage.includes('lo-fi') || lowerMessage.includes('lofi') || lowerMessage.includes('chill')) {
      response = "☁️ Lo-fi chill beat:\n- BPM: 75\n- Laid back groove\n- Dusty drums\n- Relaxing vibe\n\nChill pattern'i yükledim!";
      action = () => loadPreset(presets[3]);
    } else if (lowerMessage.includes('house') || lowerMessage.includes('edm') || lowerMessage.includes('electronic')) {
      response = "🎧 House beat geliyor:\n- BPM: 125\n- Four on the floor kick\n- Driving groove\n- Dance-ready pattern\n\nHouse pattern hazır!";
      action = () => loadPreset(presets[4]);
    } else if (lowerMessage.includes('random') || lowerMessage.includes('rastgele') || lowerMessage.includes('şaşırt')) {
      response = "🎲 Rastgele bir pattern oluşturuyorum! Bakalım ne çıkacak...";
      action = randomPattern;
    } else if (lowerMessage.includes('temizle') || lowerMessage.includes('sil') || lowerMessage.includes('clear')) {
      response = "🧹 Tüm pattern'i temizledim. Sıfırdan başlayabilirsin!";
      action = clearPattern;
    } else if (lowerMessage.includes('hızlı') || lowerMessage.includes('fast') || lowerMessage.includes('tempo')) {
      response = "⚡ Tempo'yu yükseltiyorum!";
      action = () => setBpm(prev => Math.min(prev + 20, 200));
    } else if (lowerMessage.includes('yavaş') || lowerMessage.includes('slow')) {
      response = "🐢 Tempo'yu düşürüyorum...";
      action = () => setBpm(prev => Math.max(prev - 20, 60));
    } else if (lowerMessage.includes('bass') || lowerMessage.includes('808')) {
      response = "🔊 808 bass pattern ekliyorum! Her bar'ın başına ve ortasına 808 koydum. Ağır bascılık!";
      action = () => {
        setTracks(prev => prev.map(track => {
          if (track.id === '808') {
            return { ...track, pattern: [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0].map(v => Boolean(v)) };
          }
          return track;
        }));
      };
    } else if (lowerMessage.includes('hi-hat') || lowerMessage.includes('hihat')) {
      response = "🎩 Hi-hat pattern ekliyorum! Trap tarzı rolls...";
      action = () => {
        setTracks(prev => prev.map(track => {
          if (track.id === 'hihat') {
            return { ...track, pattern: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1].map(v => Boolean(v)) };
          }
          return track;
        }));
      };
    } else if (lowerMessage.includes('merhaba') || lowerMessage.includes('selam') || lowerMessage.includes('hey')) {
      response = "Selam! 👋 Ben FONIX Beat AI. Sana beat yapmada yardımcı olmak için buradayım.\n\nŞunları yapabilirim:\n- 'Trap beat yap'\n- 'Drill pattern istiyorum'\n- 'Lo-fi chill'\n- 'Rastgele pattern'\n- 'BPM artır/azalt'\n\nNe yapmak istersin?";
    } else if (lowerMessage.includes('yardım') || lowerMessage.includes('help') || lowerMessage.includes('nasıl')) {
      response = "🎹 **FONIX Beat Maker Kullanımı:**\n\n**Grid:** Kutucuklara tıkla = ses ekle/çıkar\n**Play/Stop:** Beat'i başlat/durdur\n**BPM:** Tempo ayarla (60-200)\n**Presets:** Hazır pattern'ler\n\n**Komutlarım:**\n- 'Trap/Drill/Lo-fi beat yap'\n- 'Hi-hat ekle'\n- '808 bass ekle'\n- 'Tempo artır/azalt'\n- 'Rastgele pattern'\n- 'Temizle'";
    } else {
      const responses = [
        "🤔 Anladım! Bir pattern denemesi yapayım mı? 'Trap', 'Drill', 'Lo-fi' gibi bir tarz söyle!",
        "🎵 Beat yapmaya hazırım! Hangi tarzda gidelim? Trap, Drill, Boom Bap, Lo-fi veya House?",
        "💡 İpucu: 'Rastgele pattern' diyerek sürpriz bir beat oluşturabilirim!",
        "🎤 Rap mı, R&B mi, yoksa Electronic mı? Tarz söyle, pattern'i hazırlayayım!"
      ];
      response = responses[Math.floor(Math.random() * responses.length)];
    }

    setChatMessages(prev => [...prev, { role: 'assistant', content: response }]);
    
    if (action) {
      setTimeout(action, 500);
    }
    
    setIsAiThinking(false);
  };

  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isAiThinking) return;

    const userMessage = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatInput('');
    generateAIResponse(userMessage);
  };

  // Quick prompts
  const quickPrompts = [
    '🔥 Trap beat yap',
    '🇬🇧 UK Drill',
    '☁️ Lo-fi chill',
    '🎲 Rastgele',
    '🔊 808 ekle',
    '⚡ Hızlandır'
  ];

  return (
    <div className="beat-maker">
      {/* Header */}
      <div className="beat-maker-header">
        <div className="header-left">
          <h1>🎹 FONIX Beat Maker</h1>
          <span className="subtitle">FL Studio Style Producer</span>
        </div>
        <div className="header-controls">
          <button className={`chat-toggle ${showChat ? 'active' : ''}`} onClick={() => setShowChat(!showChat)}>
            <span>🤖</span> AI Assistant
          </button>
        </div>
      </div>

      <div className="beat-maker-content">
        {/* Main Workspace */}
        <div className="workspace">
          {/* Transport */}
          <div className="transport-bar">
            <div className="transport-controls">
              <button className="transport-btn play" onClick={() => setIsPlaying(!isPlaying)}>
                {isPlaying ? '⏹️' : '▶️'}
              </button>
              <button className="transport-btn" onClick={() => { setIsPlaying(false); setCurrentStep(0); }}>
                ⏮️
              </button>
            </div>

            <div className="bpm-control">
              <label>BPM</label>
              <input 
                type="range" 
                min="60" 
                max="200" 
                value={bpm} 
                onChange={(e) => setBpm(parseInt(e.target.value))}
              />
              <span className="bpm-value">{bpm}</span>
            </div>

            <div className="swing-control">
              <label>Swing</label>
              <input 
                type="range" 
                min="0" 
                max="50" 
                value={swing} 
                onChange={(e) => setSwing(parseInt(e.target.value))}
              />
              <span className="swing-value">{swing}%</span>
            </div>

            <div className="master-volume">
              <label>Master</label>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.1"
                value={masterVolume} 
                onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
              />
              <span className="volume-value">{Math.round(masterVolume * 100)}%</span>
            </div>

            <div className="transport-actions">
              <button className="action-btn" onClick={clearPattern}>🗑️ Clear</button>
              <button className="action-btn" onClick={randomPattern}>🎲 Random</button>
            </div>
          </div>

          {/* Presets */}
          <div className="presets-bar">
            <span className="presets-label">Presets:</span>
            {presets.map((preset, idx) => (
              <button 
                key={idx} 
                className="preset-btn"
                onClick={() => loadPreset(preset)}
              >
                {preset.name}
              </button>
            ))}
          </div>

          {/* Step Sequencer */}
          <div className="sequencer">
            {/* Step numbers */}
            <div className="step-numbers">
              <div className="track-label-space"></div>
              <div className="track-controls-space"></div>
              {Array(steps).fill(0).map((_, i) => (
                <div key={i} className={`step-number ${i % 4 === 0 ? 'bar-start' : ''}`}>
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Tracks */}
            {tracks.map((track, trackIndex) => (
              <div key={track.id} className="track">
                <div className="track-label" style={{ borderLeftColor: track.color }}>
                  <span className="track-name">{track.name}</span>
                  <button 
                    className="preview-btn"
                    onClick={() => playSound(track.id, audioContextRef.current?.currentTime || 0, track.volume)}
                  >
                    🔊
                  </button>
                </div>
                
                <div className="track-controls">
                  <button 
                    className={`ctrl-btn mute ${track.muted ? 'active' : ''}`}
                    onClick={() => toggleMute(trackIndex)}
                  >
                    M
                  </button>
                  <button 
                    className={`ctrl-btn solo ${track.solo ? 'active' : ''}`}
                    onClick={() => toggleSolo(trackIndex)}
                  >
                    S
                  </button>
                  <input 
                    type="range"
                    className="track-volume"
                    min="0"
                    max="1"
                    step="0.1"
                    value={track.volume}
                    onChange={(e) => updateVolume(trackIndex, e.target.value)}
                  />
                </div>

                <div className="steps">
                  {track.pattern.map((active, stepIndex) => (
                    <div
                      key={stepIndex}
                      className={`step 
                        ${active ? 'active' : ''} 
                        ${currentStep === stepIndex && isPlaying ? 'current' : ''}
                        ${stepIndex % 4 === 0 ? 'bar-start' : ''}
                      `}
                      style={{ 
                        backgroundColor: active ? track.color : undefined,
                        boxShadow: active ? `0 0 10px ${track.color}` : undefined
                      }}
                      onClick={() => toggleStep(trackIndex, stepIndex)}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Playhead */}
            <div 
              className="playhead"
              style={{ 
                left: `calc(140px + 60px + ${currentStep * 36}px + 18px)`,
                opacity: isPlaying ? 1 : 0
              }}
            />
          </div>

          {/* Waveform visualization placeholder */}
          <div className="visualization">
            <canvas id="beatVisualizer" className="visualizer-canvas"></canvas>
          </div>
        </div>

        {/* AI Chat Panel */}
        {showChat && (
          <div className="ai-panel">
            <div className="ai-header">
              <span>🤖 FONIX Beat AI</span>
              <div className="ai-status">
                <span className={`status-dot ${isAiThinking ? 'thinking' : 'ready'}`}></span>
                {isAiThinking ? 'Düşünüyor...' : 'Hazır'}
              </div>
            </div>

            <div className="chat-messages">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`message ${msg.role}`}>
                  <div className="message-content">
                    {msg.content.split('\n').map((line, i) => (
                      <React.Fragment key={i}>{line}<br/></React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
              {isAiThinking && (
                <div className="message assistant thinking">
                  <div className="typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="quick-prompts">
              {quickPrompts.map((prompt, idx) => (
                <button 
                  key={idx}
                  className="quick-prompt"
                  onClick={() => {
                    setChatMessages(prev => [...prev, { role: 'user', content: prompt }]);
                    generateAIResponse(prompt);
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form className="chat-input-form" onSubmit={handleChatSubmit}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Beat hakkında bir şey sor..."
                disabled={isAiThinking}
              />
              <button type="submit" disabled={isAiThinking || !chatInput.trim()}>
                ➤
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default BeatMaker;
