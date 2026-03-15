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

const STEP_LABELS: Record<number, string> = {
  1: '원료 입력',
  2: '규제 요건',
  3: 'AI 제조소 검색',
  4: '제조소 검토',
  5: '자동 연락',
  6: '모니터링',
}

export default function WizardShell({ steps, currentStep, children }: Props) {
  const { step1, max_completed_step, goToStep } = useWizardStore()

  const progressPct =
    currentStep === 1 ? 0 :
    currentStep === 2 ? 20 :
    currentStep === 3 ? 40 :
    currentStep === 4 ? 60 :
    currentStep === 5 ? 80 :
    100

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur-sm z-20">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
          <span className="font-semibold text-foreground tracking-tight">Pharma Sourcing</span>
          <span className="text-data text-muted-foreground font-mono">v1.0</span>
        </div>
        <div className="flex items-center gap-4">
          {step1.ingredient_name && (
            <span className="text-data text-muted-foreground font-mono">
              {step1.ingredient_name} —{' '}
            </span>
          )}
          <div className="flex items-center gap-2">
            {steps.map((step) => {
              const isAccessible = step.id <= max_completed_step + 1
              const isCurrent = step.id === currentStep
              return (
                <button
                  key={step.id}
                  onClick={() => isAccessible && goToStep(step.id)}
                  disabled={!isAccessible}
                  className={`text-data font-mono transition-colors ${
                    isCurrent
                      ? 'text-primary'
                      : isAccessible
                      ? 'text-muted-foreground hover:text-foreground cursor-pointer'
                      : 'text-muted-foreground/30 cursor-not-allowed'
                  }`}
                  title={step.label}
                >
                  {step.id}
                </button>
              )
            })}
          </div>
          <span className="text-data text-muted-foreground font-mono">
            {currentStep === 1 ? '대기 중' : `Step ${currentStep}/${steps.length}`}
          </span>
        </div>
      </header>

      {/* Progress bar */}
      {currentStep > 1 && (
        <div className="h-[2px] bg-secondary">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Main content */}
      <main className={`px-6 py-8 ${currentStep === 6 ? 'pb-60' : ''}`}>
        <div className="max-w-2xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
