import React, { useState } from 'react'
import { CUSTOMER_SALESPERSON } from '../App'

const COLUMNS = [
  { key: 'item_name', label: '원료명', width: 150 },
  { key: 'manufacturer', label: '제조사', width: 130 },
  { key: 'distributor', label: '대리점', width: 120 },
  { key: 'customer', label: '고객사', width: 130 },
  { key: 'salesperson', label: '담당 영업사원', width: 110, readOnly: true },
  { key: 'requester', label: '요청자', width: 100 },
  { key: 'status', label: '진행현황', width: 200 },
  { key: 'note', label: '메모', width: 200 },
]

function EditableCell({ value, rowId, field, onUpdate, readOnly }) {
  const [editing, setEditing] = useState(false)
  const [tempVal, setTempVal] = useState(value || '')

  if (readOnly) {
    return <span className="cell-text readonly">{value || '-'}</span>
  }

  if (!editing) {
    return (
      <span
        className="cell-text editable"
        onClick={() => {
          setTempVal(value || '')
          setEditing(true)
        }}
        title="클릭하여 수정"
      >
        {value || <span className="empty">-</span>}
      </span>
    )
  }

  const handleBlur = () => {
    setEditing(false)
    if (tempVal !== (value || '')) {
      onUpdate(rowId, field, tempVal)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') e.target.blur()
    if (e.key === 'Escape') {
      setTempVal(value || '')
      setEditing(false)
    }
  }

  if (field === 'status' || field === 'note') {
    return (
      <textarea
        className="cell-input"
        value={tempVal}
        autoFocus
        onChange={(e) => setTempVal(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setTempVal(value || '')
            setEditing(false)
          }
        }}
        rows={2}
      />
    )
  }

  return (
    <input
      className="cell-input"
      type="text"
      value={tempVal}
      autoFocus
      onChange={(e) => setTempVal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  )
}

export default function DataTable({ rows, onUpdate, onDelete }) {
  if (rows.length === 0) {
    return (
      <div className="empty-state">
        데이터가 없습니다. 아래 + 버튼으로 추가하세요.
      </div>
    )
  }

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            {COLUMNS.map((col) => (
              <th key={col.key} style={{ minWidth: col.width }}>
                {col.label}
              </th>
            ))}
            <th style={{ width: 60 }}>삭제</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id} className={idx % 2 === 0 ? 'even' : 'odd'}>
              <td className="row-num">{idx + 1}</td>
              {COLUMNS.map((col) => (
                <td key={col.key}>
                  <EditableCell
                    value={row[col.key]}
                    rowId={row.id}
                    field={col.key}
                    onUpdate={onUpdate}
                    readOnly={col.readOnly}
                  />
                </td>
              ))}
              <td>
                <button
                  className="delete-btn"
                  onClick={() => onDelete(row.id)}
                  title="삭제"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
