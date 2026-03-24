# Acebiopharm Pharma Sourcing Agent

AI 기반 의약품 원료 제조사 자동 소싱 시스템
제조사 탐색 → 이메일 자동 발송 → 답장 분석 → Follow-up까지 전 과정 자동화

🌐 **Live:** https://searching-manufaturer.vercel.app

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS |
| **Backend** | FastAPI, Python 3.12 |
| **AI** | Google Gemini 2.0 Flash |
| **이메일 발송** | Brevo API (HTTPS, 클라우드 포트 차단 우회) |
| **이메일 수신** | 네이버 IMAP (imap.naver.com:993) |
| **데이터베이스** | Supabase (PostgreSQL) |
| **프론트 배포** | Vercel |
| **백엔드 배포** | Render (Docker) |

---

## 전체 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (Vercel)                     │
│           React + TypeScript + Tailwind CSS             │
│    소싱 마법사 UI / 요청 현황 / 대시보드                  │
└────────────────────────┬────────────────────────────────┘
                         │ VITE_API_URL
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  Backend (Render)                       │
│                FastAPI / Python 3.12                    │
│                                                         │
│  ┌──────────────────┐      ┌───────────────────────┐    │
│  │  Sourcing Agent  │      │   Outreach Router     │    │
│  │  (Gemini AI)     │─────►│   이메일 생성 & 발송   │    │
│  └──────────────────┘      └──────────┬────────────┘    │
│                                       │                 │
│  ┌────────────────────────────────────▼──────────────┐  │
│  │              Thread Store                         │  │
│  │        인메모리 + Supabase 영구 저장               │  │
│  └────────────────────────────────────┬──────────────┘  │
│                                       │                 │
│  ┌────────────────────────────────────▼──────────────┐  │
│  │           백그라운드 루프 (상시 실행)               │  │
│  │   · 네이버 IMAP 폴링 (10초 간격)                   │  │
│  │   · Follow-up 스케줄러 (30분 체크)                 │  │
│  └───────────────────────────────────────────────────┘  │
└───────────────┬──────────────────────┬──────────────────┘
                │                      │
                ▼                      ▼
    ┌───────────────────┐   ┌─────────────────────┐
    │   Brevo API       │   │  네이버 IMAP         │
    │   (메일 발송)      │   │  (답장 수신)         │
    └───────────────────┘   └─────────────────────┘
                                       │
                                       ▼
                            ┌─────────────────────┐
                            │  Supabase           │
                            │  (스레드 기록 저장)  │
                            └─────────────────────┘
```

---

## 이메일 자동화 플로우

```
[Brevo → 초기 소싱 메일 발송]
         │
         ├── 24시간 무응답 ──► [리마인더 발송] (최대 2회)
         │
         └── 네이버 IMAP에 답장 수신
                  │
                  ▼
          [Gemini AI 답장 분석]
                  │
      ┌───────────┼───────────┐
      ▼           ▼           ▼
  모든 항목    일부 항목    제조사가
  답변 완료   누락 답변    질문을 함
      │           │           │
      ▼           ▼           ▼
   [완료]   [누락 항목만  [자동 답변
            재질문 발송]   또는 검토]
```

---

## 발송 이메일 형식

```
제목: [Acebiopharm] Product inquiry_[원료명]

Dear Sir/Madam,
Good day

My name is Mason from Acebiopharm, a leading distributor
dealing with pharmaceutical materials, food and cosmetics
from South Korea.

Currently we are looking for "[원료명]"...

1. Pricing for MOQ based on CIF term
2. WHO-GMP, SMF certificate (or COPP)
3. Latest Certificate of Analysis (COA)
4. Packing unit
5. Estimated lead time
6. Possibility of receiving samples for evaluation

Best regards, Mason
```

> 중국·일본·유럽 등 제조사 국가에 따라 현지 언어로 자동 번역 발송

---

## 프로젝트 구조

```
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   │   ├── sourcing_agent.py        # Gemini AI 제조사 탐색
│   │   │   ├── outreach_email_agent.py  # 이메일 템플릿 생성
│   │   │   └── reply_agent.py           # 답장 분석 + 재질문 생성
│   │   ├── services/
│   │   │   ├── email_sender.py          # Brevo API 발송
│   │   │   ├── email_receiver.py        # 네이버 IMAP 폴링
│   │   │   ├── reply_handler.py         # 답장 처리 오케스트레이터
│   │   │   ├── followup_scheduler.py    # 리마인더 스케줄러
│   │   │   └── thread_store.py          # 스레드 상태 관리
│   │   ├── routers/
│   │   │   ├── outreach.py              # 소싱 발송 API
│   │   │   ├── dashboard.py             # 현황 대시보드 API
│   │   │   └── sessions.py              # 세션 관리
│   │   ├── config.py
│   │   ├── db.py                        # Supabase 클라이언트
│   │   └── main.py                      # FastAPI 진입점
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Index.tsx                # 소싱 마법사 UI
│       │   ├── MyRequests.tsx           # 내 요청 현황
│       │   └── AllRequests.tsx          # 전체 현황
│       └── components/sourcing/
├── Dockerfile                           # Render 배포용 (루트)
├── render.yaml                          # Render 배포 설정
└── vercel.json                          # Vercel 배포 설정
```

---

## 환경변수

### Backend (Render)

| 변수 | 설명 | 필수 |
|------|------|------|
| `GEMINI_API_KEY` | Gemini API 키 | ✅ |
| `BREVO_API_KEY` | Brevo 이메일 발송 API 키 | ✅ |
| `FROM_EMAIL` | 발신 이메일 (Brevo 인증된 주소) | ✅ |
| `REPLY_TO_EMAIL` | 답장 수신 이메일 (네이버) | ✅ |
| `IMAP_USER` | 네이버 이메일 | ✅ |
| `IMAP_PASSWORD` | 네이버 앱 비밀번호 | ✅ |
| `SUPABASE_URL` | Supabase 프로젝트 URL | ✅ |
| `SUPABASE_KEY` | Supabase service_role 키 | ✅ |
| `TEST_EMAIL_OVERRIDE` | 테스트용 수신 주소 | 선택 |

### Frontend (Vercel)

| 변수 | 설명 |
|------|------|
| `VITE_API_URL` | 백엔드 URL + `/api/v1` |

---

## 로컬 실행

```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env   # 환경변수 입력
uvicorn app.main:app --reload --port 8002

# Frontend
cd frontend
npm install
npm run dev
```

---

## Supabase 스키마

`backend/supabase_schema.sql`을 Supabase SQL Editor에서 실행

주요 테이블:
- `email_threads` — 이메일 스레드 상태 (follow_up_count, has_reply 등)
- `thread_message_index` — Message-ID 역방향 인덱스 (In-Reply-To 매칭용)
