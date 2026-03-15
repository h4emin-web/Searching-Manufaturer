'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWizardStore } from '../../../store/wizardStore'

const DOCS = [
  { id: 'coa',     label: 'COA',         desc: 'Certificate of Analysis', defaultOn: true },
  { id: 'msds',    label: 'MSDS/SDS',    desc: '물질안전보건자료', defaultOn: true },
  { id: 'sample',  label: '샘플 요청',    desc: '제품 샘플 요청', defaultOn: true },
  { id: 'dmf',     label: 'DMF 사본',     desc: 'Drug Master File', defaultOn: false },
  { id: 'gmp',     label: 'GMP 인증서',   desc: '제조 품질 인증', defaultOn: false },
  { id: 'spec',    label: '스펙시트',     desc: '제품 규격서', defaultOn: false },
  { id: 'stability', label: '안정성 데이터', desc: 'Stability Study', defaultOn: false },
]

const SAMPLE_AMOUNTS = ['최대 무료 제공량', '100g', '500g', '1kg', '5kg']

export default function Step5Communication() {
  const { step1, manufacturers, step5, updateStep5, markStepComplete, goToStep } = useWizardStore()
  const active = manufacturers.filter(m => !m.is_excluded)

  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(
    new Set(DOCS.filter(d => d.defaultOn).map(d => d.id))
  )
  const [sampleAmount, setSampleAmount] = useState(SAMPLE_AMOUNTS[0])
  const [notes, setNotes] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  const withEmail = active.filter(m => m.contact_email).length
  const withWebForm = active.filter(m => m.web_form_url).length

  const toggleDoc = (id: string) => {
    setSelectedDocs(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const messageEn = `Dear Supplier,

We are currently sourcing ${step1.ingredient_name || '[ingredient]'} for pharmaceutical use and would like to evaluate your company as a potential supplier.

Requirements:
• WHO-GMP Certification
• Ability to register Korea DMF (KDMF)
• Certificate of Pharmaceutical Product (CoPP)

Please provide product specifications, pricing (CIF Sea basis to Busan Port, South Korea), and relevant certificates.

Best regards,
Procurement Team`

  const startOutreach = async () => {
    updateStep5({ outreach_status: 'running' })
    markStepComplete(5)
    goToStep(6)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="max-w-xl mx-auto space-y-6"
    >
      <div className="space-y-2">
        <div className="text-data text-primary font-mono">STEP 5/5 — 자동 연락</div>
        <h2 className="text-xl font-semibold text-foreground">
          <span className="text-primary">{active.length}개</span> 제조소에 연락할 문서를 선택하세요
        </h2>
        <p className="text-muted-foreground text-ui">
          선택한 문서를 포함하여 자동으로 이메일을 발송합니다.
        </p>
      </div>

      {/* Channel status */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: '이메일', count: withEmail, icon: '✉️' },
          { label: '웹 문의', count: withWebForm, icon: '🌐' },
        ].map(ch => (
          <div key={ch.label} className="glass-surface rounded-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <span>{ch.icon}</span>
              <span className="text-ui font-medium text-muted-foreground">{ch.label}</span>
            </div>
            <div className="text-2xl font-bold text-primary font-mono">{ch.count}</div>
            <div className="text-data text-muted-foreground mt-0.5">제조소</div>
          </div>
        ))}
      </div>

      {/* Document selection */}
      <div className="space-y-2">
        <div className="text-data text-muted-foreground font-mono">요청 문서 선택</div>
        <div className="space-y-1.5">
          {DOCS.map((doc, i) => {
            const isSelected = selectedDocs.has(doc.id)
            return (
              <motion.button
                key={doc.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => toggleDoc(doc.id)}
                className={`w-full glass-surface rounded-sm p-3 text-left transition-all duration-200 flex items-center justify-between ${
                  isSelected ? 'ring-1 ring-primary/30 glow-primary' : 'hover:glass-surface-hover'
                }`}
              >
                <div>
                  <span className={`text-ui font-semibold transition-colors ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                    {doc.label}
                  </span>
                  <span className="text-data text-muted-foreground ml-2">{doc.desc}</span>
                </div>
                <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0 transition-all ${
                  isSelected ? 'bg-primary border-primary' : 'border-border'
                }`}>
                  {isSelected && (
                    <svg className="w-2 h-2 text-primary-foreground" fill="none" viewBox="0 0 12 12">
                      <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Sample amount */}
      {selectedDocs.has('sample') && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-2"
        >
          <div className="text-data text-muted-foreground font-mono">샘플 수량</div>
          <select
            value={sampleAmount}
            onChange={e => setSampleAmount(e.target.value)}
            className="w-full glass-surface rounded-sm px-3 py-2.5 text-ui text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            {SAMPLE_AMOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </motion.div>
      )}

      {/* Auto crawl option */}
      <label className="flex items-center gap-3 cursor-pointer glass-surface rounded-sm p-3 hover:glass-surface-hover transition-colors">
        <input
          type="checkbox"
          checked={step5.auto_crawl}
          onChange={e => updateStep5({ auto_crawl: e.target.checked })}
          className="w-4 h-4 accent-primary"
        />
        <div>
          <div className="text-ui font-medium text-foreground">발송 전 웹사이트 자동 크롤링</div>
          <div className="text-data text-muted-foreground">이메일 주소가 없는 제조소의 연락처를 자동으로 수집합니다.</div>
        </div>
      </label>

      {/* Message preview */}
      <div className="glass-surface rounded-sm overflow-hidden">
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="w-full flex items-center justify-between p-4 text-ui font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>메시지 미리보기</span>
          <span className="text-data font-mono">{showPreview ? '▲' : '▼'}</span>
        </button>
        <AnimatePresence>
          {showPreview && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden border-t border-border/50"
            >
              <pre className="p-4 text-data text-muted-foreground whitespace-pre-wrap leading-relaxed font-mono text-xs">
                {messageEn}
              </pre>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Optional notes */}
      <div className="space-y-2">
        <div className="text-data text-muted-foreground font-mono">추가 요청사항 (선택)</div>
        <textarea
          rows={2}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="특별 요구사항이나 추가 문의사항을 입력하세요"
          className="w-full glass-surface rounded-sm px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary text-ui bg-transparent resize-none"
        />
      </div>

      <button
        onClick={startOutreach}
        disabled={active.length === 0}
        className="w-full bg-primary text-primary-foreground px-6 py-3.5 rounded-sm font-semibold text-ui hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
      >
        🚀 {active.length}개 제조소에 자동 연락 시작
      </button>
    </motion.div>
  )
}
