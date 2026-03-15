'use client'
import { useEffect, useState } from 'react'
import { CheckCircle2, Clock, XCircle, MessageCircle, Mail, Phone, Globe } from 'lucide-react'
import { useWizardStore } from '../../../store/wizardStore'

interface DashboardEvent {
  type: string
  manufacturer?: string
  channel?: string
  message?: string
  progress?: number
  total_raw?: number
  total_dedup?: number
}

export default function Step6Dashboard() {
  const { session_id, manufacturers } = useWizardStore()
  const [events, setEvents] = useState<DashboardEvent[]>([])
  const [stats, setStats] = useState({ sent: 0, replied: 0, pending: 0, failed: 0 })
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
    const es = new EventSource(`${API_BASE}/dashboard/${session_id || 'demo'}/stream`)

    es.onopen = () => setConnected(true)
    es.onerror = () => setConnected(false)

    es.onmessage = (e) => {
      const event: DashboardEvent = JSON.parse(e.data)
      setEvents(prev => [event, ...prev].slice(0, 50))  // 최근 50개 유지

      if (event.type === 'outreach_sent') {
        setStats(s => ({ ...s, sent: s.sent + 1, pending: Math.max(0, s.pending - 1) }))
      } else if (event.type === 'outreach_replied') {
        setStats(s => ({ ...s, replied: s.replied + 1 }))
      }
    }

    return () => es.close()
  }, [session_id])

  const activeCount = manufacturers.filter(m => !m.is_excluded).length

  const CHANNEL_ICONS = {
    wechat: MessageCircle, whatsapp: Phone, email: Mail, web_form: Globe,
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 연결 상태 */}
      <div className={`flex items-center gap-2 text-sm ${connected ? 'text-green-600' : 'text-gray-400'}`}>
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
        {connected ? '실시간 모니터링 중' : '연결 시도 중...'}
      </div>

      {/* 핵심 지표 */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '전체 대상', value: activeCount, icon: null, color: 'text-gray-900' },
          { label: '발송 완료', value: stats.sent, icon: CheckCircle2, color: 'text-blue-700' },
          { label: '응답 수신', value: stats.replied, icon: CheckCircle2, color: 'text-green-700' },
          { label: '실패', value: stats.failed, icon: XCircle, color: 'text-red-600' },
        ].map(item => (
          <div key={item.label} className="bg-white border rounded-xl p-4 text-center">
            {item.icon && <item.icon className={`mx-auto mb-1 ${item.color}`} size={20} />}
            <div className={`text-3xl font-bold ${item.color}`}>{item.value}</div>
            <div className="text-xs text-gray-500">{item.label}</div>
          </div>
        ))}
      </div>

      {/* 실시간 이벤트 피드 */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-900">실시간 이벤트</h3>
        </div>
        <div className="divide-y max-h-80 overflow-y-auto">
          {events.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">이벤트 대기 중...</div>
          ) : events.map((ev, i) => {
            const Icon = ev.channel ? CHANNEL_ICONS[ev.channel as keyof typeof CHANNEL_ICONS] : Clock
            return (
              <div key={i} className="flex items-center gap-3 p-3 text-sm">
                {Icon && <Icon size={16} className="text-gray-400 flex-shrink-0" />}
                <div className="flex-1">
                  {ev.manufacturer && <span className="font-medium text-gray-900">{ev.manufacturer}</span>}
                  {ev.message && <span className="text-gray-500 ml-2">{ev.message}</span>}
                  {ev.type === 'outreach_replied' && (
                    <span className="ml-2 text-green-600 font-medium">응답 수신!</span>
                  )}
                </div>
                {ev.channel && (
                  <span className="text-xs text-gray-400 capitalize">{ev.channel}</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 내보내기 */}
      <div className="flex gap-3">
        <button className="flex-1 border border-gray-300 rounded-xl py-3 text-sm text-gray-700 hover:bg-gray-50 font-medium">
          Excel 내보내기
        </button>
        <button className="flex-1 border border-gray-300 rounded-xl py-3 text-sm text-gray-700 hover:bg-gray-50 font-medium">
          보고서 생성
        </button>
      </div>
    </div>
  )
}
