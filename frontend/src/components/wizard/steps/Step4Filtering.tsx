'use client'
import { useState } from 'react'
import { X, Plus, Globe, Mail, MessageCircle, Phone } from 'lucide-react'
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 요약 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '전체', value: manufacturers.length, color: 'text-gray-900' },
          { label: '선정됨', value: active.length, color: 'text-blue-700' },
          { label: '제외됨', value: excluded.length, color: 'text-red-600' },
        ].map(item => (
          <div key={item.label} className="bg-white border rounded-xl p-4 text-center">
            <div className={`text-3xl font-bold ${item.color}`}>{item.value}</div>
            <div className="text-sm text-gray-500">{item.label}</div>
          </div>
        ))}
      </div>

      {/* 제조소 목록 */}
      <div className="space-y-2">
        {manufacturers.map(mfr => (
          <div
            key={mfr.id}
            className={`bg-white border rounded-xl p-4 flex items-start gap-4 transition-opacity ${
              mfr.is_excluded ? 'opacity-50 border-red-200' : 'border-gray-200'
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-900 truncate">{mfr.name}</span>
                {mfr.is_manually_added && (
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">수동 추가</span>
                )}
                {mfr.source_llms.length > 1 && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {mfr.source_llms.length}개 모델 확인
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-500 mt-0.5">{mfr.country} {mfr.city && `· ${mfr.city}`}</div>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {mfr.contact_wechat && <span className="text-xs text-green-600 flex items-center gap-1"><MessageCircle size={12} /> WeChat</span>}
                {mfr.contact_whatsapp && <span className="text-xs text-green-600 flex items-center gap-1"><Phone size={12} /> WhatsApp</span>}
                {mfr.contact_email && <span className="text-xs text-blue-600 flex items-center gap-1"><Mail size={12} /> Email</span>}
                {mfr.website && <span className="text-xs text-gray-500 flex items-center gap-1"><Globe size={12} /> 웹사이트</span>}
                {mfr.certifications.map(c => (
                  <span key={c} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{c}</span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-gray-400">{Math.round(mfr.confidence_score * 100)}%</div>
              <button
                onClick={() => toggleExclude(mfr.id)}
                className={`p-1.5 rounded-lg transition-colors ${
                  mfr.is_excluded
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-red-50 text-red-600 hover:bg-red-100'
                }`}
                title={mfr.is_excluded ? '제외 취소' : '제외'}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 수동 추가 폼 */}
      {showAddForm ? (
        <div className="bg-white border-2 border-dashed border-blue-300 rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-gray-900">제조소 직접 추가</h3>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="제조소명 *" value={newMfr.name || ''} onChange={e => setNewMfr(p => ({ ...p, name: e.target.value }))}
              className="border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-400 outline-none" />
            <input placeholder="국가 *" value={newMfr.country || ''} onChange={e => setNewMfr(p => ({ ...p, country: e.target.value }))}
              className="border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-400 outline-none" />
            <input placeholder="이메일" value={newMfr.contact_email || ''} onChange={e => setNewMfr(p => ({ ...p, contact_email: e.target.value }))}
              className="border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-400 outline-none" />
            <input placeholder="WeChat ID" value={newMfr.contact_wechat || ''} onChange={e => setNewMfr(p => ({ ...p, contact_wechat: e.target.value }))}
              className="border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-400 outline-none" />
            <input placeholder="WhatsApp (+82...)" value={newMfr.contact_whatsapp || ''} onChange={e => setNewMfr(p => ({ ...p, contact_whatsapp: e.target.value }))}
              className="border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-400 outline-none" />
            <input placeholder="웹사이트 URL" value={newMfr.website || ''} onChange={e => setNewMfr(p => ({ ...p, website: e.target.value }))}
              className="border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-400 outline-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddManual} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">추가</button>
            <button onClick={() => setShowAddForm(false)} className="border px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">취소</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAddForm(true)}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-4 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
          <Plus size={18} />
          제조소 직접 추가
        </button>
      )}

      <button
        onClick={() => { markStepComplete(4); goToStep(5) }}
        disabled={active.length === 0}
        className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 font-semibold"
      >
        {active.length}개 제조소로 자동 연락 진행
      </button>
    </div>
  )
}
