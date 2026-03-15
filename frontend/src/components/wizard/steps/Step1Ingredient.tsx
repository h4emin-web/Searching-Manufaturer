'use client'
import { useState } from 'react'
import { Pill, ChevronRight } from 'lucide-react'
import { useWizardStore, UseCase } from '../../../store/wizardStore'

const USE_CASES: { value: UseCase; label: string; icon: string; desc: string }[] = [
  { value: 'pharmaceutical', label: '의약품', icon: '💊', desc: 'WHO-GMP, KDMF, CoPP 등 규제 요건 확인' },
  { value: 'cosmetic',       label: '화장품', icon: '🧴', desc: 'ISO 22716, COSMOS 등 인증 기준 적용' },
  { value: 'food',           label: '식품',   icon: '🍃', desc: 'HACCP, 식품위생법 기준 적용' },
]

export default function Step1Ingredient() {
  const { step1, updateStep1, markStepComplete, goToStep } = useWizardStore()
  const [touched, setTouched] = useState(false)

  const isValid = step1.ingredient_name.trim().length >= 2 && step1.use_case !== null

  const handleNext = () => {
    if (!isValid) { setTouched(true); return }
    markStepComplete(1)
    goToStep(2)
  }

  return (
    <form
      className="max-w-xl mx-auto space-y-6"
      onSubmit={e => { e.preventDefault(); handleNext() }}
      noValidate
    >
      {/* 원료명 입력 */}
      <div>
        <label htmlFor="ingredient_name" className="block text-sm font-medium text-gray-700 mb-2">
          원료명 <span className="text-red-500" aria-hidden="true">*</span>
          <span className="sr-only">(필수)</span>
        </label>
        <div className="relative">
          <Pill className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} aria-hidden="true" />
          <input
            id="ingredient_name"
            type="text"
            value={step1.ingredient_name}
            onChange={e => updateStep1({ ingredient_name: e.target.value })}
            onBlur={() => setTouched(true)}
            placeholder="예: Ibuprofen, Metformin HCl, Ascorbic Acid..."
            autoComplete="off"
            aria-required="true"
            aria-invalid={touched && !step1.ingredient_name.trim() ? 'true' : 'false'}
            aria-describedby={touched && !step1.ingredient_name.trim() ? 'ingredient-error' : undefined}
            className={`w-full pl-10 pr-4 py-3 border rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              touched && !step1.ingredient_name.trim() ? 'border-red-400 bg-red-50' : 'border-gray-300'
            }`}
          />
        </div>
        <div className="mt-2">
          <label htmlFor="cas_number" className="sr-only">CAS 번호 (선택)</label>
          <input
            id="cas_number"
            type="text"
            value={step1.cas_number || ''}
            onChange={e => updateStep1({ cas_number: e.target.value })}
            placeholder="CAS No. (선택)"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          />
        </div>
        {touched && !step1.ingredient_name.trim() && (
          <p id="ingredient-error" role="alert" className="text-red-600 text-sm mt-1">
            원료명을 입력해주세요.
          </p>
        )}
      </div>

      {/* 용도 선택 */}
      <fieldset>
        <legend className="block text-sm font-medium text-gray-700 mb-2">
          용도 <span className="text-red-500" aria-hidden="true">*</span>
          <span className="sr-only">(필수)</span>
        </legend>
        <div className="space-y-2" role="radiogroup">
          {USE_CASES.map(uc => (
            <button
              key={uc.value}
              type="button"
              role="radio"
              aria-checked={step1.use_case === uc.value}
              onClick={() => updateStep1({ use_case: uc.value })}
              className={`w-full flex items-center gap-4 p-4 border-2 rounded-xl text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                step1.use_case === uc.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <span className="text-2xl" aria-hidden="true">{uc.icon}</span>
              <div className="flex-1">
                <div className="font-semibold text-gray-900">{uc.label}</div>
                <div className="text-sm text-gray-500">{uc.desc}</div>
              </div>
              {step1.use_case === uc.value && (
                <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center" aria-hidden="true">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
              )}
            </button>
          ))}
        </div>
        {touched && !step1.use_case && (
          <p role="alert" className="text-red-600 text-sm mt-1">용도를 선택해주세요.</p>
        )}
      </fieldset>

      {/* 소싱 참고사항 */}
      <div>
        <label htmlFor="sourcing_notes" className="block text-sm font-medium text-gray-700 mb-1">
          소싱 참고사항 <span className="text-gray-400 font-normal">(선택)</span>
        </label>
        <p className="text-xs text-gray-500 mb-2">
          사용 목적, 주의사항, 특별 요구사항 등 AI 소싱 시 참고할 내용을 자유롭게 입력하세요.
        </p>
        <textarea
          id="sourcing_notes"
          rows={4}
          value={step1.sourcing_notes || ''}
          onChange={e => updateStep1({ sourcing_notes: e.target.value })}
          placeholder="예: 완제품 A의 원료로 사용 예정. 입자 크기 D90 &lt; 50μm 필요. 중국산 제조원은 제외 희망. 연간 수요 약 500kg."
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 resize-y"
        />
      </div>

      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-3.5 rounded-xl hover:bg-blue-700 active:bg-blue-800 font-semibold flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors"
      >
        다음 단계
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </form>
  )
}
