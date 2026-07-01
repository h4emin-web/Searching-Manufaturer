import React, { useState, useCallback, useMemo, useRef } from 'react'
import * as XLSX from 'xlsx'

const CAT_COLOR = {
  '샘플':       '#e8f5e9',
  '발주/수주':  '#fff9c4',
  '입출고':     '#fce4ec',
  '입고':       '#fce4ec',
  '출고':       '#fce4ec',
  '견적/단가':  '#f3e5f5',
  '선적/통관':  '#e3f2fd',
  '안정성시험': '#fff3e0',
  '실사/감사':  '#f9f9f9',
  '반품/환불':  '#ffebee',
  '계약':       '#e0f7fa',
  '서류/자료':  '#f1f8e9',
  '방문/미팅':  '#ede7f6',
  'DMF/허가':   '#e8eaf6',
  '문의/확인':  '#fff8e1',
  '내부업무':   '#f5f5f5',
  '기타':       '#fafafa',
}
const CAT_DOT = {
  '샘플':       '#4caf50',
  '발주/수주':  '#f9a825',
  '입출고':     '#e91e63',
  '입고':       '#e91e63',
  '출고':       '#e91e63',
  '견적/단가':  '#9c27b0',
  '선적/통관':  '#2196f3',
  '안정성시험': '#ff9800',
  '실사/감사':  '#607d8b',
  '반품/환불':  '#f44336',
  '계약':       '#00bcd4',
  '서류/자료':  '#8bc34a',
  '방문/미팅':  '#673ab7',
  'DMF/허가':   '#3f51b5',
  '문의/확인':  '#ffc107',
  '내부업무':   '#9e9e9e',
  '기타':       '#bdbdbd',
}

function summarize(content) {
  if (!content) return ''
  let s = content.replace(/^\[.*?\]\s*/g, '').trim()
  const arrowMatch = s.match(/[→]\s*(.+)/)
  if (arrowMatch) s = arrowMatch[1].trim()
  s = s.split('\n')[0].trim()
  return s.length > 90 ? s.slice(0, 90) + '…' : s
}

function classify(content) {
  const c = content
  if (c.includes('샘플') && (c.includes('처리') || c.includes('전달') || c.includes('요청'))) return '샘플'
  if (c.includes('발주') || c.includes('PO') || c.includes('오더')) return '발주/수주'
  if (c.includes('입고') && c.includes('출고')) return '입출고'
  if (c.includes('입고')) return '입고'
  if (c.includes('출고')) return '출고'
  if (c.includes('견적') || c.includes('단가') || c.includes('가격')) return '견적/단가'
  if (c.includes('선적') || c.includes('통관') || c.includes('수입')) return '선적/통관'
  if (c.includes('안정성') || c.toLowerCase().includes('stability')) return '안정성시험'
  if (c.includes('실사') || c.includes('감사')) return '실사/감사'
  if (c.includes('반품') || c.includes('환불')) return '반품/환불'
  if (c.includes('계약') || c.includes('CDA')) return '계약'
  if (c.includes('서류') || c.includes('자료') || c.includes('CoA')) return '서류/자료'
  if (c.includes('방문') || c.includes('미팅')) return '방문/미팅'
  if (c.includes('DMF') || c.includes('등록') || c.includes('KGMP')) return 'DMF/허가'
  if (c.includes('문의') || c.includes('확인')) return '문의/확인'
  return '기타'
}

function parseWorkbook(wb) {
  const result = []
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const employee = sheetName.replace(/^\d+/, '').trim()
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    for (let i = 2; i < rows.length; i++) {
      const row = rows[i]
      const company  = String(row[0] || '').trim()
      const material = String(row[2] || '').trim()
      const content  = String(row[3] || '').trim()
      const contact  = String(row[4] || '').trim()
      if (!material || !content) continue

      result.push({
        employee,
        company,
        material: material.split('\n')[0].trim(),
        content,
        contact,
        category: classify(content),
        summary: summarize(content),
      })
    }
  }
  return result
}

