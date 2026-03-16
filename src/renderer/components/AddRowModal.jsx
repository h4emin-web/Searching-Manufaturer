import React, { useState } from 'react'
import { supabase } from '../supabase'
import { CUSTOMER_SALESPERSON } from '../App'

export default function AddRowModal({ category, onClose, onSaved }) {
  const [form, setForm] = useState({
    item_name: '',
    manufacturer: '',
    distributor: '',
    customer: '',
    salesperson: '',
    requester: '',
    status: '',
    note: '',
  })
  const [saving, setSaving] = useState(false)

  const handleChange = (field, value) => {
    const updated = { ...form, [field]: value }
    if (field === 'customer') {
      updated.salesperson = CUSTOMER_SALESPERSON[value] || ''
    }
    setForm(updated)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.item_name.trim()) {
      alert('원료명을 입력해주세요.')
      return
    }
    setSaving(true)

    const { error } = await supabase.from('business_items').insert([
      {
        ...form,
        category,
      },
    ])

    setSaving(false)
    if (error) {
      alert('저장 실패: ' + error.message)
    } else {
      onSaved()
      onClose()
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>새 항목 추가 ({category})</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <label>
            원료명 <span className="required">*</span>
            <input
              type="text"
              value={form.item_name}
              onChange={(e) => handleChange('item_name', e.target.value)}
              placeholder="원료명 입력"
              autoFocus
            />
          </label>
          <label>
            제조사
            <input
              type="text"
              value={form.manufacturer}
              onChange={(e) => handleChange('manufacturer', e.target.value)}
              placeholder="제조사 입력"
            />
          </label>
          <label>
            대리점
            <input
              type="text"
              value={form.distributor}
              onChange={(e) => handleChange('distributor', e.target.value)}
              placeholder="대리점 입력 (없으면 비워두세요)"
            />
          </label>
          <label>
            고객사
            <input
              type="text"
              value={form.customer}
              onChange={(e) => handleChange('customer', e.target.value)}
              placeholder="고객사 입력"
            />
          </label>
          <label>
            담당 영업사원
            <input
              type="text"
              value={form.salesperson}
              readOnly
              className="readonly-input"
              placeholder="고객사 입력 시 자동 표시"
            />
          </label>
          <label>
            요청자
            <input
              type="text"
              value={form.requester}
              onChange={(e) => handleChange('requester', e.target.value)}
              placeholder="실제 요청한 사람"
            />
          </label>
          <label>
            진행현황
            <textarea
              value={form.status}
              onChange={(e) => handleChange('status', e.target.value)}
              placeholder="현재 진행 상황 입력"
              rows={3}
            />
          </label>
          <label>
            메모
            <textarea
              value={form.note}
              onChange={(e) => handleChange('note', e.target.value)}
              placeholder="기타 메모"
              rows={2}
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn-save" disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
