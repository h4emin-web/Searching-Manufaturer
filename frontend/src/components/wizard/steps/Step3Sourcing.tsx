'use client'
import { useEffect, useRef } from 'react'
import { Bot, CheckCircle2, XCircle, Loader2, ArrowRight, Cpu } from 'lucide-react'
import { useWizardStore, LLMProvider } from '../../../store/wizardStore'
import axios from 'axios'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

const LLM_INFO: Record<LLMProvider, { name: string; desc: string; color: string; bg: string; border: string }> = {
  gpt4o:    { name: 'GPT-4o',    desc: 'OpenAI',   color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  gemini:   { name: 'Gemini',    desc: 'Google',   color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200' },
  deepseek: { name: 'DeepSeek',  desc: 'DeepSeek', color: 'text-violet-700',  bg: 'bg-violet-50',   border: 'border-violet-200' },
  qwen:     { name: 'Qwen',      desc: 'Alibaba',  color: 'text-orange-700',  bg: 'bg-orange-50',   border: 'border-orange-200' },
}

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

  const allLLMs = Object.keys(LLM_INFO) as LLMProvider[]

  return (
    <div className="space-y-6">
      {/* 검색 대상 */}
      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
        <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <Cpu size={16} className="text-indigo-600" />
        </div>
        <div>
          <div className="font-semibold text-gray-900 text-sm">{step1.ingredient_name}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {step1.use_case === 'pharmaceutical' ? '의약품' : step1.use_case}
            {step2.selections.filter(s => s.is_selected).length > 0 && (
              <> · {step2.selections.filter(s => s.is_selected).map(s => s.requirement_id).join(', ')}</>
            )}
          </div>
        </div>
      </div>

      {/* LLM 카드 */}
      <div className="grid grid-cols-2 gap-3">
        {allLLMs.map(provider => {
          const info = LLM_INFO[provider]
          const status = step3.llm_progress[provider]
          return (
            <div key={provider} className={`border rounded-xl p-4 ${info.bg} ${info.border}`}>
              <div className="flex items-center justify-between mb-1">
                <div className={`font-semibold text-sm ${info.color}`}>{info.name}</div>
                {status === 'pending' && <div className="w-2 h-2 rounded-full bg-gray-300" />}
                {status === 'running' && <Loader2 className="animate-spin text-gray-400" size={14} />}
                {status === 'done' && <CheckCircle2 className="text-emerald-500" size={14} />}
                {status === 'failed' && <XCircle className="text-red-400" size={14} />}
              </div>
              <div className={`text-xs ${info.color} opacity-60`}>
                {info.desc} ·{' '}
                {status === 'pending' ? '대기 중' : status === 'running' ? '검색 중...' : status === 'done' ? '완료' : '실패'}
              </div>
            </div>
          )
        })}
      </div>

      {/* 진행 바 */}
      {step3.sourcing_status === 'running' && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>제조소 검색 중...</span>
            <span>{step3.progress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-indigo-600 h-2 rounded-full transition-all duration-500" style={{ width: `${step3.progress}%` }} />
          </div>
        </div>
      )}

      {/* 완료 */}
      {step3.sourcing_status === 'completed' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="text-emerald-600" size={18} />
            <span className="font-semibold text-emerald-800 text-sm">검색 완료</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <div>
              <div className="text-2xl font-bold text-gray-900">{step3.total_raw}</div>
              <div className="text-xs text-gray-500 mt-0.5">총 검색 결과</div>
            </div>
            <div className="flex items-center justify-center">
              <ArrowRight className="text-gray-300" size={20} />
            </div>
            <div>
              <div className="text-2xl font-bold text-indigo-600">{step3.total_deduplicated}</div>
              <div className="text-xs text-gray-500 mt-0.5">중복 제거 후</div>
            </div>
          </div>
          <button
            onClick={() => { markStepComplete(3); goToStep(4) }}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors"
          >
            다음 단계: 제조소 검토
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* 시작 버튼 */}
      {step3.sourcing_status === 'idle' && (
        <button
          onClick={startSourcing}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors text-sm"
        >
          <Bot size={18} />
          AI 제조소 검색 시작
        </button>
      )}

      {step3.sourcing_status === 'failed' && (
        <div className="text-center py-4">
          <p className="text-red-600 text-sm mb-3">검색 중 오류가 발생했습니다.</p>
          <button onClick={startSourcing} className="text-indigo-600 text-sm underline">다시 시도</button>
        </div>
      )}
    </div>
  )
}
