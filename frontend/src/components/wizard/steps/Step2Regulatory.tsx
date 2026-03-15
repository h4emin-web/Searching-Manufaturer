'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useWizardStore } from '../../../store/wizardStore'

const PHARMA_REQS = [
  { id: 'WHO-GMP', label: 'WHO-GMP', desc: '세계보건기구 우수 의약품 제조 기준' },
  { id: 'KDMF', label: 'KDMF', desc: '한국 의약품 원료 마스터 파일' },
  { id: 'WC', label: 'WC', desc: 'Written Confirmation (서면확인서)' },
  { id: 'CoPP', label: 'CoPP', desc: 'Certificate of Pharmaceutical Product' },
  { id: 'CEP/COS', label: 'CEP/COS', desc: 'Certificate of Suitability (유럽 의약품청)' },
  { id: 'US-DMF', label: 'US DMF', desc: 'FDA Drug Master File' },
]

const COSMETIC_REQS = [
  { id: 'ISO-22716', label: 'ISO 22716', desc: '화장품 GMP 국제 표준' },
  { id: 'COSMOS', label: 'COSMOS', desc: '유기농·천연 화장품 인증' },
  { id: 'REACH', label: 'REACH', desc: 'EU 화학물질 등록·평가·허가' },
  { id: 'Safety-Doc', label: '안전성 자료', desc: '성분 안전성 평가 문서' },
]

const FOOD_REQS = [
  { id: 'HACCP', label: 'HACCP', desc: '식품안전관리인증기준' },
  { id: 'FDA-GRAS', label: 'FDA GRAS', desc: '미국 FDA 안전성 인정' },
  { id: 'Food-Additive', label: '식품첨가물 등록', desc: '국내 식품첨가물 공전 등재' },
  { id: 'Halal', label: 'Halal 인증', desc: '이슬람 식품 인증' },
  { id: 'Kosher', label: 'Kosher 인증', desc: '유대교 식품 인증' },
]

export default function Step2Regulatory() {
  const { step1, step2, updateStep2, markStepComplete, goToStep } = useWizardStore()
  const [selected, setSelected] = useState<Set<string>>(
    new Set(step2.selections.filter(s => s.is_selected).map(s => s.requirement_id))
  )

  const reqs =
    step1.use_case === 'pharmaceutical' ? PHARMA_REQS :
    step1.use_case === 'cosmetic' ? COSMETIC_REQS :
    FOOD_REQS

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleSubmit = () => {
    updateStep2({
      selections: reqs.map(r => ({ requirement_id: r.id, is_selected: selected.has(r.id), is_mandatory: false, notes: '' }))
    })
    markStepComplete(2)
    goToStep(3)
  }

  const purposeLabel =
    step1.use_case === 'pharmaceutical' ? '의약품' :
    step1.use_case === 'cosmetic' ? '화장품' : '식품'

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="max-w-xl mx-auto space-y-6"
    >
      <div className="space-y-2">
        <div className="text-data text-primary font-mono">STEP 2/5 — 규제 요건</div>
        <h2 className="text-xl font-semibold text-foreground">
          {purposeLabel} 소싱에 필요한 요건을 선택하세요
        </h2>
        <p className="text-muted-foreground text-ui">
          미선택 시 모든 제조소를 포함하여 검색합니다.
        </p>
      </div>

      {step1.use_case === 'pharmaceutical' && !selected.has('KDMF') && (
        <div className="glass-surface rounded-sm p-3 border-l-2 border-accent">
          <p className="text-data text-accent">
            ⚠️ KDMF 미등록 제조소는 국내 수입 시 별도 등록 절차가 필요합니다.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {reqs.map((req, i) => {
          const isSelected = selected.has(req.id)
          return (
            <motion.button
              key={req.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              onClick={() => toggle(req.id)}
              className={`w-full glass-surface rounded-sm p-4 text-left transition-all duration-200 ${
                isSelected ? 'glow-primary ring-1 ring-primary/30' : 'hover:glass-surface-hover'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className={`font-semibold transition-colors ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                    {req.label}
                  </div>
                  <div className="text-data text-muted-foreground mt-0.5">{req.desc}</div>
                </div>
                <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  isSelected ? 'bg-primary border-primary' : 'border-border'
                }`}>
                  {isSelected && (
                    <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 12 12">
                      <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>

      <button
        onClick={handleSubmit}
        className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-sm font-semibold text-ui hover:opacity-90 transition-opacity"
      >
        {selected.size > 0 ? `${selected.size}개 요건 선택 완료` : '요건 없이 계속'} →
      </button>
    </motion.div>
  )
}
