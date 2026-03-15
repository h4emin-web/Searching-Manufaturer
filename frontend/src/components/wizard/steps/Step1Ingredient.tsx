'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search } from 'lucide-react'
import { useWizardStore, UseCase } from '../../../store/wizardStore'

const USE_CASES: { value: UseCase; emoji: string; label: string; desc: string }[] = [
  { value: 'pharmaceutical', emoji: '💊', label: '의약품', desc: 'WHO-GMP, KDMF, WC, CoPP 등 규제 요건 충족 필요' },
  { value: 'cosmetic',       emoji: '✨', label: '화장품', desc: 'ISO 22716, COSMOS 등 인증 기준 적용' },
  { value: 'food',           emoji: '🌿', label: '식품',   desc: 'HACCP, 식품위생법 기준 적용' },
]

export default function Step1Ingredient() {
  const { step1, updateStep1, markStepComplete, goToStep } = useWizardStore()
  const [phase, setPhase] = useState<'search' | 'purpose'>(step1.ingredient_name ? 'purpose' : 'search')
  const [query, setQuery] = useState(step1.ingredient_name)
  const [touched, setTouched] = useState(false)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    updateStep1({ ingredient_name: query.trim() })
    setPhase('purpose')
  }

  const handleSelectPurpose = (uc: UseCase) => {
    updateStep1({ use_case: uc })
    markStepComplete(1)
    goToStep(2)
  }

  return (
    <AnimatePresence mode="wait">
      {phase === 'search' ? (
        <motion.div
          key="search"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          className="flex flex-col items-center justify-center min-h-[60vh] gap-8"
        >
          <div className="text-center space-y-3">
            <div className="text-data text-muted-foreground tracking-widest uppercase font-mono">
              API Sourcing Command Center
            </div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">
              원료 의약품 소싱 에이전트
            </h1>
            <p className="text-muted-foreground max-w-md text-ui">
              원료명을 입력하면 AI 에이전트가 글로벌 제조소 탐색부터 견적 확보까지 전 과정을 자동으로 수행합니다.
            </p>
          </div>

          <form onSubmit={handleSearch} className="w-full max-w-xl">
            <div className="relative glass-surface rounded-sm group focus-within:glow-primary transition-shadow duration-300">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="원료 의약품명을 입력하세요 (예: Ibuprofen, Metformin HCl)"
                className="w-full bg-transparent pl-11 pr-4 py-3.5 text-foreground placeholder:text-muted-foreground focus:outline-none text-ui"
                autoFocus
              />
              <div className="absolute bottom-0 left-0 right-0 h-[1px] overflow-hidden">
                <div className="scanning-line h-full w-full" />
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <input
                type="text"
                value={step1.cas_number || ''}
                onChange={(e) => updateStep1({ cas_number: e.target.value })}
                placeholder="CAS No. (선택 입력)"
                className="w-full glass-surface rounded-sm px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary text-ui bg-transparent"
              />
            </div>
          </form>
        </motion.div>
      ) : (
        <motion.div
          key="purpose"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          className="max-w-xl mx-auto space-y-6"
        >
          <div className="space-y-2">
            <div className="text-data text-primary font-mono">STEP 1/5 — 용도 선택</div>
            <h2 className="text-xl font-semibold text-foreground">
              <span className="text-primary">{step1.ingredient_name}</span>의 용도를 선택하세요
            </h2>
            <p className="text-muted-foreground text-ui">용도에 따라 적용되는 규제 요건이 달라집니다.</p>
          </div>

          <div className="space-y-2">
            {USE_CASES.map((uc, i) => (
              <motion.button
                key={uc.value}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08, duration: 0.3 }}
                onClick={() => handleSelectPurpose(uc.value)}
                className="w-full glass-surface hover:glass-surface-hover rounded-sm p-4 text-left transition-all duration-200 hover:glow-primary group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{uc.emoji}</span>
                  <div>
                    <div className="font-semibold text-foreground group-hover:text-primary transition-colors">{uc.label}</div>
                    <div className="text-data text-muted-foreground mt-0.5">{uc.desc}</div>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-data text-muted-foreground font-mono">소싱 참고사항 (선택)</label>
            <textarea
              rows={3}
              value={step1.sourcing_notes || ''}
              onChange={(e) => updateStep1({ sourcing_notes: e.target.value })}
              placeholder="예: 입자 크기 D90 < 50μm, 연간 수요 500kg, 중국산 제외 희망"
              className="w-full glass-surface rounded-sm px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary text-ui bg-transparent resize-none"
            />
          </div>

          <button
            onClick={() => { setQuery(''); setPhase('search') }}
            className="text-data text-muted-foreground hover:text-foreground transition-colors"
          >
            ← 원료명 다시 입력
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
