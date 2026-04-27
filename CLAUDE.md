# Pharma Sourcing - 프로젝트 상태

## 구조
- **Frontend**: `frontend/` — Vite + React + TypeScript, Vercel 배포
- **Backend**: `backend/` — FastAPI + Python, Render 배포
- **DB**: Supabase (PostgreSQL REST API, httpx 커스텀 클라이언트)

## 인프라
- Frontend: Vercel (자동 배포 — main 푸시 시)
- Backend: Render (자동 배포 — main 푸시 시)
- 이메일 발송: Brevo API (Render에서 SMTP 포트 차단으로 인해 사용)
- 이메일 수신: 네이버 IMAP 폴링 (10초 간격)
- DB: Supabase — `SUPABASE_URL`, `SUPABASE_KEY`(service_role) Render 환경변수에 설정

## Supabase 테이블
```sql
user_requests, email_threads, thread_message_index, simple_plans
```

## 핵심 플로우
1. 사용자가 원료 입력 → AI(Gemini)로 제조소 검색
2. 결과 확인 후 선택 → 이메일 자동 발송 (Brevo)
3. 네이버 IMAP으로 답장 감지 → Gemini로 분석 → 자동 답장
4. 대시보드에서 요청/수신/미수신 항목 실시간 확인

## 현재 작업 중인 문제

### 자동답변 안 되는 버그 (수정 완료, 테스트 필요)
- **원인**: Brevo가 우리 커스텀 `Message-ID`를 자기 도메인(`@smtp-relay.sendinblue.com`)으로 교체
- **수정**: `email_sender.py`에서 Brevo API 응답의 실제 `messageId`를 스레드 등록에 사용
- **확인 방법**: 새 소싱 시작 → 제조사 입장에서 답장 → 로그에서 `brevo_send_ok` 확인
  ```
  brevo_send_ok  our_msg_id=<...@naver.com>  brevo_msg_id=<...@sendinblue.com>
  ```
  `brevo_msg_id`가 답장의 `in_reply_to`와 일치해야 함

### Supabase 연결 (방금 수정)
- 기존 계정 분실 → 새 프로젝트 생성
- Render 환경변수 `SUPABASE_URL`, `SUPABASE_KEY`(service_role) 업데이트 완료

## 주요 파일

### Backend
- `backend/app/services/email_sender.py` — Brevo/SMTP 발송, Message-ID 처리
- `backend/app/services/email_receiver.py` — 네이버 IMAP 폴링
- `backend/app/services/reply_handler.py` — 답장 처리 오케스트레이터
- `backend/app/services/thread_store.py` — 이메일 스레드 메모리+Supabase
- `backend/app/agents/reply_agent.py` — Gemini로 답장 분석/생성
- `backend/app/routers/outreach.py` — 아웃리치 플랜 관리, AI 채팅
- `backend/app/routers/debug.py` — 진단용 엔드포인트

### Frontend
- `frontend/src/pages/Index.tsx` — 메인 플로우 (로그인→검색→대시보드)
- `frontend/src/pages/MyRequests.tsx` — 내 소싱 요청 목록
- `frontend/src/components/sourcing/SourcingDashboard.tsx` — 소싱 진행 대시보드
- `frontend/src/pages/AllRequests.tsx` — 전체/내 진행상황

## 엔드유저 공개 정책
- 먼저 언급 금지
- 제조사가 물어볼 때만: 공개 가능이면 이름 알려줌, 불가이면 "현재 고객사 없고 영업 중"

## 디버그 엔드포인트 (`/api/v1/debug/`)
- `GET /imap-check` — IMAP 연결 + 미읽은 메일 수
- `GET /brevo-check` — Brevo 계정/크레딧 상태
- `GET /email-send-check` — 발송 설정 확인
- `GET /threads` — 등록된 스레드 목록
- `GET /threads/message-index` — 메시지 ID 인덱스
- `POST /poll-now` — IMAP 즉시 폴링
- `GET /test-llm` — Gemini/Qwen 연결 테스트

## 대시보드 UI 구조 (ConversationSummary)
각 제조사 카드에 구조화된 행:
- **요청**: 가격(CIF) · GMP 인증서 · COA · 샘플 가능 여부 요청 [날짜]
- **수신**: 받은 항목 (초록색)
- **미수신**: 못 받은 항목 — 재요청 발송 완료/예정 (노란색)
