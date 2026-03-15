'use client'
import { useWizardStore } from '../../store/wizardStore'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'

interface Step {
  id: number
  label: string
  icon: string
}

interface Props {
  steps: Step[]
  currentStep: number
  children: React.ReactNode
}

const STEP_TITLES: Record<number, { title: string; subtitle: string }> = {
  1: { title: '원료 정보 입력',   subtitle: '검색할 원료명과 용도를 입력하세요.' },
  2: { title: '규제 요건 확인',   subtitle: '소싱 시 필요한 규제 인증 요건을 선택하세요.' },
  3: { title: 'AI 제조소 검색',   subtitle: '복수의 AI 모델이 전 세계 제조소를 검색합니다.' },
  4: { title: '제조소 검토',      subtitle: '검색된 제조소를 검토하고 최종 대상을 선정하세요.' },
  5: { title: '자동 연락 설정',   subtitle: '선정된 제조소에 이메일로 자동 연락합니다.' },
  6: { title: '소싱 모니터링',    subtitle: '연락 진행 상황을 실시간으로 확인하세요.' },
}

export default function WizardShell({ steps, currentStep, children }: Props) {
  const { max_completed_step, goToStep } = useWizardStore()

  return (
    <div className="min-h-screen bg-[#f8f9fc] flex flex-col">
      {/* 상단 헤더 */}
      <header className="bg-white border-b border-gray-200 h-14 flex items-center px-6 sticky top-0 z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm">💊</span>
          </div>
          <span className="font-semibold text-gray-900 text-sm tracking-tight">Pharma Sourcing</span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-gray-400">
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          시스템 정상
        </div>
      </header>

      <div className="flex flex-1">
        {/* 사이드바 */}
        <aside className="w-60 bg-white border-r border-gray-200 sticky top-14 h-[calc(100vh-3.5rem)] p-4 flex flex-col">
          <nav className="space-y-0.5 flex-1">
            {steps.map((step) => {
              const isCompleted = step.id <= max_completed_step
              const isCurrent = step.id === currentStep
              const isAccessible = step.id <= max_completed_step + 1

              return (
                <button
                  key={step.id}
                  onClick={() => isAccessible && goToStep(step.id)}
                  disabled={!isAccessible}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    isCurrent
                      ? 'bg-indigo-50 text-indigo-700 font-medium'
                      : isCompleted
                      ? 'text-gray-600 hover:bg-gray-50 cursor-pointer'
                      : isAccessible
                      ? 'text-gray-600 hover:bg-gray-50 cursor-pointer'
                      : 'text-gray-300 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold ${
                    isCurrent
                      ? 'bg-indigo-600 text-white'
                      : isCompleted
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {isCompleted && !isCurrent ? (
                      <CheckCircle2 size={14} className="text-emerald-600" />
                    ) : (
                      step.id
                    )}
                  </div>
                  <span className="truncate">{step.label}</span>
                  {isCurrent && (
                    <div className="ml-auto w-1.5 h-1.5 bg-indigo-600 rounded-full flex-shrink-0" />
                  )}
                </button>
              )
            })}
          </nav>

          {/* 하단 진행률 */}
          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
              <span>전체 진행률</span>
              <span>{Math.round((max_completed_step / steps.length) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${(max_completed_step / steps.length) * 100}%` }}
              />
            </div>
          </div>
        </aside>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 p-8 min-w-0">
          <div className="max-w-3xl mx-auto">
            {/* 페이지 타이틀 */}
            <div className="mb-8">
              <div className="flex items-center gap-2 text-xs text-indigo-600 font-medium mb-2">
                <span>Step {currentStep}</span>
                <span className="text-gray-300">/</span>
                <span className="text-gray-400">{steps.length}</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                {STEP_TITLES[currentStep]?.title}
              </h1>
              <p className="text-gray-500 mt-1 text-sm">
                {STEP_TITLES[currentStep]?.subtitle}
              </p>
            </div>

            {/* 콘텐츠 */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
