import React, { useState, useEffect, useRef, useCallback } from 'react'
import { generateContent, correctGrammar } from '../services/gemini'

const TOPICS = [
  { id: 'daily',     label: '일상 대화',   emoji: '☀️', desc: 'Daily Life & Small Talk', color: '#22c55e' },
  { id: 'business',  label: '비즈니스',    emoji: '💼', desc: 'Business English',        color: '#3b82f6' },
  { id: 'travel',    label: '여행',        emoji: '✈️', desc: 'Travel & Tourism',        color: '#f97316' },
  { id: 'interview', label: '취업 인터뷰', emoji: '👔', desc: 'Job Interview',            color: '#8b5cf6' },
  { id: 'food',      label: '음식/카페',   emoji: '☕', desc: 'Food & Dining',            color: '#ef4444' },
  { id: 'hobby',     label: '취미/여가',   emoji: '🎨', desc: 'Hobbies & Leisure',       color: '#06b6d4' },
  { id: 'news',      label: '시사/이슈',   emoji: '📰', desc: 'News & Current Events',   color: '#64748b' },
  { id: 'free',      label: '프리토킹',    emoji: '💬', desc: 'Free Conversation',        color: '#1e3a5f' },
]

const getSysInstruction = (topic) =>
  `You are a warm, friendly English conversation tutor for Korean adult learners in a phone-style English practice session.

RULES:
- Respond in English ONLY (no Korean)
- Keep responses SHORT: 2-3 sentences max, like a real phone conversation
- ALWAYS end every message with a question to keep the conversation going
- Be encouraging and understanding — never harsh about mistakes
- Sound natural and conversational, not like a textbook

Today's topic: ${topic.desc} (${topic.label})

Begin with a warm greeting and an engaging opening question about the topic.`

