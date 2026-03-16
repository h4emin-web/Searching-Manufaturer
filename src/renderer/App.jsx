import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import DataTable from './components/DataTable'
import AddRowModal from './components/AddRowModal'

// 고객사 → 담당 영업사원 매핑 (나중에 업데이트 가능)
export const CUSTOMER_SALESPERSON = {
  // 예시 - 실제 데이터로 교체 예정
  // '고객사명': '영업사원명',
}

export const CATEGORIES = ['원료 수입', '샘플 소싱']

export default function App() {
  const [activeTab, setActiveTab] = useState('원료 수입')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [search, setSearch] = useState('')

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('business_items')
      .select('*')
      .eq('category', activeTab)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('데이터 불러오기 오류:', error)
    } else {
      setRows(data || [])
    }
    setLoading(false)
  }, [activeTab])

  useEffect(() => {
    fetchRows()

    // 실시간 구독
    const channel = supabase
      .channel('business_items_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'business_items' },
        () => fetchRows()
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchRows])

  const filteredRows = rows.filter((row) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      row.item_name?.toLowerCase().includes(s) ||
      row.manufacturer?.toLowerCase().includes(s) ||
      row.distributor?.toLowerCase().includes(s) ||
      row.customer?.toLowerCase().includes(s) ||
      row.salesperson?.toLowerCase().includes(s) ||
      row.requester?.toLowerCase().includes(s) ||
      row.status?.toLowerCase().includes(s)
    )
  })

  const handleUpdate = async (id, field, value) => {
    const updateData = { [field]: value }

    // 고객사 변경 시 담당 영업사원 자동 업데이트
    if (field === 'customer') {
      const auto = CUSTOMER_SALESPERSON[value] || ''
      updateData.salesperson = auto
    }

    const { error } = await supabase
      .from('business_items')
      .update(updateData)
      .eq('id', id)

    if (error) {
      console.error('업데이트 오류:', error)
      alert('저장 실패: ' + error.message)
    } else {
      fetchRows()
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return
    const { error } = await supabase
      .from('business_items')
      .delete()
      .eq('id', id)

    if (error) {
      alert('삭제 실패: ' + error.message)
    } else {
      fetchRows()
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>업무 관리</h1>
        <div className="header-right">
          <input
            className="search-input"
            type="text"
            placeholder="검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      <div className="tabs">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`tab-btn ${activeTab === cat ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(cat)
              setSearch('')
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="table-container">
        {loading ? (
          <div className="loading">불러오는 중...</div>
        ) : (
          <DataTable
            rows={filteredRows}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        )}
      </div>

      <div className="footer">
        <button className="add-btn" onClick={() => setShowAddModal(true)}>
          + 새 항목 추가
        </button>
        <span className="count">{filteredRows.length}건</span>
      </div>

      {showAddModal && (
        <AddRowModal
          category={activeTab}
          onClose={() => setShowAddModal(false)}
          onSaved={fetchRows}
        />
      )}
    </div>
  )
}
