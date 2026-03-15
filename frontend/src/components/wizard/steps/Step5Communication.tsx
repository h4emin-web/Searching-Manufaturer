'use client'
import { useState } from 'react'
import { MessageCircle, Phone, Mail, Globe, ChevronDown, ChevronUp } from 'lucide-react'
import { useWizardStore } from '../../../store/wizardStore'

const CHANNEL_INFO = {
  wechat:    { icon: MessageCircle, label: 'WeChat',    color: 'text-green-600',  bg: 'bg-green-50',  priority: 1 },
  whatsapp:  { icon: Phone,         label: 'WhatsApp',  color: 'text-emerald-600', bg: 'bg-emerald-50', priority: 2 },
  email:     { icon: Mail,          label: 'Email',     color: 'text-blue-600',   bg: 'bg-blue-50',   priority: 3 },
  web_form:  { icon: Globe,         label: 'Web Form',  color: 'text-gray-600',   bg: 'bg-gray-50',   priority: 4 },
}

export default function Step5Communication() {
  const { step1, manufacturers, step5, updateStep5, markStepComplete, goToStep } = useWizardStore()
  const active = manufacturers.filter(m => !m.is_excluded)
  const [showPreview, setShowPreview] = useState(false)

  const channelStats = Object.entries(CHANNEL_INFO).map(([key, info]) => {
    const ch = key as keyof typeof CHANNEL_INFO
    const field = ch === 'wechat' ? 'contact_wechat' : ch === 'whatsapp' ? 'contact_whatsapp' : ch === 'email' ? 'contact_email' : 'web_form_url'
    const count = active.filter(m => m[field as keyof typeof m]).length
    return { key: ch, ...info, count }
  })

  const messageZh = `尊敬的供应商，

您好！我司正在寻找 ${step1.ingredient_name} 的优质原料药供应商。

我们要求供应商具备以下资质：
• WHO-GMP 认证
• 韩国 KDMF 注册能力
• CoPP 证书

请问贵公司是否能提供以上原料？如有意向，请提供产品报价及相关认证文件。

期待您的回复！`

  const messageEn = `Dear Supplier,

We are currently sourcing ${step1.ingredient_name} for pharmaceutical use and would like to evaluate your company as a potential supplier.

Requirements:
• WHO-GMP Certification
• Ability to register Korea DMF (KDMF)
• Certificate of Pharmaceutical Product (CoPP)

Please provide product specifications, pricing, and relevant certificates.

Best regards`

  const startOutreach = async () => {
    updateStep5({ outreach_status: 'running' })
    markStepComplete(5)
    goToStep(6)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 채널별 현황 */}
      <div className="grid grid-cols-4 gap-3">
        {channelStats.map(ch => {
          const Icon = ch.icon
          return (
            <div key={ch.key} className={`${ch.bg} border rounded-xl p-4 text-center`}>
              <Icon className={`mx-auto mb-2 ${ch.color}`} size={20} />
              <div className={`text-2xl font-bold ${ch.color}`}>{ch.count}</div>
              <div className="text-xs text-gray-500">{ch.label}</div>
              <div className="text-xs text-gray-400 mt-1">우선순위 {ch.priority}</div>
            </div>
          )
        })}
      </div>

      {/* 우선순위 설명 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800">
          <strong>자동 우선순위:</strong> 각 제조소에 대해 WeChat → WhatsApp → Email → Web Form 순으로
          가장 높은 우선순위 채널로 먼저 연락합니다. {' '}
          <strong>{48}시간</strong> 내 응답이 없으면 다음 채널로 자동 폴백합니다.
        </p>
      </div>

      {/* 메시지 미리보기 */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="w-full flex items-center justify-between p-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <span>메시지 미리보기 (중국어/영어)</span>
          {showPreview ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showPreview && (
          <div className="grid grid-cols-2 gap-0 border-t">
            <div className="p-4 border-r">
              <div className="text-xs font-medium text-gray-500 mb-2">🇨🇳 중국어 (WeChat용)</div>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{messageZh}</pre>
            </div>
            <div className="p-4">
              <div className="text-xs font-medium text-gray-500 mb-2">🇬🇧 영어 (Email/WhatsApp용)</div>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{messageEn}</pre>
            </div>
          </div>
        )}
      </div>

      {/* 크롤링 옵션 */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={step5.auto_crawl}
          onChange={e => updateStep5({ auto_crawl: e.target.checked })}
          className="w-4 h-4 text-blue-600 rounded"
        />
        <span className="text-sm text-gray-700">
          발송 전 웹사이트 자동 크롤링으로 연락처 보강 (Playwright)
        </span>
      </label>

      <button
        onClick={startOutreach}
        className="w-full bg-blue-600 text-white py-4 rounded-xl hover:bg-blue-700 font-semibold text-lg"
      >
        {active.length}개 제조소에 자동 연락 시작
      </button>
    </div>
  )
}
