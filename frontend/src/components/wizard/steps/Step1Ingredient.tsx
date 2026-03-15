'use client'
import { useState } from 'react'
import { Pill, ChevronRight, FlaskConical, Leaf, Sparkles } from 'lucide-react'
import { useWizardStore, UseCase } from '../../../store/wizardStore'

const USE_CASES: { value: UseCase; label: string; icon: React.ReactNode; desc: string; color: string }[] = [
  {
    value: 'pharmaceutical',
    label: '의약품',
    icon: <Pill size={18} />,
    desc: 'WHO-GMP, KDMF, CoPP 등 규제 요건 확인',
    color: 'indigo',
  },
  {
    value: 'cosmetic',
    label: '화장품',
    icon: <Sparkles size={18} />,
    desc: 'ISO 22716, COSMOS 등 인증 기준 적용',
    color: 'pink',
  },
  {
    value: 'food',
    label: '식품',
    icon: <Leaf size={18} />,
    desc: 'HACCP, 식품위생법 기준 적용',
    color: 'emerald',
  },
]

const COLOR_MAP = {
  indigo: {
    selected: 'border-indigo-500 bg-indigo-50',
    icon: 'bg-indigo-100 text-indigo-600',
    dot: 'bg-indigo-500',
  },
  pink: {
    selected: 'border-pink-400 bg-pink-50',
    icon: 'bg-pink-100 text-pink-600',
    dot: 'bg-pink-400',
  },
  emerald: {
    selected: 'border-emerald-400 bg-emerald-50',
    icon: 'bg-emerald-100 text-emerald-600',
    dot: 'bg-emerald-400',
  },
}

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
    <form className="space-y-7" onSubmit={e => { e.preventDefault(); handleNext() }} noValidate>

      {/* 원료명 */}
      <div className="space-y-2">
        <label htmlFor="ingredient_name" className="block text-sm font-medium text-gray-700">
          원료명 <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <Pill className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
          <input
            id="ingredient_name"
            type="text"
            value={step1.ingredient_name}
            onChange={e => updateStep1({ ingredient_name: e.target.value })}
            onBlur={() => setTouched(true)}
            placeholder="예: Ibuprofen, Metformin HCl, Ascorbic Acid"
            autoComplete="off"
            className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm bg-white text-gray-900 placeholder-gray-400 outline-none transition-all
              focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500
              ${touched && !step1.ingredient_name.trim() ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}
          />
        </div>

        <div>
          <label htmlFor="cas_number" className="sr-only">CAS 번호</label>
          <input
            id="cas_number"
            type="text"
            value={step1.cas_number || ''}
            onChange={e => updateStep1({ cas_number: e.target.value })}
            placeholder="CAS No. (선택 입력)"
            className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-400 outline-none hover:border-gray-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
        {touched && !step1.ingredient_name.trim() && (
          <p className="text-red-500 text-xs mt-1">원료명을 입력해주세요.</p>
        )}
      </div>

      {/* 용도 선택 */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          용도 <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          {USE_CASES.map(uc => {
            const colors = COLOR_MAP[uc.color as keyof typeof COLOR_MAP]
            const isSelected = step1.use_case === uc.value
            return (
              <button
                key={uc.value}
                type="button"
                onClick={() => updateStep1({ use_case: uc.value })}
                className={`relative flex flex-col items-start gap-2 p-4 border-2 rounded-xl text-left transition-all outline-none
                  focus-visible:ring-2 focus-visible:ring-indigo-500
                  ${isSelected ? colors.selected : 'border-gray-200 bg-white hover:border-gray-300'}`}
              >
                <div className={`p-2 rounded-lg ${isSelected ? colors.icon : 'bg-gray-100 text-gray-500'}`}>
                  {uc.icon}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{uc.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{uc.desc}</div>
                </div>
                {isSelected && (
                  <div className={`absolute top-3 right-3 w-2 h-2 rounded-full ${colors.dot}`} />
                )}
              </button>
            )
          })}
        </div>
        {touched && !step1.use_case && (
          <p className="text-red-500 text-xs mt-1">용도를 선택해주세요.</p>
        )}
      </div>

      {/* 소싱 참고사항 */}
      <div className="space-y-2">
        <label htmlFor="sourcing_notes" className="block text-sm font-medium text-gray-700">
          소싱 참고사항
          <span className="ml-1.5 text-xs text-gray-400 font-normal">선택</span>
        </label>
        <p className="text-xs text-gray-500">사용 목적, 주의사항, 특별 요구사항 등 AI가 참고할 내용을 입력하세요.</p>
        <textarea
          id="sourcing_notes"
          rows={3}
          value={step1.sourcing_notes || ''}
          onChange={e => updateStep1({ sourcing_notes: e.target.value })}
          placeholder="예: 완제품 A의 원료로 사용 예정. 입자 크기 D90 < 50μm 필요. 연간 수요 약 500kg. 중국산 제외 희망."
          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 outline-none resize-none hover:border-gray-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
        />
      </div>

      <button
        type="submit"
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold py-3 rounded-xl transition-colors text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        다음 단계
        <ChevronRight size={16} />
      </button>
    </form>
  )
}
