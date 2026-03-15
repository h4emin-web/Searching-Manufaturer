'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWizardStore } from '../../../store/wizardStore'

interface DashboardEvent {
  type: string
  manufacturer?: string
  channel?: string
  message?: string
}

interface LogEntry {
  id: number
  type: 'info' | 'action' | 'success' | 'warning'
  text: string
  time: string
}

const LOG_COLORS = {
  info:    'text-muted-foreground',
  action:  'text-primary',
  success: 'text-emerald-500',
  warning: 'text-amber-500',
}

function now() {
  return new Date().toLocaleTimeString('ko-KR', { hour12: false })
}

export default function Step6Dashboard() {
  const { session_id, manufacturers, step1 } = useWizardStore()
  const [events, setEvents] = useState<DashboardEvent[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [stats, setStats] = useState({ sent: 0, replied: 0, pending: 0, failed: 0 })
  const [connected, setConnected] = useState(false)
  const [logId, setLogId] = useState(0)

  const active = manufacturers.filter(m => !m.is_excluded)

  const addLog = (type: LogEntry['type'], text: string) => {
    setLogId(id => {
      const newId = id + 1
      setLogs(prev => [...prev, { id: newId, type, text, time: now() }].slice(-30))
      return newId
    })
  }

  useEffect(() => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

    // Initial log
    addLog('info', `소싱 프로토콜 시작 — ${step1.ingredient_name}`)
    addLog('action', `${active.length}개 제조소 대상 연락 준비 중...`)

    const es = new EventSource(`${API_BASE}/dashboard/${session_id || 'demo'}/stream`)

    es.onopen = () => {
      setConnected(true)
      addLog('success', 'SSE 스트림 연결 완료')
    }

    es.onerror = () => {
      setConnected(false)
      addLog('warning', '스트림 연결 재시도 중...')
    }

    es.onmessage = (e) => {
      const event: DashboardEvent = JSON.parse(e.data)
      setEvents(prev => [event, ...prev].slice(0, 50))

      if (event.type === 'outreach_sent') {
        setStats(s => ({ ...s, sent: s.sent + 1 }))
        addLog('action', `${event.manufacturer} — 이메일 발송 완료`)
      } else if (event.type === 'outreach_replied') {
        setStats(s => ({ ...s, replied: s.replied + 1 }))
        addLog('success', `${event.manufacturer} — 응답 수신!`)
      } else if (event.type === 'outreach_failed') {
        setStats(s => ({ ...s, failed: s.failed + 1 }))
        addLog('warning', `${event.manufacturer} — 발송 실패`)
      }
    }

    return () => es.close()
  }, [session_id])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-2xl mx-auto space-y-6 pb-4"
    >
      <div className="space-y-2">
        <div className="text-data text-primary font-mono">소싱 모니터링</div>
        <h2 className="text-xl font-semibold text-foreground">
          연락 진행 상황을 실시간으로 확인하세요
        </h2>
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-primary animate-pulse-glow' : 'bg-muted-foreground'}`} />
          <span className="text-data text-muted-foreground font-mono">
            {connected ? '실시간 모니터링 중' : '연결 시도 중...'}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: '전체 대상', value: active.length, accent: false },
          { label: '발송 완료', value: stats.sent,    accent: true },
          { label: '응답 수신', value: stats.replied,  accent: true },
          { label: '실패',     value: stats.failed,   accent: false },
        ].map(item => (
          <div key={item.label} className="glass-surface rounded-sm p-3 text-center">
            <div className={`text-2xl font-bold font-mono ${item.accent ? 'text-primary' : 'text-foreground'}`}>
              {item.value}
            </div>
            <div className="text-data text-muted-foreground mt-0.5">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Terminal log */}
      <div className="glass-surface rounded-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
            <span className="text-data text-muted-foreground font-mono">agent.log</span>
          </div>
          <span className="text-data text-muted-foreground font-mono">{logs.length} entries</span>
        </div>

        <div className="p-4 h-72 overflow-y-auto space-y-1 font-mono">
          <AnimatePresence>
            {logs.map(log => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-3"
              >
                <span className="text-data text-muted-foreground/50 flex-shrink-0 tabular-nums">{log.time}</span>
                <span className={`text-data ${LOG_COLORS[log.type]} flex-1`}>{log.text}</span>
              </motion.div>
            ))}
          </AnimatePresence>
          {/* Blinking cursor */}
          <div className="flex items-center gap-3">
            <span className="text-data text-muted-foreground/50">{now()}</span>
            <span className="inline-block w-2 h-3.5 bg-primary animate-terminal-blink" />
          </div>
        </div>
      </div>

      {/* Export buttons */}
      <div className="flex gap-3">
        <button className="flex-1 glass-surface hover:glass-surface-hover rounded-sm py-2.5 text-ui text-muted-foreground hover:text-foreground transition-colors">
          Excel 내보내기
        </button>
        <button className="flex-1 glass-surface hover:glass-surface-hover rounded-sm py-2.5 text-ui text-muted-foreground hover:text-foreground transition-colors">
          보고서 생성
        </button>
      </div>
    </motion.div>
  )
}
