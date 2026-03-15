from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    APP_NAME: str = "Pharma Sourcing Agent"
    DEBUG: bool = False
    API_PREFIX: str = "/api/v1"
    PORT: int = 8002
    CORS_ORIGINS: list[str] = ["*"]

    # Database (Supabase / PostgreSQL)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/pharma_sourcing"
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # LLM API Keys
    GEMINI_API_KEY: str = ""
    QWEN_API_KEY: str = ""

    # Hunter.io (이메일 검색)
    HUNTER_API_KEY: str = ""

    # Ollama (로컬 전용)
    OLLAMA_BASE_URL: str = "http://localhost:11434/v1"
    OLLAMA_DEEPSEEK_MODEL: str = "deepseek-r1:8b"
    OLLAMA_QWEN_MODEL: str = "qwen2.5:7b"
    OLLAMA_GPT_MODEL: str = "llama3.2"

    # Communication
    BREVO_API_KEY: str = ""           # Brevo (구 Sendinblue) API key (권장)
    RESEND_API_KEY: str = ""          # Resend.com API key
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = ""
    REPLY_TO_EMAIL: str = ""          # 답장 수신 이메일 (본인 Gmail 등)
    TEST_EMAIL_OVERRIDE: str = ""     # 설정 시 모든 발송을 이 주소로 리디렉션 (테스트용)
    IMAP_USER: str = ""               # Gmail 수신 계정 (h4emin@gmail.com)
    IMAP_PASSWORD: str = ""           # Gmail 앱 비밀번호 (16자리)

    # Deduplication
    DEDUP_SIMILARITY_THRESHOLD: float = 0.82
    DEDUP_LLM_THRESHOLD: float = 0.68   # borderline: use LLM to decide

    # Outreach SLA (hours before fallback to next channel)
    OUTREACH_SLA_HOURS: int = 48


@lru_cache
def get_settings() -> Settings:
    return Settings()
