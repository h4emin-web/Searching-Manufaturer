'use client'
import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useWizardStore, LLMProvider } from '../../../store/wizardStore'
import axios from 'axios'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

const LLM_INFO: Record<LLMProvider, { name: string; desc: string }> = {
  gpt4o:    { name: 'GPT-4o',   desc: 'OpenAI' },
  gemini:   { name: 'Gemini',   desc: 'Google' },
  deepseek: { name: 'DeepSeek', desc: 'DeepSeek' },
  qwen:     { name: 'Qwen',     desc: 'Alibaba' },
}

const REGIONS = [
  { id: 'china',  flag: '🇨🇳', name: '중국', count: '2,400+', desc: '가격 경쟁력' },
  { id: 'india',  flag: '🇮🇳', name: '인도', count: '1,800+', desc: 'WHO-GMP 인증' },
  { id: 'europe', flag: '🇪🇺', name: '유럽', count: '600+',   desc: '고품질' },
  { id: 'usa',    flag: '🇺🇸', name: '미국', count: '350+',   desc: 'FDA 등록' },
  { id: 'korea',  flag: '🇰🇷', name: '국내', count: '120+',   desc: '빠른 납기' },
  { id: 'other',  flag: '🌏', name: '기타', count: '500+',   desc: '기타 지역' },
]

export default function Step3Sourcing() {
  const { step1, step2, step3, updateStep3, setManufacturers, markStepComplete, goToStep } = useWizardStore()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startSourcing = async () => {
    updateStep3({ sourcing_status: 'running', progress: 0 })
    try {
      const res = await axios.post(`${API_BASE}/sourcing/run`, {
        session_id: 'demo',
        ingredient_name: step1.ingredient_name,
        use_case: step1.use_case,
        regulatory_requirements: step2.selections.filter(s => s.is_selected).map(s => s.requirement_id),
        sourcing_notes: step1.sourcing_notes || '',
      })
      const { task_id } = res.data
      updateStep3({ sourcing_task_id: task_id })
      pollSourcingStatus(task_id)
    } catch {
      updateStep3({ sourcing_status: 'failed' })
    }
  }

  const pollSourcingStatus = (taskId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE}/sourcing/${taskId}`)
        const data = res.data
        updateStep3({ progress: data.progress, total_raw: data.total_raw, total_deduplicated: data.total_deduplicated })
        if (data.status === 'completed') {
          clearInterval(pollRef.current!)
          updateStep3({ sourcing_status: 'completed' })
          setManufacturers(data.deduplicated)
        } else if (data.status === 'failed') {
          clearInterval(pollRef.current!)
          updateStep3({ sourcing_status: 'failed' })
        }
      } catch {
        clearInterval(pollRef.current!)
      }
    }, 2000)
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const allLLMs: LLMProvider[] = ['gemini', 'qwen']

  if (step3.sourcing_status === 'idle') {
    return (
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
        className="max-w-xl mx-auto space-y-6"
      >
        <div className="space-y-2">
          <div className="text-data text-primary font-mono">STEP 3/5 — AI 제조소 검색</div>
          <h2 className="text-xl font-semibold text-foreground">
            <span className="text-primary">{step1.ingredient_name}</span> 제조소를 탐색합니다
          </h2>
          <p className="text-muted-foreground text-ui">
            Gemini와 Qwen이 전 세계 제조소를 병렬로 검색하고 결과를 통합합니다.
          </p>
        </div>

        {/* Region display */}
        <div className="grid grid-cols-3 gap-2">
          {REGIONS.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="glass-surface rounded-sm p-3 text-center"
            >
              <div className="text-lg mb-1">{r.flag}</div>
              <div className="text-data font-semibold text-foreground">{r.name}</div>
              <div className="text-data text-primary font-mono">{r.count}</div>
              <div className="text-data text-muted-foreground">{r.desc}</div>
            </motion.div>
          ))}
        </div>

        {/* AI engines */}
        <div className="glass-surface rounded-sm p-4 space-y-3">
          <div className="text-data text-muted-foreground font-mono">사용 AI 엔진</div>
          <div className="flex gap-3">
            {allLLMs.map(provider => (
              <div key={provider} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
                <span className="text-ui font-semibold text-foreground">{LLM_INFO[provider].name}</span>
                <span className="text-data text-muted-foreground">{LLM_INFO[provider].desc}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={startSourcing}
          className="w-full bg-primary text-primary-foreground px-6 py-3.5 rounded-sm font-semibold text-ui hover:opacity-90 transition-opacity"
        >
          🚀 AI 제조소 검색 시작
        </button>
      </motion.div>
    )
  }

  if (step3.sourcing_status === 'running') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-xl mx-auto space-y-6"
      >
        <div className="space-y-2">
          <div className="text-data text-primary font-mono">STEP 3/5 — AI 제조소 검색</div>
          <h2 className="text-xl font-semibold text-foreground">제조소 탐색 중...</h2>
        </div>

        {/* LLM status */}
        <div className="space-y-2">
          {allLLMs.map(provider => {
            const status = step3.llm_progress[provider]
            return (
              <div key={provider} className="glass-surface rounded-sm p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-foreground">{LLM_INFO[provider].name}</div>
                  <div className="text-data text-muted-foreground">{LLM_INFO[provider].desc}</div>
                </div>
                <div className="flex items-center gap-2">
                  {status === 'running' && (
                    <>
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
                      <span className="text-data text-primary font-mono">검색 중...</span>
                    </>
                  )}
                  {status === 'done' && (
                    <>
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span className="text-data text-primary font-mono">완료</span>
                    </>
                  )}
                  {status === 'pending' && (
                    <span className="text-data text-muted-foreground font-mono">대기 중</span>
                  )}
                  {status === 'failed' && (
                    <span className="text-data text-destructive font-mono">실패</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-data text-muted-foreground font-mono">
            <span>제조소 검색 중...</span>
            <span>{step3.progress}%</span>
          </div>
          <div className="h-[2px] bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{ width: `${step3.progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <div className="relative h-8 overflow-hidden rounded-sm bg-secondary/50">
            <div className="scanning-line h-full w-full" />
          </div>
        </div>
      </motion.div>
    )
  }

  if (step3.sourcing_status === 'completed') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-xl mx-auto space-y-6"
      >
        <div className="space-y-2">
          <div className="text-data text-primary font-mono">STEP 3/5 — AI 제조소 검색</div>
          <h2 className="text-xl font-semibold text-foreground">탐색 완료</h2>
        </div>

        <div className="glass-surface rounded-sm p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="font-semibold text-foreground">검색 결과</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold text-foreground font-mono">{step3.total_raw}</div>
              <div className="text-data text-muted-foreground mt-1">총 검색 결과</div>
            </div>
            <div className="flex items-center justify-center text-muted-foreground text-lg">→</div>
            <div>
              <div className="text-3xl font-bold text-primary font-mono">{step3.total_deduplicated}</div>
              <div className="text-data text-muted-foreground mt-1">중복 제거 후</div>
            </div>
          </div>
        </div>

        <button
          onClick={() => { markStepComplete(3); goToStep(4) }}
          className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-sm font-semibold text-ui hover:opacity-90 transition-opacity"
        >
          제조소 검토하기 →
        </button>
      </motion.div>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-4 text-center py-12">
      <p className="text-destructive text-ui">검색 중 오류가 발생했습니다.</p>
      <button onClick={startSourcing} className="text-data text-primary hover:underline">
        다시 시도
      </button>
    </div>
  )
}
