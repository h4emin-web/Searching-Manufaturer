'use client'
import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, Info, ExternalLink, AlertTriangle } from 'lucide-react'
import { useWizardStore, RegulatorySelection } from '../../../store/wizardStore'
import axios from 'axios'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

interface SubReq {
  id: string
  name_ko: string
  name_en: string
  description_ko: string
  level: 'mandatory' | 'recommended' | 'optional'
  is_selected: boolean
}

interface Requirement {
  id: string
  name_ko: string
  name_en: string
  description_ko: string
  description_en: string
  level: 'mandatory' | 'recommended' | 'optional'
  tooltip_ko: string
  reference_url: string
  is_selected: boolean
  sub_requirements: SubReq[]
}

const LEVEL_CONFIG = {
  mandatory:   { label: '필수 권장', color: 'bg-red-100 text-red-700 border-red-200' },
  recommended: { label: '권장',     color: 'bg-amber-100 text-amber-700 border-amber-200' },
  optional:    { label: '선택',     color: 'bg-blue-100 text-blue-700 border-blue-200' },
}

export default function Step2Regulatory() {
  const { step1, step2, updateStep2, markStepComplete, goToStep } = useWizardStore()
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!step1.use_case) return
    setLoading(true)
    axios.get(`${API_BASE}/regulatory/${step1.use_case}`)
      .then(res => {
        const reqs: Requirement[] = res.data.requirements
        if (step2.selections.length > 0) {
          setRequirements(reqs.map(req => ({
            ...req,
            is_selected: step2.selections.find(s => s.requirement_id === req.id)?.is_selected ?? req.is_selected,
          })))
        } else {
          setRequirements(reqs)
        }
      })
      .catch(() => setRequirements(MOCK_REQUIREMENTS))
      .finally(() => setLoading(false))
  }, [step1.use_case])

  const toggleRequirement = (id: string) => {
    setRequirements(prev => prev.map(r =>
      r.id === id ? { ...r, is_selected: !r.is_selected } : r
    ))
  }

  const handleNext = () => {
    const selections: RegulatorySelection[] = requirements.map(r => ({
      requirement_id: r.id,
      is_selected: r.is_selected,
      notes: '',
    }))
    updateStep2({ selections })
    markStepComplete(2)
    goToStep(3)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" aria-live="polite" aria-busy="true">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" aria-hidden="true" />
        <span className="ml-3 text-gray-500">규제 요건 로딩 중...</span>
      </div>
    )
  }

  // 의약품: 한 번에 하나씩 확인
  if (step1.use_case === 'pharmaceutical' && requirements.length > 0) {
    const currentReq = requirements[currentIndex]
    if (!currentReq) return null

    const advance = () => {
      if (currentIndex < requirements.length - 1) setCurrentIndex(i => i + 1)
      else handleNext()
    }

    return (
      <div className="max-w-2xl mx-auto">
        {/* 진행 표시 */}
        <div className="mb-8" aria-label={`규제 요건 ${currentIndex + 1} / ${requirements.length}`}>
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>요건 확인 중</span>
            <span aria-hidden="true">{currentIndex + 1} / {requirements.length}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2" role="progressbar" aria-valuenow={currentIndex + 1} aria-valuemax={requirements.length}>
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / requirements.length) * 100}%` }}
            />
          </div>
        </div>

        {/* 현재 요건 카드 */}
        <article className="bg-white border-2 border-blue-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${LEVEL_CONFIG[currentReq.level].color} mb-2`}>
                {LEVEL_CONFIG[currentReq.level].label}
              </span>
              <h2 className="text-xl font-bold text-gray-900">{currentReq.name_ko}</h2>
              <p className="text-sm text-gray-500 mt-1">{currentReq.name_en}</p>
            </div>
            {currentReq.level === 'mandatory' && (
              <AlertTriangle className="text-amber-500 mt-1 flex-shrink-0" size={22} aria-label="필수 권장 항목" />
            )}
          </div>

          <p className="text-gray-700 mb-4 leading-relaxed">{currentReq.description_ko}</p>

          {currentReq.tooltip_ko && (
            <div className="flex items-start gap-2 bg-blue-50 rounded-lg p-3 mb-4">
              <Info className="text-blue-500 flex-shrink-0 mt-0.5" size={16} aria-hidden="true" />
              <p className="text-sm text-blue-700">{currentReq.tooltip_ko}</p>
            </div>
          )}

          {currentReq.reference_url && (
            <a
              href={currentReq.reference_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            >
              <ExternalLink size={14} aria-hidden="true" />
              공식 문서 보기
              <span className="sr-only">(새 탭에서 열림)</span>
            </a>
          )}

          {/* 하위 요건 */}
          {currentReq.sub_requirements?.length > 0 && (
            <div className="border-t pt-4 mt-4">
              <p className="text-sm font-medium text-gray-600 mb-2">세부 요건</p>
              <ul className="space-y-2">
                {currentReq.sub_requirements.map(sub => (
                  <li key={sub.id} className="flex items-start gap-2 text-sm text-gray-600">
                    <Circle className="mt-0.5 flex-shrink-0 text-gray-400" size={14} aria-hidden="true" />
                    <span>{sub.name_ko}: {sub.description_ko}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 선택/불필요 버튼 — 모든 요건 토글 가능 */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={() => {
                if (!currentReq.is_selected) toggleRequirement(currentReq.id)
                advance()
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                currentReq.is_selected
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-blue-50 text-blue-700 border border-blue-300 hover:bg-blue-100'
              }`}
            >
              <CheckCircle2 size={18} aria-hidden="true" />
              {currentReq.is_selected ? '선택됨 · 다음' : '요청할 예정'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (currentReq.is_selected) toggleRequirement(currentReq.id)
                advance()
              }}
              className="flex-1 py-3 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
            >
              {currentReq.level === 'mandatory' ? '이 요건 제외 (선택)' : '이 요건 불필요'}
            </button>
          </div>
        </article>

        {/* 하단 요건 맵 */}
        <nav className="mt-6 grid grid-cols-4 gap-2" aria-label="요건 목록 바로가기">
          {requirements.map((req, i) => (
            <button
              key={req.id}
              type="button"
              onClick={() => setCurrentIndex(i)}
              aria-label={`${req.name_ko} - ${i < currentIndex ? '완료' : i === currentIndex ? '현재' : '대기'}`}
              aria-current={i === currentIndex ? 'step' : undefined}
              className={`p-2 rounded-lg text-xs text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                i === currentIndex
                  ? 'bg-blue-100 border-2 border-blue-500 font-semibold'
                  : i < currentIndex
                  ? 'bg-green-50 border border-green-300 text-green-700'
                  : 'bg-gray-50 border border-gray-200 text-gray-400'
              }`}
            >
              {req.id}
            </button>
          ))}
        </nav>

        {/* 선택 요약 및 이전/다음 */}
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <span>
            {requirements.filter(r => r.is_selected).length} / {requirements.length}개 선택됨
          </span>
          {currentIndex === requirements.length - 1 && (
            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              완료 · 다음 단계 →
            </button>
          )}
        </div>
      </div>
    )
  }

  // 화장품/식품: 체크리스트
  return (
    <div className="max-w-2xl mx-auto space-y-3">
      <p className="text-sm text-gray-500 mb-4">
        {step1.use_case === 'cosmetic' ? '화장품' : '식품'}용 규제 요건을 선택해주세요. 모든 항목은 선택 사항입니다.
      </p>

      <ul className="space-y-2" role="list">
        {requirements.map(req => (
          <li key={req.id}>
            <button
              type="button"
              role="checkbox"
              aria-checked={req.is_selected}
              onClick={() => toggleRequirement(req.id)}
              className={`w-full flex items-center gap-3 border rounded-xl p-4 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                req.is_selected
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              {req.is_selected
                ? <CheckCircle2 className="text-blue-600 flex-shrink-0" size={20} aria-hidden="true" />
                : <Circle className="text-gray-400 flex-shrink-0" size={20} aria-hidden="true" />
              }
              <div>
                <div className="font-medium text-gray-900">{req.name_ko}</div>
                <div className="text-sm text-gray-500">{req.description_ko}</div>
              </div>
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={handleNext}
        className="w-full mt-4 bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 active:bg-blue-800 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        다음 단계: 제조소 검색
      </button>
    </div>
  )
}

// ─── 목 데이터 ──────────────────────────────────
const MOCK_REQUIREMENTS: Requirement[] = [
  {
    id: 'WHO-GMP', name_ko: 'WHO-GMP 인증', name_en: 'WHO Good Manufacturing Practice',
    description_ko: '세계보건기구 우수의약품 제조관리기준',
    description_en: 'WHO GMP Certificate',
    level: 'mandatory',
    tooltip_ko: 'WHO-GMP 없는 제조소는 KDMF 등록이 불가합니다.',
    reference_url: 'https://www.who.int',
    is_selected: true,
    sub_requirements: [
      { id: 'WHO-GMP-AUDIT', name_ko: 'GMP 실사 보고서', name_en: 'Inspection Report', description_ko: '최근 3년 이내', level: 'recommended', is_selected: false },
    ],
  },
  {
    id: 'KDMF', name_ko: '한국 원료의약품 등록 (KDMF)', name_en: 'Korea Drug Master File',
    description_ko: '식약처 원료의약품 등록 파일',
    description_en: 'Korea MFDS Drug Master File',
    level: 'mandatory',
    tooltip_ko: 'KDMF 미등록 원료는 완제의약품 품목허가 갱신 불가.',
    reference_url: 'https://www.mfds.go.kr',
    is_selected: true,
    sub_requirements: [
      { id: 'KDMF-LOA', name_ko: '접근 허가서 (LOA)', name_en: 'Letter of Access', description_ko: 'KDMF 등록 후 접근권한 부여 문서', level: 'mandatory', is_selected: true },
    ],
  },
  {
    id: 'COPP', name_ko: '원산지 적합 증명서 (CoPP)', name_en: 'Certificate of Pharmaceutical Product',
    description_ko: 'WHO 기준 의약품 원산지 증명서',
    description_en: 'WHO-format CoPP',
    level: 'mandatory',
    tooltip_ko: '한국 식약처 수입 허가 신청 시 제출 서류.',
    reference_url: '',
    is_selected: true,
    sub_requirements: [],
  },
  {
    id: 'WC', name_ko: '서면확인서 (WC)', name_en: 'Written Confirmation',
    description_ko: 'EU GMP 적합 여부 서면 확인서',
    description_en: 'EU GMP Written Confirmation',
    level: 'recommended',
    tooltip_ko: 'EU 수출 예정이라면 권장됩니다.',
    reference_url: '',
    is_selected: false,
    sub_requirements: [],
  },
]
