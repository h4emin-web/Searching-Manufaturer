'use client'
import { useState } from 'react'
import { Mail, Globe, ChevronDown, ChevronUp, Send, ArrowRight } from 'lucide-react'
import { useWizardStore } from '../../../store/wizardStore'

export default function Step5Communication() {
  const { step1, manufacturers, step5, updateStep5, markStepComplete, goToStep } = useWizardStore()
  const active = manufacturers.filter(m => !m.is_excluded)
  const [showPreview, setShowPreview] = useState(false)

  const withEmail = active.filter(m => m.contact_email).length
  const withWebForm = active.filter(m => m.web_form_url).length

  const messageEn = `Dear Supplier,

We are currently sourcing ${step1.ingredient_name || '[ingredient]'} for pharmaceutical use and would like to evaluate your company as a potential supplier.

Requirements:
• WHO-GMP Certification
• Ability to register Korea DMF (KDMF)
• Certificate of Pharmaceutical Product (CoPP)

Please provide product specifications, pricing (CIF Sea basis to Busan Port, South Korea), and relevant certificates.

Best regards,
Procurement Team`

  const messageZh = `尊敬的供应商，

您好！我司正在寻找 ${step1.ingredient_name || '[原料]'} 的优质原料药供应商。

要求：
• WHO-GMP 认证
• 韩国 KDMF 注册能力
• CoPP 证书

请提供产品报价（CIF 海运至韩国釜山港）及相关认证文件。

期待您的回复！`

  const startOutreach = async () => {
    updateStep5({ outreach_status: 'running' })
    markStepComplete(5)
    goToStep(6)
  }

  return (
    <div className="space-y-6">
      {/* 채널 현황 */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: Mail, label: '이메일', count: withEmail, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
          { icon: Globe, label: '웹 문의', count: withWebForm, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-100' },
        ].map(ch => (
          <div key={ch.label} className={`${ch.bg} border ${ch.border} rounded-xl p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <ch.icon size={15} className={ch.color} />
              <span className="text-sm font-medium text-gray-700">{ch.label}</span>
            </div>
            <div className={`text-2xl font-bold ${ch.color}`}>{ch.count}</div>
            <div className="text-xs text-gray-500 mt-0.5">제조소</div>
          </div>
        ))}
      </div>

      {/* 안내 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="text-sm text-blue-800 leading-relaxed">
          이메일이 있는 제조소는 <strong>이메일 우선</strong> 발송, 없는 경우 <strong>웹 문의 폼</strong>으로 자동 연락합니다.
          답변 수신 시 AI가 자동으로 후속 답변을 생성하여 발송합니다.
        </p>
      </div>

      {/* 크롤링 옵션 */}
      <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-gray-50 transition-colors">
        <input
          type="checkbox"
          checked={step5.auto_crawl}
          onChange={e => updateStep5({ auto_crawl: e.target.checked })}
          className="w-4 h-4 text-indigo-600 rounded accent-indigo-600"
        />
        <div>
          <div className="text-sm font-medium text-gray-700">발송 전 웹사이트 자동 크롤링</div>
          <div className="text-xs text-gray-500">이메일 주소가 없는 제조소의 연락처를 자동으로 수집합니다.</div>
        </div>
      </label>

      {/* 메시지 미리보기 */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="w-full flex items-center justify-between p-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span>메시지 미리보기</span>
          {showPreview ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        {showPreview && (
          <div className="grid grid-cols-2 border-t border-gray-100">
            <div className="p-4 border-r border-gray-100">
              <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                🇬🇧 영어
              </div>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">{messageEn}</pre>
            </div>
            <div className="p-4">
              <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                🇨🇳 중국어
              </div>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">{messageZh}</pre>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={startOutreach}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
      >
        <Send size={15} />
        {active.length}개 제조소에 자동 연락 시작
        <ArrowRight size={14} />
      </button>
    </div>
  )
}
