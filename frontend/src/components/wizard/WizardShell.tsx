'use client'
import { useWizardStore } from '../../store/wizardStore'

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
  1: { title: '원료 정보 입력', subtitle: '검색할 의약품 원료명과 용도를 선택해주세요.' },
  2: { title: '규제 요건 확인', subtitle: '소싱 시 필요한 규제 인증 요건을 선택해주세요.' },
  3: { title: 'AI 제조소 검색', subtitle: '4개 AI 모델이 동시에 전 세계 제조소를 검색합니다.' },
  4: { title: '제조소 필터링', subtitle: '검색된 제조소를 검토하고 최종 대상을 선정해주세요.' },
  5: { title: '자동 연락 설정', subtitle: '선정된 제조소에 이메일/홈페이지 문의로 자동 연락합니다.' },
  6: { title: '소싱 모니터링', subtitle: '연락 진행 상황을 실시간으로 확인하세요.' },
}

export default function WizardShell({ steps, currentStep, children }: Props) {
  const { max_completed_step, goToStep, is_dirty, last_synced_at } = useWizardStore()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💊</span>
            <span className="font-bold text-gray-900">Pharma Sourcing Agent</span>
          </div>
          <div className="text-xs text-gray-400">
            {is_dirty ? '저장 중...' : last_synced_at ? `저장됨 ${new Date(last_synced_at).toLocaleTimeString('ko-KR')}` : ''}
          </div>
        </div>
      </header>

      {/* 스텝 네비게이션 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex">
            {steps.map((step, i) => {
              const isCompleted = step.id <= max_completed_step
              const isCurrent = step.id === currentStep
              const isAccessible = step.id <= max_completed_step + 1

              return (
                <button
                  key={step.id}
                  onClick={() => isAccessible && goToStep(step.id)}
                  disabled={!isAccessible}
                  className={`flex-1 flex flex-col items-center py-3 px-2 text-xs relative transition-colors
                    ${isCurrent ? 'text-blue-600 border-b-2 border-blue-600' : ''}
                    ${isCompleted && !isCurrent ? 'text-green-600' : ''}
                    ${!isAccessible ? 'text-gray-300 cursor-not-allowed' : ''}
                    ${isAccessible && !isCurrent ? 'hover:bg-gray-50 cursor-pointer' : ''}
                  `}
                >
                  <span className="text-base mb-0.5">{step.icon}</span>
                  <span className="hidden sm:block font-medium">{step.label}</span>
                  <span className="sm:hidden font-medium">{step.id}</span>
                  {isCompleted && !isCurrent && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-green-500 rounded-full" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 콘텐츠 */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {STEP_TITLES[currentStep]?.title}
          </h1>
          <p className="text-gray-500 mt-1">
            {STEP_TITLES[currentStep]?.subtitle}
          </p>
        </div>
        {children}
      </main>
    </div>
  )
}
