-- ============================================================
-- Pharma Sourcing Agent - Supabase 테이블 스키마
-- Supabase 대시보드 > SQL Editor에서 실행하세요
-- ============================================================

-- 이메일 스레드 (자동 답변 추적)
CREATE TABLE IF NOT EXISTS email_threads (
    message_id          TEXT PRIMARY KEY,
    last_message_id     TEXT NOT NULL,
    to_email            TEXT NOT NULL,
    manufacturer_name   TEXT NOT NULL,
    ingredient          TEXT NOT NULL,
    subject             TEXT NOT NULL,
    country             TEXT DEFAULT '',
    auto_reply_count    INTEGER DEFAULT 0,
    max_auto_replies    INTEGER DEFAULT 3,
    conversation        JSONB DEFAULT '[]'::jsonb,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 메시지 ID 역방향 인덱스 (In-Reply-To 추적용)
CREATE TABLE IF NOT EXISTS thread_message_index (
    any_message_id      TEXT PRIMARY KEY,
    original_message_id TEXT NOT NULL REFERENCES email_threads(message_id) ON DELETE CASCADE
);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON email_threads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS (Row Level Security) - 서버 사이드 접근만 허용
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_message_index ENABLE ROW LEVEL SECURITY;

-- service_role key는 RLS 우회 가능 (백엔드에서 사용)
-- anon key는 차단
CREATE POLICY "service_only" ON email_threads
    USING (auth.role() = 'service_role');

CREATE POLICY "service_only" ON thread_message_index
    USING (auth.role() = 'service_role');