// ─── WorkItem ────────────────────────────────────────────
function WorkItem({ item }) {
  const [open, setOpen] = useState(false)
  const bg  = CAT_COLOR[item.category] || '#fafafa'
  const dot = CAT_DOT[item.category]   || '#bbb'

  return (
    <div className="work-item" style={{ background: bg }}>
      <div className="work-item-header" onClick={() => setOpen(o => !o)}>
        <span className="cat-dot" style={{ background: dot }} />
        <span className="work-cat">{item.category}</span>
        <span className="work-material">{item.material}</span>
        <span className="work-company">{item.company}</span>
        <span className="work-summary">{item.summary || item.content.slice(0, 90)}</span>
        <span className="work-expand">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="work-item-detail">
          {item.company && (
            <div className="detail-row">
              <span className="detail-label">거래처</span>
              <span>{item.company}</span>
            </div>
          )}
          <div className="detail-row">
            <span className="detail-label">원료명</span>
            <span>{item.material}</span>
          </div>
          {item.contact && (
            <div className="detail-row">
              <span className="detail-label">담당자</span>
              <span>{item.contact}</span>
            </div>
          )}
          <div className="detail-row detail-content">
            <span className="detail-label">상세내용</span>
            <pre className="detail-text">{item.content}</pre>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── EmployeeCard ─────────────────────────────────────────
function EmployeeCard({ employee, items, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  const cats = [...new Set(items.map(i => i.category))]

  return (
    <div className="emp-card">
      <div className="emp-card-header" onClick={() => setOpen(o => !o)}>
        <div className="emp-name-area">
          <span className="emp-avatar">{employee[0]}</span>
          <span className="emp-name">{employee}</span>
          <span className="emp-count">{items.length}건</span>
        </div>
        <div className="emp-cats">
          {cats.map(c => (
            <span key={c} className="emp-cat-badge"
              style={{ background: CAT_COLOR[c], borderColor: CAT_DOT[c] }}>
              {c}
            </span>
          ))}
        </div>
        <span className="emp-chevron">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="emp-card-body">
          {items.map((item, idx) => <WorkItem key={idx} item={item} />)}
        </div>
      )}
    </div>
  )
}

// ─── DailyLog (main) ──────────────────────────────────────
export default function DailyLog() {
  const fileInputRef = useRef(null)
  const [fileName, setFileName] = useState('')
  const [loading, setLoading]   = useState(false)
  const [data, setData]         = useState([])
  const [error, setError]       = useState('')
  const [search, setSearch]     = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [viewMode, setViewMode] = useState('사원별')
  const [dragOver, setDragOver] = useState(false)

  const processFile = useCallback((file) => {
    if (!file) return
    setLoading(true)
    setError('')
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      // setLoading(true)이 렌더링된 후 무거운 처리 시작 → Not Responding 방지
      setTimeout(() => {
        try {
          const data = new Uint8Array(e.target.result)
          const wb = XLSX.read(data, { type: 'array' })
          const parsed = parseWorkbook(wb)
          setData(parsed)
          localStorage.setItem('lastExcelName', file.name)
        } catch (ex) {
          setError('파일 읽기 오류: ' + ex.message)
        }
        setLoading(false)
      }, 0)
    }
    reader.onerror = () => { setError('파일을 읽을 수 없습니다'); setLoading(false) }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleFileChange = (e) => {
    processFile(e.target.files[0])
    e.target.value = '' // reset so same file can be re-selected
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      processFile(file)
    } else {
      setError('xlsx 또는 xls 파일만 지원합니다')
    }
  }, [processFile])

  // 필터
  const filtered = useMemo(() => {
    return data.filter(item => {
      const s = search.toLowerCase()
      const matchSearch = !s || (
        item.employee.includes(s) ||
        item.material.toLowerCase().includes(s) ||
        item.company.includes(s) ||
        item.content.toLowerCase().includes(s)
      )
      return matchSearch && (!filterCat || item.category === filterCat)
    })
  }, [data, search, filterCat])

  const byEmployee = useMemo(() => {
    const map = {}
    filtered.forEach(item => {
      if (!map[item.employee]) map[item.employee] = []
      map[item.employee].push(item)
    })
    return Object.entries(map)
  }, [filtered])

  const byMaterial = useMemo(() => {
    const map = {}
    filtered.forEach(item => {
      if (!map[item.material]) map[item.material] = []
      map[item.material].push(item)
    })
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length)
  }, [filtered])

  const allCats = useMemo(() => [...new Set(data.map(d => d.category))].sort(), [data])
  const totalEmp = new Set(data.map(d => d.employee)).size

  return (
    <div className="daily-log">
      {/* 툴바 */}
      <div className="log-toolbar">
        <div className="log-toolbar-left">
          <button className="log-btn primary" onClick={() => fileInputRef.current?.click()}>
            📂 엑셀 불러오기
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          {fileName && <span className="log-filename">{fileName}</span>}
        </div>
        <div className="log-toolbar-right">
          {data.length > 0 && (
            <>
              <span className="log-stat">{totalEmp}명 · {data.length}건</span>
              <select className="log-select" value={filterCat}
                onChange={e => setFilterCat(e.target.value)}>
                <option value="">전체 업무</option>
                {allCats.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="log-view-toggle">
                {['사원별', '원료별'].map(m => (
                  <button key={m}
                    className={`view-toggle-btn ${viewMode === m ? 'active' : ''}`}
                    onClick={() => setViewMode(m)}>{m}</button>
                ))}
              </div>
              <input className="log-search" type="text"
                placeholder="사원·원료·거래처 검색..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </>
          )}
        </div>
      </div>

      {/* 드래그앤드롭 + 본문 */}
      <div
        className={`log-body ${dragOver ? 'drag-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {!data.length && !loading && (
          <div className="log-empty">
            <div className="log-empty-icon">📋</div>
            <p>업무일지 엑셀 파일을 불러오세요</p>
            <p className="log-empty-sub">버튼 클릭 또는 파일을 여기에 드래그 앤 드롭</p>
            <button className="log-btn primary large"
              onClick={() => fileInputRef.current?.click()}>
              엑셀 파일 선택
            </button>
          </div>
        )}

        {loading && (
          <div className="log-empty">
            <div className="log-spinner" />
            <p>파일 분석 중...</p>
          </div>
        )}

        {error && <div className="log-error">{error}</div>}

        {!loading && data.length > 0 && viewMode === '사원별' && (
          <div className="log-list">
            {byEmployee.map(([emp, items]) => (
              <EmployeeCard key={emp} employee={emp} items={items}
                defaultOpen={byEmployee.length <= 5} />
            ))}
            {!byEmployee.length && (
              <div className="log-empty"><p>검색 결과가 없습니다</p></div>
            )}
          </div>
        )}

        {!loading && data.length > 0 && viewMode === '원료별' && (
          <div className="log-list">
            {byMaterial.map(([mat, items]) => {
              const emps = [...new Set(items.map(i => i.employee))]
              return (
                <div key={mat} className="mat-group">
                  <div className="mat-group-header">
                    <span className="mat-name">{mat}</span>
                    <span className="mat-emps">{emps.join(', ')}</span>
                    <span className="mat-count">{items.length}건</span>
                  </div>
                  <div className="mat-group-body">
                    {items.map((item, idx) => <WorkItem key={idx} item={item} />)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
