'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWizardStore, Manufacturer } from '../../../store/wizardStore'

export default function Step4Filtering() {
  const { manufacturers, toggleExclude, addManualManufacturer, markStepComplete, goToStep } = useWizardStore()
  const [addingCustom, setAddingCustom] = useState(false)
  const [newMfr, setNewMfr] = useState<Partial<Manufacturer>>({ certifications: [], source_llms: [] })

  const active = manufacturers.filter(m => !m.is_excluded)
  const excluded = manufacturers.filter(m => m.is_excluded)

  const handleAddManual = () => {
    if (!newMfr.name || !newMfr.country) return
    addManualManufacturer({
      id: 'manual-' + Date.now(),
      name: newMfr.name!,
      canonical_name: newMfr.name!.toLowerCase(),
      country: newMfr.country!,
      contact_email: newMfr.contact_email,
      website: newMfr.website,
      web_form_url: newMfr.website,
      certifications: [],
      source_llms: [],
      confidence_score: 1.0,
      is_excluded: false,
      is_manually_added: true,
    })
    setNewMfr({ certifications: [], source_llms: [] })
    setAddingCustom(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="max-w-2xl mx-auto space-y-6"
    >
      <div className="space-y-2">
        <div className="text-data text-primary font-mono">STEP 4/5 — 탐색 결과</div>
        <h2 className="text-xl font-semibold text-foreground">
          {manufacturers.length}개 제조소 중 요건에 부합하는{' '}
          <span className="text-primary">{active.length}곳</span>을 식별했습니다
        </h2>
        <p className="text-muted-foreground text-ui">
          제외할 제조소를 선택하세요. 나머지 제조소에 대해 소싱을 시작합니다.
        </p>
      </div>

      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {active.map((m) => (
            <motion.div
              key={m.id}
              layout
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
              className="glass-surface rounded-sm p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="font-semibold text-foreground">{m.name}</span>
                    {m.is_manually_added && (
                      <span className="text-data font-mono px-2 py-0.5 rounded-sm bg-accent/10 text-accent">수동 추가</span>
                    )}
                    {m.source_llms.length > 1 && (
                      <span className="text-data font-mono px-2 py-0.5 rounded-sm bg-primary/10 text-primary">
                        {m.source_llms.length}개 AI 확인
                      </span>
                    )}
                    <span className="text-data text-muted-foreground">— {m.country}{m.city && `, ${m.city}`}</span>
                  </div>

                  <div className="flex gap-4 mb-2 flex-wrap">
                    <div>
                      <span className="text-data text-muted-foreground">신뢰도 </span>
                      <span className="text-data font-mono font-semibold text-primary">
                        {Math.round(m.confidence_score * 100)}%
                      </span>
                    </div>
                    {m.contact_email && (
                      <div>
                        <span className="text-data text-muted-foreground">이메일 </span>
                        <span className="text-data font-mono text-foreground">{m.contact_email}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1.5 flex-wrap">
                    {m.certifications.map(c => (
                      <span key={c} className="text-data font-mono px-2 py-0.5 rounded-sm bg-primary/10 text-primary">
                        {c}
                      </span>
                    ))}
                    {m.website && (
                      <a
                        href={m.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-data text-muted-foreground hover:text-primary transition-colors"
                      >
                        🌐 웹사이트
                      </a>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => toggleExclude(m.id)}
                  className="text-data text-muted-foreground hover:text-destructive transition-colors ml-4 cursor-pointer flex-shrink-0"
                >
                  제외
                </button>
              </div>

              {/* Reliability bar */}
              <div className="mt-3">
                <div className="h-1 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.round(m.confidence_score * 100)}%` }}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {excluded.length > 0 && (
        <div className="space-y-2">
          <div className="text-data text-muted-foreground">제외된 제조소 ({excluded.length})</div>
          {excluded.map(m => (
            <div key={m.id} className="glass-surface rounded-sm p-3 opacity-50 flex items-center justify-between">
              <span className="text-data text-muted-foreground">{m.name} — {m.country}</span>
              <button
                onClick={() => toggleExclude(m.id)}
                className="text-data text-primary hover:underline cursor-pointer"
              >
                복원
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => setAddingCustom(true)}
          className="glass-surface hover:glass-surface-hover px-4 py-2.5 rounded-sm text-ui text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          + 제조소 직접 추가
        </button>
        <div className="flex-1" />
        <button
          onClick={() => { markStepComplete(4); goToStep(5) }}
          disabled={active.length === 0}
          className="bg-primary text-primary-foreground px-8 py-2.5 rounded-sm font-semibold text-ui hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          🚀 {active.length}개 제조소 소싱 시작
        </button>
      </div>

      <AnimatePresence>
        {addingCustom && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-surface rounded-sm p-4 space-y-3"
          >
            <div className="text-ui text-foreground font-semibold">제조소 직접 추가</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { placeholder: '제조소명 *', key: 'name' },
                { placeholder: '국가 *', key: 'country' },
                { placeholder: '이메일', key: 'contact_email' },
                { placeholder: '웹사이트 URL', key: 'website' },
              ].map(({ placeholder, key }) => (
                <input
                  key={key}
                  placeholder={placeholder}
                  value={(newMfr as any)[key] || ''}
                  onChange={e => setNewMfr(p => ({ ...p, [key]: e.target.value }))}
                  className="glass-surface rounded-sm p-2.5 text-foreground text-ui bg-transparent focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
                />
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAddingCustom(false)} className="text-data text-muted-foreground hover:text-foreground cursor-pointer">취소</button>
              <button onClick={handleAddManual} className="bg-primary text-primary-foreground px-4 py-1.5 rounded-sm text-data font-semibold cursor-pointer">추가</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