export default function EnglishTutor() {
  const [phase, setPhase] = useState('setup') // 'setup' | 'topics' | 'chat'
  const [apiKey, setApiKey] = useState('')
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [apiKeyError, setApiKeyError] = useState('')
  const [apiKeyTesting, setApiKeyTesting] = useState(false)
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [messages, setMessages] = useState([])
  const [isRecording, setIsRecording] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [correcting, setCorrecting] = useState(null)

  const historyRef = useRef([])
  const apiKeyRef = useRef('')
  const selectedTopicRef = useRef(null)
  const voiceRef = useRef(null)
  const recognitionRef = useRef(null)
  const messagesEndRef = useRef(null)
  const isThinkingRef = useRef(false)

  useEffect(() => { apiKeyRef.current = apiKey }, [apiKey])
  useEffect(() => { selectedTopicRef.current = selectedTopic }, [selectedTopic])
  useEffect(() => { isThinkingRef.current = isThinking }, [isThinking])

  // Load saved API key
  useEffect(() => {
    const saved = localStorage.getItem('et_gemini_key')
    if (saved) {
      setApiKey(saved)
      apiKeyRef.current = saved
      setPhase('topics')
    }
  }, [])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking])

  // Load TTS voice
  useEffect(() => {
    const load = () => {
      const voices = speechSynthesis.getVoices()
      voiceRef.current =
        voices.find(v => v.lang === 'en-US' && /zira|eva|heera|female/i.test(v.name)) ||
        voices.find(v => v.lang === 'en-US') ||
        voices.find(v => v.lang.startsWith('en')) ||
        null
    }
    load()
    speechSynthesis.addEventListener('voiceschanged', load)
    return () => speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      speechSynthesis.cancel()
      recognitionRef.current?.stop()
    }
  }, [])

  const speak = useCallback((text) => {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = 0.88
    if (voiceRef.current) u.voice = voiceRef.current
    u.onstart = () => setIsSpeaking(true)
    u.onend = () => setIsSpeaking(false)
    u.onerror = () => setIsSpeaking(false)
    speechSynthesis.speak(u)
  }, [])

  const stopSpeaking = useCallback(() => {
    speechSynthesis.cancel()
    setIsSpeaking(false)
  }, [])

  const addMessage = useCallback((role, text) => {
    const msg = { id: `${Date.now()}-${Math.random()}`, role, text, corrected: null, showCorrection: false }
    setMessages(prev => [...prev, msg])
    return msg.id
  }, [])

  const sendToAI = useCallback(async (historyToSend) => {
    setIsThinking(true)
    try {
      const aiText = await generateContent(
        apiKeyRef.current,
        historyToSend,
        getSysInstruction(selectedTopicRef.current)
      )
      historyRef.current = [...historyToSend, { role: 'model', parts: [{ text: aiText }] }]
      addMessage('ai', aiText)
      speak(aiText)
    } catch (err) {
      addMessage('ai', `[오류] ${err.message}`)
    } finally {
      setIsThinking(false)
    }
  }, [addMessage, speak])

  const handleSaveApiKey = async () => {
    const key = apiKeyInput.trim()
    if (!key) return
    setApiKeyError('')
    setApiKeyTesting(true)
    try {
      await generateContent(key, [{ role: 'user', parts: [{ text: 'Hi' }] }])
      localStorage.setItem('et_gemini_key', key)
      setApiKey(key)
      apiKeyRef.current = key
      setPhase('topics')
    } catch (err) {
      setApiKeyError('API 키가 유효하지 않습니다: ' + err.message)
    } finally {
      setApiKeyTesting(false)
    }
  }

  const handleStartSession = async (topic) => {
    setSelectedTopic(topic)
    selectedTopicRef.current = topic
    setMessages([])
    historyRef.current = []
    setPhase('chat')
    setIsThinking(true)
    try {
      const aiText = await generateContent(apiKeyRef.current, [], getSysInstruction(topic))
      // Keep a hidden "Start." user turn + AI response in history for context continuity
      historyRef.current = [
        { role: 'user', parts: [{ text: 'Start.' }] },
        { role: 'model', parts: [{ text: aiText }] },
      ]
      addMessage('ai', aiText)
      speak(aiText)
    } catch (err) {
      addMessage('ai', `[오류] ${err.message}`)
    } finally {
      setIsThinking(false)
    }
  }

  const handleMicToggle = useCallback(() => {
    if (isRecording) {
      recognitionRef.current?.stop()
      return
    }
    if (isThinkingRef.current) return

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      alert('음성 인식이 지원되지 않습니다.\nElectron 개발 모드(npm run dev)에서 실행 중인지 확인해주세요.')
      return
    }

    stopSpeaking()

    const r = new SR()
    r.lang = 'en-US'
    r.continuous = false
    r.interimResults = true

    r.onstart = () => { setIsRecording(true); setTranscript('') }

    r.onresult = (e) => {
      let interim = '', final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript
        else interim += e.results[i][0].transcript
      }
      setTranscript(final || interim)

      if (final) {
        const userText = final.trim()
        setTranscript('')
        setIsRecording(false)
        r.stop()
        addMessage('user', userText)
        const newHistory = [...historyRef.current, { role: 'user', parts: [{ text: userText }] }]
        historyRef.current = newHistory
        sendToAI(newHistory)
      }
    }

    r.onerror = (e) => {
      setIsRecording(false)
      setTranscript('')
      if (e.error !== 'no-speech') console.error('STT error:', e.error)
    }

    r.onend = () => setIsRecording(false)

    recognitionRef.current = r
    r.start()
  }, [isRecording, stopSpeaking, addMessage, sendToAI])

  const handleCorrect = useCallback(async (msgId, text) => {
    setCorrecting(msgId)
    try {
      const result = await correctGrammar(apiKeyRef.current, text)
      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, corrected: result, showCorrection: true } : m
      ))
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, corrected: `교정 오류: ${err.message}`, showCorrection: true } : m
      ))
    } finally {
      setCorrecting(null)
    }
  }, [])

  const toggleCorrection = useCallback((msgId) => {
    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, showCorrection: !m.showCorrection } : m
    ))
  }, [])

  // ── SETUP SCREEN ──────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="et-wrap">
        <div className="et-setup-box">
          <div className="et-setup-icon">🎙️</div>
          <h2 className="et-setup-title">AI 전화영어</h2>
          <p className="et-setup-desc">
            Gemini API 키를 입력하면 AI와 실시간 영어 대화를 시작할 수 있어요.<br />
            <a
              href="https://aistudio.google.com/app/apikey"
              onClick={e => { e.preventDefault(); window.open('https://aistudio.google.com/app/apikey') }}
              className="et-link"
            >
              Google AI Studio에서 무료로 발급받기 →
            </a>
          </p>
          <div className="et-setup-form">
            <input
              className="et-setup-input"
              type="password"
              placeholder="AIza... (Gemini API Key)"
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !apiKeyTesting && handleSaveApiKey()}
              autoFocus
            />
            {apiKeyError && <div className="et-error-msg">{apiKeyError}</div>}
            <button
              className="et-primary-btn"
              onClick={handleSaveApiKey}
              disabled={!apiKeyInput.trim() || apiKeyTesting}
            >
              {apiKeyTesting ? '확인 중...' : '시작하기'}
            </button>
          </div>
          <p className="et-hint-text">API 키는 이 기기에만 저장되며 외부로 전송되지 않습니다</p>
        </div>
      </div>
    )
  }

  // ── TOPIC SELECTION ───────────────────────────────────────────────────────
  if (phase === 'topics') {
    return (
      <div className="et-wrap">
        <div className="et-topics-wrap">
          <div className="et-topics-header">
            <h2>오늘의 주제를 선택하세요</h2>
            <p>AI가 선택한 주제로 자연스러운 영어 대화를 이끌어 드립니다</p>
          </div>
          <div className="et-topics-grid">
            {TOPICS.map(t => (
              <button
                key={t.id}
                className="et-topic-card"
                style={{ '--tc': t.color }}
                onClick={() => handleStartSession(t)}
              >
                <span className="et-topic-emoji">{t.emoji}</span>
                <span className="et-topic-label">{t.label}</span>
                <span className="et-topic-eng">{t.desc}</span>
              </button>
            ))}
          </div>
          <button
            className="et-link-btn"
            onClick={() => {
              localStorage.removeItem('et_gemini_key')
              setApiKey('')
              apiKeyRef.current = ''
              setApiKeyInput('')
              setApiKeyError('')
              setPhase('setup')
            }}
          >
            API 키 변경
          </button>
        </div>
      </div>
    )
  }

  // ── CHAT SCREEN ───────────────────────────────────────────────────────────
  return (
    <div className="et-wrap et-chat-layout">
      {/* Header */}
      <div className="et-chat-header">
        <div className="et-chat-header-left">
          <span className="et-chat-topic-badge" style={{ '--tc': selectedTopic?.color }}>
            {selectedTopic?.emoji} {selectedTopic?.label}
          </span>
          <span className={`et-status-dot ${isRecording ? 'rec' : isThinking ? 'think' : isSpeaking ? 'speak' : ''}`}>
            {isThinking ? '💭 생각 중...' : isRecording ? '🎙️ 듣는 중...' : isSpeaking ? '🔊 말하는 중...' : '● 대기'}
          </span>
        </div>
        <div className="et-chat-header-right">
          {isSpeaking && (
            <button className="et-icon-btn" onClick={stopSpeaking} title="음소거">🔇</button>
          )}
          <button className="et-end-session-btn" onClick={() => {
            stopSpeaking()
            recognitionRef.current?.stop()
            setPhase('topics')
          }}>
            대화 종료
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="et-messages">
        {messages.length === 0 && !isThinking && (
          <div className="et-empty-chat">AI의 첫 메시지를 기다리는 중...</div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`et-msg-row ${msg.role === 'user' ? 'et-user-row' : 'et-ai-row'}`}>
            {msg.role === 'ai' && <div className="et-avatar et-ai-avatar">AI</div>}

            <div className="et-msg-content">
              <div className={`et-bubble ${msg.role === 'user' ? 'et-bubble-user' : 'et-bubble-ai'}`}>
                {msg.text}
                {msg.role === 'ai' && (
                  <button className="et-replay-btn" onClick={() => speak(msg.text)} title="다시 듣기">
                    🔊
                  </button>
                )}
              </div>

              {msg.role === 'user' && (
                <button
                  className={`et-correct-btn ${msg.showCorrection ? 'et-correct-open' : ''}`}
                  onClick={() =>
                    msg.corrected ? toggleCorrection(msg.id) : handleCorrect(msg.id, msg.text)
                  }
                  disabled={correcting === msg.id}
                >
                  {correcting === msg.id
                    ? '교정 중...'
                    : msg.corrected
                      ? msg.showCorrection ? '▲ 교정 숨기기' : '▼ 교정 보기'
                      : '✏️ 교정하기'}
                </button>
              )}

              {msg.role === 'user' && msg.showCorrection && msg.corrected && (
                <div className="et-correction-box">
                  <div className="et-correction-header">✏️ 문법 교정</div>
                  <pre className="et-correction-body">{msg.corrected}</pre>
                </div>
              )}
            </div>

            {msg.role === 'user' && <div className="et-avatar et-user-avatar">나</div>}
          </div>
        ))}

        {isThinking && (
          <div className="et-msg-row et-ai-row">
            <div className="et-avatar et-ai-avatar">AI</div>
            <div className="et-bubble et-bubble-ai et-thinking">
              <span /><span /><span />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="et-input-area">
        {transcript && (
          <div className="et-live-transcript">"{transcript}"</div>
        )}
        <div className="et-controls-row">
          <button
            className={`et-mic-btn ${isRecording ? 'et-mic-recording' : ''}`}
            onClick={handleMicToggle}
            disabled={isThinking}
            title={isRecording ? '중지' : '말하기 시작'}
          >
            {isRecording ? '⏹' : '🎙️'}
          </button>
          <div className="et-mic-hint">
            {isThinking
              ? 'AI가 응답을 생성하고 있어요...'
              : isRecording
                ? '영어로 말해보세요. 말이 끝나면 잠시 기다리거나 버튼을 누르세요.'
                : '버튼을 클릭하고 영어로 말해보세요'}
          </div>
        </div>
      </div>
    </div>
  )
}
