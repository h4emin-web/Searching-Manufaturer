import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import DataTable from './components/DataTable'
import AddRowModal from './components/AddRowModal'
import DailyLog from './components/DailyLog'
import EnglishTutor from './components/EnglishTutor'

export const CUSTOMER_SALESPERSON = {}
export const CATEGORIES = ['원료 수입', '샘플 테스팅']

const ALL_TABS = [...CATEGORIES, '업무일지', 'AI 전화영어']

const SITE_NAV_ITEMS = ['회사소개', '제품소개', '연구개발', '투자정보', '파트너', '인재채용', '지속가능경영']
const LANGUAGES = ['한국어', 'English', '中文(简)', '中文(繁)']

const NAV_MENU_GROUPS = [
  {
    title: '회사소개',
    columns: [{ heading: '회사소개', items: ['회사 현황', '경영진 인사말', '연혁', '조직도', '오시는 길'] }],
  },
  {
    title: '제품소개',
    columns: [{ heading: '제품소개', items: ['KDMF APIs', 'Excipients(품목신고)', '식품 원료', '화장품 원료', '도매원료'] }],
  },
  {
    title: '연구개발',
    columns: [{ heading: '연구개발', items: ['연구소 비전', '주요 연구성과', '특허 상황'] }],
  },
  {
    title: '투자정보',
    columns: [{ heading: '투자정보', items: ['실적 리포트', '비전&미션'] }],
  },
  {
    title: '파트너',
    columns: [{ heading: '파트너', items: ['국내 파트너사', '해외 파트너사', '관련 사이트'] }],
  },
  {
    title: '인재채용',
    columns: [{ heading: '인재채용', items: ['인재상', '채용공고', '채용절차', '직무소개', '복리후생'] }],
  },
  {
    title: '지속가능경영',
    columns: [{ heading: '지속가능경영', items: ['개인정보처리방침', '윤리경영', '협력사 지원'] }],
  },
]

const FULL_MENU_COLUMNS = [
  {
    title: '회사소개',
    items: ['회사 현황', '경영진 인사말', '연혁', '조직도', '오시는 길'],
  },
  {
    title: '제품소개',
    items: ['KDMF APIs', 'Excipients(품목신고)', '식품 원료', '화장품 원료', '도매원료'],
  },
  {
    title: '연구개발',
    items: ['연구소 비전', '주요 연구성과', '특허 상황'],
  },
  {
    title: '투자정보',
    items: ['실적 리포트', '비전&미션'],
  },
  {
    title: '파트너',
    items: ['국내 파트너사', '해외 파트너사', '관련 사이트'],
  },
  {
    title: '인재채용',
    items: ['인재상', '채용공고', '채용절차', '직무소개', '복리후생'],
  },
  {
    title: '지속가능경영',
    items: ['개인정보처리방침', '윤리경영', '협력사 지원'],
  },
]

const PRODUCT_GROUPS = [
  {
    eyebrow: 'DMF / Excipients',
    title: '원료의약품',
    description: 'KDMF APIs, 부형제, 중간체를 중심으로 제조사와 고객사의 요구 조건을 빠르게 연결합니다.',
    tone: 'blue',
    actions: [
      { label: 'KDMF APIs', tab: '원료 수입' },
      { label: 'Excipients', tab: '원료 수입' },
      { label: '도매원료', tab: '원료 수입' },
    ],
  },
  {
    eyebrow: 'Food / Cosmetic',
    title: '식품 · 화장품 원료',
    description: '건강기능식품, 식품 첨가물, 화장품 원료까지 카테고리별 제품 검토를 한 화면에서 시작합니다.',
    tone: 'green',
    actions: [
      { label: '식품 원료', tab: '샘플 테스팅' },
      { label: '화장품 원료', tab: '샘플 테스팅' },
    ],
  },
]

const HERO_MESSAGE_LINES = ['더 건강한 미래를 만듭니다', '고객 감동을 실현하는', '에이스바이오팜']

