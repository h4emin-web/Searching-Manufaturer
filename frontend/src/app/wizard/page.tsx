'use client'
import { useEffect } from 'react'
import { useWizardStore } from '../../store/wizardStore'
import WizardShell from '../../components/wizard/WizardShell'
import Step1Ingredient from '../../components/wizard/steps/Step1Ingredient'
import Step2Regulatory from '../../components/wizard/steps/Step2Regulatory'
import Step3Sourcing from '../../components/wizard/steps/Step3Sourcing'
import Step4Filtering from '../../components/wizard/steps/Step4Filtering'
import Step5Communication from '../../components/wizard/steps/Step5Communication'
import Step6Dashboard from '../../components/wizard/steps/Step6Dashboard'

const STEPS = [
  { id: 1, label: '원료 입력',    icon: '🔬', component: Step1Ingredient },
  { id: 2, label: '규제 요건',    icon: '📋', component: Step2Regulatory },
  { id: 3, label: '제조소 검색',  icon: '🤖', component: Step3Sourcing },
  { id: 4, label: '필터링',       icon: '🔽', component: Step4Filtering },
  { id: 5, label: '자동 연락',    icon: '📨', component: Step5Communication },
  { id: 6, label: '모니터링',     icon: '📊', component: Step6Dashboard },
]

export default function WizardPage() {
  const { current_step, session_id, setSessionId } = useWizardStore()

  // 세션 없으면 생성
  useEffect(() => {
    if (!session_id) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
        .then(r => r.json())
        .then(data => setSessionId(data.id))
        .catch(() => setSessionId('local-' + Date.now()))
    }
  }, [session_id, setSessionId])

  const CurrentStep = STEPS.find(s => s.id === current_step)?.component

  return (
    <WizardShell steps={STEPS} currentStep={current_step}>
      {CurrentStep ? <CurrentStep /> : null}
    </WizardShell>
  )
}
