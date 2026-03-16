# Pharma Manufacturer Sourcing Agent

의약품 원료 제조원을 AI로 탐색하고, 소싱 이메일 발송부터 답변 분석 · 자동 재질문 · 리마인더까지 자동화하는 풀스택 시스템입니다.

---

## 전체 아키텍처

```
사용자 (Frontend)
      │
      │  소싱 요청 (원료명 / 용도 / 지역)
      ▼
┌─────────────────────────────────────────────────────┐
│              Backend API (FastAPI · Railway)         │
│                                                     │
│  ┌─────────────┐   ┌──────────────┐                │
│  │ Sourcing    │   │  Outreach    │                │
│  │ Agent       │   │  Router      │                │
│  │ (Gemini AI) │   │              │                │
│  └──────┬──────┘   └──────┬───────┘                │
│         │                 │                         │
│         ▼                 ▼                         │
│  ┌─────────────────────────────────────┐            │
│  │          Email Sender (Brevo)       │            │
│  │  Message-ID / In-Reply-To 헤더 포함 │            │
│  └──────────────────┬──────────────────┘            │
│                     │                               │
│  ┌──────────────────▼──────────────────┐            │
│  │         Thread Store                │            │
│  │  (인메모리 + Supabase 영구 저장)      │            │
│  └──────────────────┬──────────────────┘            │
│                     │                               │
│  ┌──────────────────▼──────────────────┐            │
│  │  백그라운드 루프 (2개 병렬)           │            │
│  │  1. Email Receiver (IMAP 5분 폴링)  │            │
│  │  2. Followup Scheduler (30분 체크)  │            │
│  └─────────────────────────────────────┘            │
└─────────────────────────────────────────────────────┘
      │                          │
      ▼                          ▼
 Gmail IMAP                 Supabase
 (수신 감시)                (스레드 상태 저장)
```

---

## 이메일 자동화 플로우

```
[소싱 이메일 발송]
       │
       ├──── 24시간 후 무응답 ────► [리마인더 발송] (최대 2회)
       │
       └──── 답장 수신 (IMAP 폴링)
                    │
                    ▼
             [Gemini AI 분석]
                    │
         ┌──────────┼──────────┐
         ▼          ▼          ▼
    모든 항목    일부 항목    제조원이
    답변 완료   누락 답변    질문을 함
         │          │          │
         ▼          ▼     ┌────┴────┐
      [완료]   [누락 항목만  명확한  애매한
              재질문 발송]  질문    질문
                           │       │
                           ▼       ▼
                        [자동     [담당자
                        답변]     검토 요청]
                                    │
                                    ▼
                             [승인 후 발송]
```

---

## 프로젝트 구조

```
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   │   ├── sourcing_agent.py        # AI 제조원 탐색 (Gemini)
│   │   │   ├── outreach_email_agent.py  # 초기 소싱 이메일 생성
│   │   │   └── reply_agent.py           # 답장 분석 + 재질문 생성
│   │   ├── services/
│   │   │   ├── email_sender.py          # Brevo API 발송 (헤더 포함)
│   │   │   ├── email_receiver.py        # Gmail IMAP 폴링 (5분)
│   │   │   ├── reply_handler.py         # 답장 처리 오케스트레이터
│   │   │   ├── followup_scheduler.py    # 24시간 리마인더 스케줄러
│   │   │   └── thread_store.py          # 스레드 상태 관리 (DB 연동)
│   │   ├── routers/
│   │   │   ├── outreach.py              # 소싱 발송 API
│   │   │   ├── dashboard.py             # 현황 대시보드 API
│   │   │   └── ...
│   │   ├── config.py
│   │   ├── db.py                        # Supabase REST 클라이언트
│   │   └── main.py                      # FastAPI 앱 진입점
│   ├── supabase_schema.sql
│   ├── requirements.txt
│   └── Dockerfile
└── frontend/
    └── src/
        ├── pages/
        │   ├── Index.tsx                # 소싱 마법사 (단계별 입력)
        │   ├── MyRequests.tsx           # 내 요청 현황
        │   └── AllRequests.tsx          # 전체 현황 (담당자 검토 포함)
        └── components/sourcing/         # 단계별 UI 컴포넌트
```

---

## 환경변수

### Backend (Railway)

| 변수 | 설명 | 필수 |
|------|------|------|
| `GEMINI_API_KEY` | Gemini API 키 (AI 분석) | O |
| `BREVO_API_KEY` | Brevo 이메일 발송 API 키 | O |
| `IMAP_USER` | Gmail 수신 계정 | O |
| `IMAP_PASSWORD` | Gmail 앱 비밀번호 (16자리) | O |
| `FROM_EMAIL` | 발신 이메일 주소 | O |
| `REPLY_TO_EMAIL` | 답장 수신 주소 | O |
| `SUPABASE_URL` | Supabase 프로젝트 URL | O |
| `SUPABASE_KEY` | Supabase service_role 키 | O |
| `TEST_EMAIL_OVERRIDE` | 테스트용 수신 주소 (설정 시 모든 메일이 여기로) | 선택 |

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

`backend/supabase_schema.sql` 전체를 Supabase SQL Editor에서 실행하세요.

주요 테이블:
- `email_threads` — 이메일 스레드 상태 (follow_up_count, has_reply, last_sent_at 포함)
- `thread_message_index` — Message-ID 역방향 인덱스 (In-Reply-To 매칭용)

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Backend | FastAPI, Python 3.12 |
| AI | Google Gemini |
| 이메일 발송 | Brevo API |
| 이메일 수신 | Gmail IMAP |
| DB | Supabase (PostgreSQL) |
| 배포 | Railway (Docker) |
| Frontend | React, TypeScript, Vite, Tailwind CSS |
