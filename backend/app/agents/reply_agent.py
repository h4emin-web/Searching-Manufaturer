"""
이메일 자동 답변 생성 에이전트 (Gemini 기반)
- 제조원 국가에 맞는 단일 언어로만 답변
- CIF Sea / CIP Air 기준 가격 요청
"""
from pydantic import BaseModel
from pydantic_ai import Agent
from pydantic_ai.models.gemini import GeminiModel

from ..config import get_settings
from ..services.thread_store import EmailThread

settings = get_settings()


# ─── 국가 → 언어 매핑 ──────────────────────────────────────
_COUNTRY_LANGUAGE: dict[str, str] = {
    "China":        "zh",
    "Taiwan":       "zh",
    "Hong Kong":    "zh",
    "Korea":        "ko",
    "South Korea":  "ko",
}

_LANGUAGE_NAMES: dict[str, str] = {
    "zh": "Chinese (Simplified, 简体中文)",
    "ko": "Korean (한국어)",
    "en": "English",
    "ja": "Japanese (日本語)",
    "de": "German (Deutsch)",
    "fr": "French (Français)",
    "it": "Italian (Italiano)",
    "es": "Spanish (Español)",
}

# 유럽 주요국 → 해당 언어
_EUROPEAN: dict[str, str] = {
    "Germany":      "de",
    "France":       "fr",
    "Italy":        "it",
    "Spain":        "es",
    "Japan":        "ja",
}


def get_email_language(country: str) -> str:
    if not country:
        return "en"
    c = country.strip()
    if c in _COUNTRY_LANGUAGE:
        return _COUNTRY_LANGUAGE[c]
    if c in _EUROPEAN:
        return _EUROPEAN[c]
    return "en"


class ReplyContent(BaseModel):
    subject: str    # 제목 (Re: 포함)
    body: str       # 해당 국가 언어 본문만
    language: str   # "en" / "ko" / "zh" / "ja" / "de" 등
    reasoning: str  # AI 판단 근거 (내부 로깅용)


_REPLY_SYSTEM_PROMPT = """
You are a professional pharmaceutical procurement specialist at a Korean pharmaceutical company.
You manage email correspondence with manufacturers regarding API/excipient sourcing inquiries.

PRICING RULE (CRITICAL):
- Always request prices on CIF Sea (Cost, Insurance, Freight) basis to Busan Port, South Korea
- For urgent/air shipment, request CIP Air (Carriage and Insurance Paid) basis to Incheon Airport, South Korea

YOUR ROLE:
- Respond professionally and courteously to manufacturer replies
- Push toward concrete next steps: samples, COA/DMF/CoPP documents, price quotes, or call scheduling
- Acknowledge what the manufacturer said, then ask relevant follow-up questions
- If they cannot supply, thank them gracefully and close the conversation
- Keep replies concise (5-10 sentences max)

LANGUAGE RULE (CRITICAL):
- Write the reply ONLY in the language specified in the prompt
- Do NOT mix languages in the body field
"""


def _build_conversation_text(thread: EmailThread) -> str:
    lines = []
    for msg in thread.conversation:
        role_label = "Our email" if msg["role"] == "us" else f"Reply from {thread.manufacturer_name}"
        lines.append(f"[{role_label}]\n{msg['body']}")
    return "\n\n---\n\n".join(lines)


async def generate_reply(thread: EmailThread) -> ReplyContent:
    """대화 히스토리 + 국가 기반으로 단일 언어 후속 답변 생성"""
    lang_code = get_email_language(thread.country)
    lang_name = _LANGUAGE_NAMES.get(lang_code, "English")

    model = GeminiModel("gemini-2.5-flash", api_key=settings.GEMINI_API_KEY)
    agent = Agent(
        model=model,
        result_type=ReplyContent,
        system_prompt=_REPLY_SYSTEM_PROMPT,
        retries=2,
    )

    conversation_text = _build_conversation_text(thread)
    prompt = f"""
Sourcing ingredient: **{thread.ingredient}**
Manufacturer: {thread.manufacturer_name} ({thread.country or "Unknown country"})
Their email: {thread.to_email}

LANGUAGE TO USE: {lang_name} (language code: {lang_code})
Write the entire body field in {lang_name} ONLY.

If asking about price, always request:
- CIF Sea basis to Busan Port (부산항), South Korea
- CIP Air basis to Incheon Airport (인천공항), South Korea (if air freight applicable)

Full conversation so far:
{conversation_text}

Generate the next reply. Subject should start with "Re: ".
Original subject: {thread.subject}
Set language field to: {lang_code}
"""

    result = await agent.run(prompt.strip())
    return result.data
