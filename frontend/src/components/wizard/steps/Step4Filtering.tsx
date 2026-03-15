'use client'
import { useState } from 'react'
import { X, Plus, Globe, Mail, Building2, MapPin, CheckCircle2, ArrowRight } from 'lucide-react'
import { useWizardStore, Manufacturer } from '../../../store/wizardStore'

export default function Step4Filtering() {
  const { manufacturers, toggleExclude, addManualManufacturer, markStepComplete, goToStep } = useWizardStore()
  const [showAddForm, setShowAddForm] = useState(false)
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
      contact_wechat: newMfr.contact_wechat,
      contact_whatsapp: newMfr.contact_whatsapp,
      website: newMfr.website,
      web_form_url: newMfr.website,
      certifications: [],
      source_llms: [],
      confidence_score: 1.0,
      is_excluded: false,
      is_manually_added: true,
    })
    setNewMfr({ certifications: [], source_llms: [] })
    setShowAddForm(false)
  }

  return (
    <div className="space-y-6">
      {/* 통계 */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '전체 제조소', value: manufacturers.length, color: 'text-gray-900', bg: 'bg-gray-50' },
          { label: '선정됨', value: active.length, color: 'text-indigo-700', bg: 'bg-indigo-50' },
          { label: '제외됨', value: excluded.length, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(item => (
          <div key={item.label} className={`${item.bg} border border-gray-100 rounded-xl p-4 text-center`}>
            <div className={`text-3xl font-bold ${item.color}`}>{item.value}</div>
            <div className="text-xs text-gray-500 mt-1">{item.label}</div>
          </div>
        ))}
      </div>

      {/* 제조소 목록 */}
      <div className="space-y-2">
        {manufacturers.map(mfr => (
          <div
            key={mfr.id}
            className={`rounded-xl border p-4 flex items-start gap-4 transition-all ${
              mfr.is_excluded
                ? 'opacity-50 border-red-100 bg-red-50/30'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            {/* 아이콘 */}
            <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 size={15} className="text-gray-500" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-900 text-sm">{mfr.name}</span>
                {mfr.is_manually_added && (
                  <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">수동 추가</span>
                )}
                {mfr.source_llms.length > 1 && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {mfr.source_llms.length}개 AI 확인
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                <MapPin size={11} />
                {mfr.country}{mfr.city && `, ${mfr.city}`}
              </div>

              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {mfr.contact_email && (
                  <span className="text-xs text-indigo-600 flex items-center gap-1">
                    <Mail size={11} /> {mfr.contact_email}
                  </span>
                )}
                {mfr.website && (
                  <a href={mfr.website} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-gray-400 flex items-center gap-1 hover:text-gray-600">
                    <Globe size={11} /> 웹사이트
                  </a>
                )}
                {mfr.certifications.map(c => (
                  <span key={c} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">{c}</span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-gray-400 font-mono">
                {Math.round(mfr.confidence_score * 100)}%
              </span>
              <button
                onClick={() => toggleExclude(mfr.id)}
                title={mfr.is_excluded ? '제외 취소' : '제외'}
                className={`p-1.5 rounded-lg transition-colors text-xs font-medium ${
                  mfr.is_excluded
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : 'bg-red-50 text-red-500 hover:bg-red-100'
                }`}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 수동 추가 */}
      {showAddForm ? (
        <div className="border-2 border-dashed border-indigo-200 rounded-xl p-5 space-y-3 bg-indigo-50/30">
          <h3 className="font-semibold text-gray-900 text-sm">제조소 직접 추가</h3>
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
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddManual}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors">
              추가
            </button>
            <button onClick={() => setShowAddForm(false)}
              className="border border-gray-200 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              취소
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAddForm(true)}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-3.5 text-sm text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
          <Plus size={16} />
          제조소 직접 추가
        </button>
      )}

      <button
        onClick={() => { markStepComplete(4); goToStep(5) }}
        disabled={active.length === 0}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
      >
        <CheckCircle2 size={16} />
        {active.length}개 제조소로 자동 연락 진행
        <ArrowRight size={14} />
      </button>
    </div>
  )
}
