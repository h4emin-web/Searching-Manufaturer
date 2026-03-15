from pydantic import BaseModel, Field, field_validator
from typing import Literal
from enum import Enum
import uuid


class UseCase(str, Enum):
    PHARMACEUTICAL = "pharmaceutical"
    COSMETIC = "cosmetic"
    FOOD = "food"


class LLMProvider(str, Enum):
    GPT4O = "gpt4o"
    GEMINI = "gemini"
    DEEPSEEK = "deepseek"
    QWEN = "qwen"


class OutreachChannel(str, Enum):
    WECHAT = "wechat"
    WHATSAPP = "whatsapp"
    EMAIL = "email"
    WEB_FORM = "web_form"
    NONE = "none"


# ─── LLM 결과 원본 ────────────────────────────────────────────
class RawManufacturer(BaseModel):
    """각 LLM이 반환하는 제조소 정보"""
    name: str = Field(description="제조소 공식 명칭")
    country: str = Field(description="국가명 (영문)")
    country_code: str | None = Field(default=None, description="ISO 2자리 국가코드")
    city: str | None = None
    contact_email: str | None = None
    contact_wechat: str | None = None
    contact_whatsapp: str | None = None
    website: str | None = None
    certifications: list[str] = Field(default_factory=list, description="인증 목록 (WHO-GMP, ISO 등)")
    products: list[str] = Field(default_factory=list, description="주요 취급 원료")
    annual_capacity_kg: float | None = None
    established_year: int | None = None
    source_llm: LLMProvider
    confidence_score: float = Field(ge=0.0, le=1.0, default=0.5)
    source_notes: str = ""

    @field_validator("certifications", mode="before")
    @classmethod
    def normalize_certs(cls, v):
        if isinstance(v, str):
            return [c.strip() for c in v.split(",") if c.strip()]
        return v or []


# ─── 중복 제거 후 통합 제조소 ──────────────────────────────────
class Manufacturer(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    canonical_name: str             # 정규화된 이름 (소문자, 법인격 제거)
    country: str
    country_code: str | None = None
    city: str | None = None

    # 연락처 (채널별)
    contact_email: str | None = None
    contact_wechat: str | None = None
    contact_whatsapp: str | None = None
    web_form_url: str | None = None
    website: str | None = None

    # 인증 및 소싱 정보
    certifications: list[str] = Field(default_factory=list)
    source_llms: list[LLMProvider] = Field(default_factory=list)
    confidence_score: float = Field(ge=0.0, le=1.0, default=0.5)
    merge_similarity_score: float | None = None   # 병합 시 유사도 점수

    # 필터링
    is_excluded: bool = False
    is_manually_added: bool = False
    exclusion_reason: str | None = None

    # 크롤링으로 보강된 정보
    crawled_contacts: dict = Field(default_factory=dict)
    last_crawled_at: str | None = None


# ─── 세션 / 워크플로우 ─────────────────────────────────────────
class WizardStep1(BaseModel):
    ingredient_name: str
    ingredient_name_ko: str | None = None
    ingredient_name_zh: str | None = None
    cas_number: str | None = None
    use_case: UseCase


class RegulatorySelection(BaseModel):
    requirement_id: str
    is_selected: bool
    notes: str = ""


class WizardStep2(BaseModel):
    selections: list[RegulatorySelection] = Field(default_factory=list)
    additional_notes: str = ""


class SessionStepData(BaseModel):
    step1: WizardStep1 | None = None
    step2: WizardStep2 | None = None
    sourcing_task_id: str | None = None
    sourcing_status: str = "idle"
    excluded_ids: list[str] = Field(default_factory=list)
    manually_added: list[Manufacturer] = Field(default_factory=list)
    outreach_plan_id: str | None = None
    outreach_status: str = "draft"


class SessionResponse(BaseModel):
    id: str
    current_step: int
    max_completed_step: int
    status: str
    step_data: SessionStepData
    manufacturers: list[Manufacturer] = Field(default_factory=list)


# ─── 소싱 요청 / 응답 ──────────────────────────────────────────
class SourcingRequest(BaseModel):
    session_id: str
    ingredient_name: str
    use_case: UseCase
    regulatory_requirements: list[str] = Field(default_factory=list)
    regions: list[str] = Field(default_factory=list)
    sourcing_notes: str = ""
    llm_providers: list[LLMProvider] = Field(
        default_factory=lambda: [LLMProvider.GEMINI]
    )


class SourcingResult(BaseModel):
    task_id: str
    status: Literal["queued", "running", "completed", "failed"]
    progress: int = Field(ge=0, le=100, default=0)
    llm_results: dict[LLMProvider, list[RawManufacturer]] = Field(default_factory=dict)
    deduplicated: list[Manufacturer] = Field(default_factory=list)
    total_raw: int = 0
    total_deduplicated: int = 0
    error: str | None = None


# ─── 아웃리치 ──────────────────────────────────────────────────
class OutreachAttempt(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    manufacturer_id: str
    channel: OutreachChannel
    priority: int = Field(ge=1, le=10, description="낮을수록 높은 우선순위")
    status: Literal["pending", "sent", "replied", "failed", "bounced"] = "pending"
    message_ko: str = ""
    message_en: str = ""
    message_zh: str = ""
    sent_at: str | None = None
    reply_at: str | None = None
    reply_content: str | None = None
    retry_count: int = 0
    last_error: str | None = None


class OutreachPlan(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    attempts: list[OutreachAttempt] = Field(default_factory=list)
    status: Literal["draft", "scheduled", "running", "completed"] = "draft"
    total_targets: int = 0
    sent_count: int = 0
    replied_count: int = 0