const FOOTER_NAV_GROUPS = [
  {
    title: '회사소개',
    items: ['회사 현황', '경영진 인사말', '연혁', '조직도', '오시는 길'],
  },
  {
    title: '제품소개',
    items: ['KDMF APIs', 'Excipients(품목신고)', '식품 원료', '화장품 원료', '도매원료'],
  },
  {
    title: '연구개발',
    items: ['연구소 비전', '주요 연구성과', '특허 상황'],
  },
  {
    title: '투자정보',
    items: ['실적 리포트', '비전&미션'],
  },
  {
    title: '파트너',
    items: ['국내 파트너사', '해외 파트너사', '관련 사이트'],
  },
  {
    title: '인재채용',
    items: ['인재상', '채용공고', '채용절차', '직무소개', '복리후생'],
  },
  {
    title: '지속가능경영',
    items: ['개인정보처리방침', '윤리경영', '협력사 지원'],
  },
]

function HomeLanding({ onEnterManagement }) {
  const scrollRef = useRef(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [solutionProgress, setSolutionProgress] = useState(0)
  const [solutionLocked, setSolutionLocked] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [siteSearch, setSiteSearch] = useState('')
  const [hoveredNav, setHoveredNav] = useState(null)

  const openFullMenu = () => {
    setHoveredNav(null)
    setLanguageOpen(false)
    setSearchOpen(false)
    setMenuOpen(true)
  }

  const toggleLanguage = () => {
    setHoveredNav(null)
    setSearchOpen(false)
    setMenuOpen(false)
    setLanguageOpen((open) => !open)
  }

  const openSearch = () => {
    setHoveredNav(null)
    setLanguageOpen(false)
    setMenuOpen(false)
    setSearchOpen(true)
  }

  const closeSearch = () => {
    setSearchOpen(false)
    setSiteSearch('')
  }

  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return

    const handleScroll = () => {
      const start = scroller.clientHeight * 0.92
      const distance = scroller.clientHeight * 0.58
      const progress = Math.max(0, Math.min(1, (scroller.scrollTop - start) / distance))
      setSolutionProgress(progress)
      if (progress > 0.72) {
        setSolutionLocked(true)
      }
    }

    handleScroll()
    scroller.addEventListener('scroll', handleScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animationFrame = 0
    let stream = null
    let width = 0
    let height = 0
    const particleSeeds = Array.from({ length: 48 }, (_, index) => ({
      x: Math.random(),
      y: Math.random(),
      phase: index * 0.37,
      radius: 1.5 + Math.random() * 3.4,
    }))

    const resize = () => {
      const ratio = window.devicePixelRatio || 1
      width = Math.max(1280, window.innerWidth)
      height = Math.max(720, window.innerHeight)
      canvas.width = width * ratio
      canvas.height = height * ratio
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    const ease = (value) => value * value * (3 - 2 * value)
    const sceneOpacity = (progress, start, end) => {
      const fade = 0.08
      if (progress < start - fade || progress > end + fade) return 0
      if (progress < start) return ease((progress - start + fade) / fade)
      if (progress > end) return ease((end + fade - progress) / fade)
      return 1
    }

    const roundedRect = (x, y, w, h, r) => {
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + w - r, y)
      ctx.quadraticCurveTo(x + w, y, x + w, y + r)
      ctx.lineTo(x + w, y + h - r)
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
      ctx.lineTo(x + r, y + h)
      ctx.quadraticCurveTo(x, y + h, x, y + h - r)
      ctx.lineTo(x, y + r)
      ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.closePath()
    }

    const drawBase = (time) => {
      const gradient = ctx.createLinearGradient(0, 0, width, height)
      gradient.addColorStop(0, '#061620')
      gradient.addColorStop(0.52, '#0f3e4e')
      gradient.addColorStop(1, '#1b3426')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.055)'
      ctx.lineWidth = 1
      const gap = 86
      const offset = (time * 0.015) % gap
      for (let x = -gap; x < width + gap; x += gap) {
        ctx.beginPath()
        ctx.moveTo(x + offset, 0)
        ctx.lineTo(x - width * 0.1 + offset, height)
        ctx.stroke()
      }
      for (let y = -gap; y < height + gap; y += gap) {
        ctx.beginPath()
        ctx.moveTo(0, y + offset)
        ctx.lineTo(width, y - height * 0.06 + offset)
        ctx.stroke()
      }

      particleSeeds.forEach((particle, index) => {
        const px = ((particle.x * width + time * 0.018 * (index % 5 + 1)) % (width + 120)) - 60
        const py = particle.y * height + Math.sin(time * 0.001 + particle.phase) * 32
        ctx.beginPath()
        ctx.fillStyle = index % 3 === 0 ? 'rgba(137, 222, 255, 0.18)' : 'rgba(255, 255, 255, 0.12)'
        ctx.arc(px, py, particle.radius, 0, Math.PI * 2)
        ctx.fill()
      })
    }

    const drawWorker = (x, y, scale, tone = '#e5ba94') => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.94)'
      roundedRect(x - 16 * scale, y - 4 * scale, 32 * scale, 54 * scale, 10 * scale)
      ctx.fill()
      ctx.fillStyle = tone
      ctx.beginPath()
      ctx.arc(x, y - 19 * scale, 12 * scale, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#f8fbff'
      ctx.fillRect(x - 15 * scale, y - 34 * scale, 30 * scale, 10 * scale)
      ctx.fillStyle = 'rgba(14, 46, 60, 0.34)'
      ctx.fillRect(x - 10 * scale, y - 15 * scale, 20 * scale, 4 * scale)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.76)'
      ctx.lineWidth = 3 * scale
      ctx.beginPath()
      ctx.moveTo(x - 11 * scale, y + 8 * scale)
      ctx.lineTo(x - 28 * scale, y + 26 * scale)
      ctx.moveTo(x + 10 * scale, y + 8 * scale)
      ctx.lineTo(x + 26 * scale, y + 23 * scale)
      ctx.stroke()
    }

    const drawProduction = (time, opacity) => {
      ctx.save()
      ctx.globalAlpha = opacity
      const floor = height * 0.74
      ctx.fillStyle = 'rgba(235, 244, 247, 0.1)'
      ctx.fillRect(0, floor, width, height - floor)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'
      ctx.lineWidth = 2

      for (let i = 0; i < 5; i += 1) {
        const x = width * (0.24 + i * 0.105)
        const tankW = width * 0.065
        const tankH = height * (0.33 + (i % 2) * 0.06)
        const y = floor - tankH
        const g = ctx.createLinearGradient(x - tankW / 2, 0, x + tankW / 2, 0)
        g.addColorStop(0, 'rgba(178, 195, 201, 0.72)')
        g.addColorStop(0.5, 'rgba(246, 252, 255, 0.92)')
        g.addColorStop(1, 'rgba(130, 155, 166, 0.74)')
        ctx.fillStyle = g
        roundedRect(x - tankW / 2, y, tankW, tankH, 18)
        ctx.fill()
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.62)'
        ctx.stroke()
        ctx.fillStyle = 'rgba(20, 88, 112, 0.72)'
        ctx.fillRect(x - tankW * 0.22, y + tankH * 0.24, tankW * 0.44, 8)
        ctx.strokeStyle = 'rgba(215, 240, 246, 0.72)'
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x, height * 0.2)
        ctx.lineTo(width * 0.78, height * 0.2)
        ctx.stroke()
      }

      ctx.fillStyle = 'rgba(220, 235, 240, 0.8)'
      ctx.fillRect(width * 0.24, height * 0.23, width * 0.58, 7)
      ctx.fillRect(width * 0.24, height * 0.31, width * 0.5, 5)
      ctx.fillStyle = 'rgba(5, 26, 34, 0.72)'
      roundedRect(width * 0.63, floor - height * 0.18, width * 0.12, height * 0.1, 6)
      ctx.fill()
      ctx.fillStyle = 'rgba(108, 231, 194, 0.82)'
      ctx.fillRect(width * 0.646, floor - height * 0.155, width * 0.06, 6)
      ctx.fillRect(width * 0.646, floor - height * 0.13, width * 0.082, 6)
      drawWorker(width * 0.54, floor - 58, 1.05, '#d8ad86')
      drawWorker(width * 0.59, floor - 50, 0.94, '#f0c7a7')
      ctx.fillStyle = 'rgba(255, 255, 255, 0.82)'
      ctx.font = `${Math.max(17, width * 0.016)}px Roboto, Arial`
      ctx.fillText('API Production', width * 0.22, height * 0.18)
      ctx.restore()
    }

    const drawTransport = (time, progress, opacity) => {
      ctx.save()
      ctx.globalAlpha = opacity
      const sky = ctx.createLinearGradient(0, 0, 0, height)
      sky.addColorStop(0, 'rgba(112, 194, 219, 0.66)')
      sky.addColorStop(0.52, 'rgba(204, 234, 241, 0.34)')
      sky.addColorStop(1, 'rgba(23, 42, 44, 0.4)')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, width, height)

      ctx.fillStyle = 'rgba(255, 255, 255, 0.76)'
      for (let i = 0; i < 5; i += 1) {
        const x = ((i * 260 + time * 0.018) % (width + 260)) - 130
        const y = height * (0.16 + (i % 3) * 0.05)
        ctx.beginPath()
        ctx.ellipse(x, y, 78, 20, 0, 0, Math.PI * 2)
        ctx.ellipse(x + 42, y - 7, 46, 15, 0, 0, Math.PI * 2)
        ctx.fill()
      }

      const roadTop = height * 0.57
      ctx.fillStyle = 'rgba(22, 31, 34, 0.82)'
      ctx.beginPath()
      ctx.moveTo(width * 0.1, height)
      ctx.lineTo(width * 0.44, roadTop)
      ctx.lineTo(width * 0.63, roadTop)
      ctx.lineTo(width * 0.98, height)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(width * 0.52, roadTop + 18)
      ctx.lineTo(width * 0.54, height)
      ctx.stroke()

      ctx.strokeStyle = 'rgba(8, 33, 44, 0.66)'
      ctx.lineWidth = 6
      for (let i = 0; i < 5; i += 1) {
        const x = width * (0.72 + i * 0.05)
        ctx.beginPath()
        ctx.moveTo(x, height * 0.44)
        ctx.lineTo(x, height * 0.61)
        ctx.moveTo(x - 42, height * 0.48)
        ctx.lineTo(x + 42, height * 0.48)
        ctx.stroke()
      }

      const move = ease(Math.max(0, Math.min(1, (progress - 0.33) / 0.34)))
      const truckX = width * (0.24 + move * 0.15)
      const truckY = height * 0.62
      const truckW = width * 0.28
      const truckH = height * 0.16
      ctx.fillStyle = 'rgba(245, 250, 252, 0.96)'
      roundedRect(truckX, truckY - truckH, truckW, truckH, 9)
      ctx.fill()
      ctx.fillStyle = 'rgba(236, 244, 247, 0.98)'
      roundedRect(truckX - truckW * 0.26, truckY - truckH * 0.92, truckW * 0.27, truckH * 0.92, 8)
      ctx.fill()
      ctx.fillStyle = 'rgba(24, 80, 102, 0.78)'
      ctx.fillRect(truckX - truckW * 0.22, truckY - truckH * 0.82, truckW * 0.15, truckH * 0.35)
      const wheelPositions = [truckX - truckW * 0.14, truckX + truckW * 0.08, truckX + truckW * 0.24]
      wheelPositions.forEach((wheelX) => {
        ctx.fillStyle = '#0b2a35'
        ctx.beginPath()
        ctx.arc(wheelX, truckY + 5, 22, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#dbe8eb'
        ctx.beginPath()
        ctx.arc(wheelX, truckY + 5, 9, 0, Math.PI * 2)
        ctx.fill()
      })
      ctx.fillStyle = 'rgba(255, 255, 255, 0.86)'
      ctx.font = `${Math.max(17, width * 0.016)}px Roboto, Arial`
      ctx.fillText('Cold-chain Logistics', width * 0.18, height * 0.2)
      ctx.restore()
    }

    const drawPills = (time, progress, opacity) => {
      ctx.save()
      ctx.globalAlpha = opacity
      const floor = height * 0.72
      ctx.fillStyle = 'rgba(214, 229, 233, 0.12)'
      ctx.fillRect(0, floor, width, height - floor)
      ctx.fillStyle = 'rgba(236, 244, 246, 0.88)'
      roundedRect(width * 0.18, height * 0.5, width * 0.62, height * 0.09, 20)
      ctx.fill()
      ctx.fillStyle = 'rgba(29, 64, 72, 0.72)'
      ctx.fillRect(width * 0.21, height * 0.527, width * 0.56, height * 0.032)

      const beltMove = ((progress - 0.64) / 0.36) * 260
      for (let i = 0; i < 12; i += 1) {
        const x = width * 0.23 + ((i * 70 + beltMove) % (width * 0.5))
        const y = height * 0.542 + Math.sin(time * 0.004 + i) * 2
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate((i % 4 - 1.5) * 0.08)
        if (i % 2 === 0) {
          ctx.fillStyle = i % 3 === 0 ? '#f8fbff' : '#62d8bd'
          roundedRect(-18, -8, 36, 16, 8)
          ctx.fill()
          ctx.fillStyle = 'rgba(11, 86, 114, 0.28)'
          ctx.fillRect(0, -8, 2, 16)
        } else {
          ctx.fillStyle = '#f2f8fa'
          ctx.beginPath()
          ctx.arc(0, 0, 12, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = 'rgba(13, 77, 103, 0.3)'
          ctx.beginPath()
          ctx.moveTo(-7, 0)
          ctx.lineTo(7, 0)
          ctx.stroke()
        }
        ctx.restore()
      }

      ctx.fillStyle = 'rgba(230, 240, 244, 0.94)'
      roundedRect(width * 0.48, height * 0.24, width * 0.16, height * 0.23, 12)
      ctx.fill()
      ctx.fillStyle = 'rgba(15, 62, 78, 0.86)'
      ctx.fillRect(width * 0.51, height * 0.28, width * 0.1, height * 0.05)
      ctx.fillStyle = 'rgba(98, 216, 189, 0.88)'
      ctx.fillRect(width * 0.525, height * 0.295, width * 0.07, 5)
      ctx.strokeStyle = 'rgba(235, 248, 252, 0.66)'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(width * 0.56, height * 0.47)
      ctx.lineTo(width * 0.56, height * 0.53)
      ctx.stroke()

      ctx.fillStyle = 'rgba(255, 255, 255, 0.86)'
      ctx.font = `${Math.max(17, width * 0.016)}px Roboto, Arial`
      ctx.fillText('Tablet Manufacturing', width * 0.18, height * 0.2)
      ctx.restore()
    }

    const draw = (time = 0) => {
      drawBase(time)
      const progress = (time % 10000) / 10000
      drawProduction(time, sceneOpacity(progress, 0, 0.34))
      drawTransport(time, progress, sceneOpacity(progress, 0.3, 0.68))
      drawPills(time, progress, sceneOpacity(progress, 0.62, 1))

      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
      ctx.font = `700 ${Math.max(74, width * 0.08)}px Roboto, Arial`
      ctx.fillText('ABP', width * 0.66, height * 0.78)

      animationFrame = requestAnimationFrame(draw)
    }

    resize()
    draw()

    if (video && canvas.captureStream) {
      stream = canvas.captureStream(30)
      video.srcObject = stream
      video.play().catch(() => {})
    } else if (video) {
      video.style.display = 'none'
    }

    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', resize)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const scrollToProducts = () => {
    const scroller = scrollRef.current
    if (!scroller) return
    scroller.scrollTo({ top: scroller.clientHeight * 1.08, behavior: 'smooth' })
  }

  const effectiveProgress = solutionLocked ? 1 : solutionProgress
  const headlineScale = 1 + effectiveProgress * (scrollRef.current?.clientWidth < 600 ? 0.54 : 2.12)
  const headlineOpacity = solutionLocked ? 0 : Math.max(0, 1 - Math.max(0, effectiveProgress - 0.48) / 0.32)
  const panelProgress = solutionLocked ? 1 : Math.max(0, Math.min(1, (effectiveProgress - 0.42) / 0.42))
  const hoveredMenu = NAV_MENU_GROUPS.find((group) => group.title === hoveredNav)

  return (
    <main className="home-shell" ref={scrollRef}>
      <header className="home-nav" onMouseLeave={() => setHoveredNav(null)}>
        <button className="home-logo" onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}>
          <img src="/acebiopharm-ci.png" alt="Ace BioPharm" />
        </button>
        <nav className="home-nav-links" aria-label="주요 메뉴">
          {SITE_NAV_ITEMS.map((item) => {
            const menu = NAV_MENU_GROUPS.find((group) => group.title === item)
            return (
              <div
                className="home-nav-item"
                key={item}
                onMouseEnter={() => {
                  setLanguageOpen(false)
                  setSearchOpen(false)
                  setMenuOpen(false)
                  setHoveredNav(item)
                }}
              >
                <button className={hoveredNav === item ? 'active' : ''} onFocus={() => setHoveredNav(item)}>
                  {item}
                </button>
                {hoveredNav === item && menu && (
                  <div className="nav-mega-panel">
                    <div className="nav-mega-inner" style={{ '--mega-columns': Math.min(menu.columns.length, 4) }}>
                      {menu.columns.map((column) => (
                        <section className="nav-mega-column" key={`${menu.title}-${column.heading}`}>
                          <h3>{column.heading}</h3>
                          <ul>
                            {column.items.map((subItem) => (
                              <li key={subItem}>
                                <button>{subItem}</button>
                              </li>
                            ))}
                          </ul>
                        </section>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </nav>
        <div className="home-nav-tools" aria-label="도구 메뉴">
          <button className="nav-icon globe" aria-label="언어 선택" onClick={toggleLanguage}>
            <span />
          </button>
          {languageOpen && (
            <div className="language-popover" role="menu">
              {LANGUAGES.map((language) => (
                <button key={language} role="menuitem" onClick={() => setLanguageOpen(false)}>
                  {language}
                </button>
              ))}
            </div>
          )}
          <button className="nav-icon search" aria-label="검색" onClick={openSearch}>
            <span />
          </button>
          <button className="nav-icon menu" aria-label="전체 메뉴" onClick={openFullMenu}>
            <span />
            <span />
            <span />
          </button>
        </div>
        {hoveredMenu && <div className="nav-mega-band" />}
      </header>

      {searchOpen && (
        <div className="search-overlay" role="search">
          <div className="search-overlay-inner">
            <label className="site-search-box">
              <input
                value={siteSearch}
                onChange={(event) => setSiteSearch(event.target.value)}
                placeholder="검색어를 입력하세요."
                autoFocus
              />
              <button type="button" className="site-search-submit" aria-label="검색 실행">
                <span />
              </button>
            </label>
            <button className="search-close-btn" onClick={closeSearch} aria-label="검색 닫기" />
          </div>
        </div>
      )}

      {menuOpen && (
        <div className="full-menu-overlay" aria-modal="true" role="dialog" aria-label="전체 메뉴">
          <div className="full-menu-panel">
            <div className="full-menu-grid">
              {FULL_MENU_COLUMNS.map((column) => (
                <section className="full-menu-column" key={column.title}>
                  <h2>{column.title}</h2>
                  <ul className="full-menu-list">
                    {column.items.map((item) => (
                      <li key={item}>
                        <button>{item}</button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              <button className="full-menu-close" onClick={() => setMenuOpen(false)} aria-label="전체 메뉴 닫기" />
            </div>
          </div>
        </div>
      )}

      <section className="home-hero">
        <video ref={videoRef} className="home-hero-video" muted playsInline autoPlay loop aria-label="Ace Bio Pharm background video" />
        <canvas ref={canvasRef} className="home-hero-canvas" aria-hidden="true" />
        <div className="home-hero-shade" />
        <div className="home-hero-message" aria-label="더 건강한 미래를 만듭니다. 고객 감동을 실현하는 에이스바이오팜">
          {HERO_MESSAGE_LINES.map((line, lineIndex) => (
            <p
              className="home-hero-message-line"
              key={line}
              style={{ '--line-index': lineIndex }}
            >
              {line.split(' ').map((word, wordIndex) => (
                <span
                  className="home-hero-word"
                  key={`${line}-${word}`}
                  style={{ '--word-index': wordIndex }}
                >
                  {word}
                </span>
              ))}
            </p>
          ))}
        </div>
        <button className="home-scroll-hint" onClick={scrollToProducts} aria-label="제품소개 섹션으로 이동">
          <span />
        </button>
      </section>

      <section
        className="solution-section"
        style={{
          '--headline-scale': headlineScale,
          '--headline-opacity': headlineOpacity,
          '--panel-progress': panelProgress,
        }}
      >
        <div className="solution-copy" aria-label="We have the solution you need">
          <p className="solution-kicker">What we do</p>
          <h2>
            <span>We have the solution you need</span>
          </h2>
        </div>

        <div className="product-split" aria-label="제품소개">
          {PRODUCT_GROUPS.map((group) => (
            <article className={`product-panel ${group.tone}`} key={group.title}>
              <p>{group.eyebrow}</p>
              <h3>{group.title}</h3>
              <span>{group.description}</span>
              <div className="product-actions">
                {group.actions.map((action) => (
                  <button key={action.label} onClick={() => onEnterManagement(action.tab)}>
                    {action.label}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-footer-menu">
          <div className="home-footer-menu-inner">
            {FOOTER_NAV_GROUPS.map((group) => (
              <section className="home-footer-column" key={group.title}>
                <h2>{group.title}</h2>
                <ul>
                  {group.items.map((item) => (
                    <li key={item}>
                      <button>{item}</button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
        <div className="home-footer-info">
          <div className="home-footer-info-inner">
            <div className="home-footer-copy">
              <button className="privacy-link">개인정보처리방침</button>
              <p>[06664] 서울 서초구 방배로20길 5 서명빌딩</p>
              <p>대표 : 민병규 / TEL : 02-579-1056 / FAX : 02-6008-3356 / E-mail : ace@acebiopharm.com</p>
              <p>Copyright © 2010 ABP company. All Rights Reserved.</p>
            </div>
            <div className="home-footer-badges" aria-label="인증 및 브랜드">
              <img src="/footer-cert-marks.png" alt="벤처확인기업, Hi Seoul, Ace BioPharm" />
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}

export default function App() {
  const [showHome, setShowHome] = useState(true)
  const [activeTab, setActiveTab] = useState('원료 수입')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [search, setSearch] = useState('')

  const isLogTab = activeTab === '업무일지'
  const isEnglishTab = activeTab === 'AI 전화영어'

  const enterManagement = (tab = '원료 수입') => {
    setActiveTab(tab)
    setSearch('')
    setShowHome(false)
  }

  const fetchRows = useCallback(async () => {
    if (isLogTab || isEnglishTab) return
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
  }, [activeTab, isLogTab, isEnglishTab])

  useEffect(() => {
    if (showHome || isLogTab || isEnglishTab) return
    fetchRows()

    const channel = supabase
      .channel('business_items_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_items' }, () => fetchRows())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchRows, isLogTab, isEnglishTab, showHome])

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
    if (field === 'customer') {
      updateData.salesperson = CUSTOMER_SALESPERSON[value] || ''
    }
    const { error } = await supabase.from('business_items').update(updateData).eq('id', id)
    if (error) {
      console.error('업데이트 오류:', error)
      alert('저장 실패: ' + error.message)
    } else {
      fetchRows()
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return
    const { error } = await supabase.from('business_items').delete().eq('id', id)
    if (error) {
      alert('삭제 실패: ' + error.message)
    } else {
      fetchRows()
    }
  }

  if (showHome) {
    return (
      <div className="app home-app">
        <HomeLanding onEnterManagement={enterManagement} />
      </div>
    )
  }

  return (
    <div className="app business-app">
      <header className="header">
        <div className="header-left">
          <button className="home-back-btn" onClick={() => setShowHome(true)} aria-label="메인으로 이동">
            Ace Bio Pharm
          </button>
          <h1>업무 관리</h1>
        </div>
        {!isLogTab && !isEnglishTab && (
          <div className="header-right">
            <input
              className="search-input"
              type="text"
              placeholder="검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
      </header>

      <div className="tabs">
        {ALL_TABS.map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''} ${tab === '업무일지' ? 'tab-log' : ''} ${tab === 'AI 전화영어' ? 'tab-english' : ''}`}
            onClick={() => {
              setActiveTab(tab)
              setSearch('')
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {isEnglishTab ? (
        <EnglishTutor />
      ) : isLogTab ? (
        <DailyLog />
      ) : (
        <>
          <div className="table-container">
            {loading ? (
              <div className="loading">불러오는 중...</div>
            ) : (
              <DataTable rows={filteredRows} onUpdate={handleUpdate} onDelete={handleDelete} />
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
        </>
      )}
    </div>
  )
}
