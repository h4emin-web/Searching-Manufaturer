'use client'
/**
 * Step 3: Multi-LLM 제조소 소싱 + 실시간 진행 + 중복 제거 결과 표시
 */
import { useEffect, useRef, useState } from 'react'
import { Bot, CheckCircle2, XCircle, Loader2, Merge, Users } from 'lucide-react'
import { useWizardStore, Manufacturer, LLMProvider } from '../../../store/wizardStore'
import axios from 'axios'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

const LLM_INFO: Record<LLMProvider, { name: string; color: string; bg: string }> = {
  gpt4o:    { name: 'GPT-4o',    color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  gemini:   { name: 'Gemini',    color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  deepseek: { name: 'DeepSeek',  color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  qwen:     { name: 'Qwen',      color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
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
        regulatory_requirements: step2.selections
          .filter(s => s.is_selected)
          .map(s => s.requirement_id),
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
        updateStep3({
          progress: data.progress,
          total_raw: data.total_raw,
          total_deduplicated: data.total_deduplicated,
        })
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
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 검색 대상 요약 */}
      <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-4">
        <div className="text-2xl">🔍</div>
        <div>
          <div className="font-semibold text-gray-900">{step1.ingredient_name}</div>
          <div className="text-sm text-gray-500">
            {step1.use_case === 'pharmaceutical' ? '의약품' : step1.use_case} ·{' '}
            {step2.selections.filter(s => s.is_selected).map(s => s.requirement_id).join(', ')}
          </div>
        </div>
      </div>

      {/* LLM 진행 상태 카드 */}
      <div className="grid grid-cols-2 gap-3">
        {allLLMs.map(provider => {
          const info = LLM_INFO[provider]
          const status = step3.llm_progress[provider]
          return (
            <div key={provider} className={`border rounded-xl p-4 ${info.bg}`}>
              <div className="flex items-center justify-between mb-2">
                <div className={`font-semibold ${info.color}`}>{info.name}</div>
                {status === 'pending' && <div className="w-2 h-2 rounded-full bg-gray-300" />}
                {status === 'running' && <Loader2 className="animate-spin text-gray-500" size={16} />}
                {status === 'done' && <CheckCircle2 className="text-green-500" size={16} />}
                {status === 'failed' && <XCircle className="text-red-500" size={16} />}
              </div>
              <div className={`text-xs ${info.color} opacity-70`}>
                {status === 'pending' ? '대기 중' :
                 status === 'running' ? '검색 중...' :
                 status === 'done' ? '완료' : '실패'}
              </div>
            </div>
          )
        })}
      </div>

      {/* 전체 진행 바 */}
      {step3.sourcing_status === 'running' && (
        <div>
          <div className="flex justify-between text-sm text-gray-500 mb-1">
            <span>제조소 검색 중...</span>
            <span>{step3.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${step3.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* 결과 요약 */}
      {step3.sourcing_status === 'completed' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="text-green-600" size={20} />
            <span className="font-semibold text-green-800">소싱 완료</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">{step3.total_raw}</div>
              <div className="text-sm text-gray-500">총 검색 결과</div>
            </div>
            <div className="flex items-center justify-center">
              <Merge className="text-blue-500" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-700">{step3.total_deduplicated}</div>
              <div className="text-sm text-gray-500">중복 제거 후</div>
            </div>
          </div>
          <div className="mt-3 text-center text-sm text-gray-500">
            {step3.total_raw - step3.total_deduplicated}개 중복 항목 병합됨
          </div>
          <button
            onClick={() => { markStepComplete(3); goToStep(4) }}
            className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium"
          >
            다음 단계: 필터링
          </button>
        </div>
      )}

      {/* 시작 버튼 */}
      {step3.sourcing_status === 'idle' && (
        <button
          onClick={startSourcing}
          className="w-full bg-blue-600 text-white py-4 rounded-xl hover:bg-blue-700 font-semibold text-lg flex items-center justify-center gap-2"
        >
          <Bot size={22} />
          4개 AI 모델로 제조소 검색 시작
        </button>
      )}
    </div>
  )
}
