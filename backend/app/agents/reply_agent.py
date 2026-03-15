"""
이메일 자동 답변 에이전트 (Gemini httpx 직접 호출)
- 답장 분석: 누락 항목 체크, 제조원 질문 파악
- AI 판단 불가 → 에스컬레이션 플래그
- 국가별 언어로 응답 생성
"""
import httpx
import json
import re
import structlog

from ..config import get_settings
from ..services.thread_store import EmailThread

settings = get_settings()
logger = structlog.get_logger()

_COUNTRY_LANGUAGE: dict[str, str] = {
    "China": "Chinese (Simplified, 简体中文)",
    "Taiwan": "Chinese (Traditional, 繁體中文)",
    "Hong Kong": "Chinese (Traditional, 繁體中文)",
    "Japan": "Japanese (日本語)",
    "Germany": "German (Deutsch)",
    "France": "French (Français)",
    "Italy": "Italian (Italiano)",
    "Spain": "Spanish (Español)",
}

# 초기 발송에서 요청한 필수 항목들
REQUIRED_ITEMS = [
    "product_available",   # 제품 공급 가능 여부
    "certifications",      # COA / GMP 인증서
    "pricing_cif",         # CIF Busan 가격
    "sample",              # 무상 샘플
]

ITEM_LABELS = {
    "product_available": "제품 공급 가능 여부",
    "certifications": "COA/GMP 인증서",
    "pricing_cif": "CIF Busan 가격",
    "sample": "무상 샘플 가능 여부",
}


def _get_language(country: str) -> str:
    for key, lang in _COUNTRY_LANGUAGE.items():
        if key.lower() in country.lower():
            return lang
    return "English"


def _build_conversation_text(thread: EmailThread) -> str:
    lines = []
    for msg in thread.conversation:
        label = "Our email" if msg["role"] == "us" else f"Reply from {thread.manufacturer_name}"
        lines.append(f"[{label}]\n{msg['body']}")
    return "\n\n---\n\n".join(lines)


async def analyze_and_reply(thread: EmailThread) -> dict:
    """
    답장 분석 + 응답 생성
    Returns:
      {
        "needs_reply": bool,
        "needs_human": bool,
        "human_questions": list[str],   # 요청자가 답해야 할 질문
        "missing_items": list[str],     # 아직 답 안 온 항목 (한국어)
        "subject": str,
        "body": str,
        "language": str,
      }
    """
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        return {"needs_reply": False, "needs_human": False, "human_questions": [], "missing_items": [], "subject": "", "body": "", "language": "en"}

    language = _get_language(thread.country)
    conversation = _build_conversation_text(thread)

    prompt = f"""You are a pharmaceutical procurement specialist at a Korean pharma company.
Analyze the latest manufacturer reply and generate an appropriate response.

Ingredient: {thread.ingredient}
Manufacturer: {thread.manufacturer_name} ({thread.country})
Language to use in reply: {language}

Required items we originally asked for:
1. Product availability confirmation
2. COA and GMP certifications
3. Pricing (CIF Busan Port, South Korea)
4. Free sample availability

Full conversation:
{conversation}

Analyze the latest manufacturer reply and respond with ONLY valid JSON:
{{
  "product_available": true/false/null,   // null = not mentioned
  "certifications": true/false/null,
  "pricing_cif": true/false/null,
  "sample": true/false/null,
  "manufacturer_questions": [],           // questions the manufacturer asked us
  "ai_can_answer": [],                    // questions AI can answer (general pharma/logistics)
  "needs_human": [],                      // questions requiring the requester's specific company info
  "supplier_cannot_supply": false,        // true if they explicitly said they can't supply
  "needs_reply": true,                    // false only if conversation is complete
  "reply_subject": "Re: ...",
  "reply_body": "..."                     // write in {language}, professional, concise
}}

For reply_body:
- Thank them for the reply
- Ask specifically about missing items only (don't re-ask answered items)
- Answer any manufacturer questions if ai_can_answer is not empty
- If supplier_cannot_supply: write a polite closing email, no follow-up needed
- Keep it under 150 words"""

    headers = {"Content-Type": "application/json", "X-goog-api-key": api_key}
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 1024},
    }

    models = ["gemini-flash-latest", "gemini-2.0-flash-lite", "gemini-1.5-flash-001"]
    async with httpx.AsyncClient(timeout=30.0) as client:
        for model in models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            try:
                resp = await client.post(url, headers=headers, json=payload)
                if not resp.is_success:
                    continue
                text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                text = re.sub(r"```(?:json)?\s*", "", text).strip().rstrip("`").strip()
                m = re.search(r"\{[\s\S]*\}", text)
                if not m:
                    continue
                data = json.loads(m.group())

                missing = [
                    ITEM_LABELS[k]
                    for k in REQUIRED_ITEMS
                    if data.get(k) is None or data.get(k) is False
                ]

                logger.info("reply_analyzed", manufacturer=thread.manufacturer_name,
                            missing=missing, needs_human=bool(data.get("needs_human")))

                return {
                    "needs_reply": data.get("needs_reply", True) and not data.get("supplier_cannot_supply", False),
                    "supplier_cannot_supply": data.get("supplier_cannot_supply", False),
                    "needs_human": bool(data.get("needs_human")),
                    "human_questions": data.get("needs_human", []),
                    "missing_items": missing,
                    "subject": data.get("reply_subject", f"Re: {thread.subject}"),
                    "body": data.get("reply_body", ""),
                    "language": language,
                }
            except Exception as e:
                logger.warning("reply_agent_model_failed", model=model, error=str(e))
                continue

    return {"needs_reply": False, "needs_human": False, "human_questions": [], "missing_items": [], "subject": "", "body": "", "language": "en"}


async def generate_followup_email(thread: EmailThread, follow_up_num: int) -> dict:
    """24시간 무응답 팔로업 이메일 생성"""
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        return {"subject": "", "body": ""}

    language = _get_language(thread.country)
    original_email = thread.conversation[0]["body"] if thread.conversation else ""

    prompt = f"""Write a brief follow-up email in {language}.

Manufacturer: {thread.manufacturer_name} ({thread.country})
Ingredient: {thread.ingredient}
Follow-up number: {follow_up_num}

Original email we sent:
{original_email[:500]}

Write a polite follow-up. Keep it under 80 words. Reference the original inquiry.
Return ONLY valid JSON: {{"subject": "...", "body": "..."}}"""

    headers = {"Content-Type": "application/json", "X-goog-api-key": api_key}
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 512},
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        for model in ["gemini-flash-latest", "gemini-2.0-flash-lite"]:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            try:
                resp = await client.post(url, headers=headers, json=payload)
                if not resp.is_success:
                    continue
                text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                text = re.sub(r"```(?:json)?\s*", "", text).strip().rstrip("`").strip()
                m = re.search(r"\{[\s\S]*\}", text)
                if m:
                    data = json.loads(m.group())
                    return {"subject": data.get("subject", f"Re: {thread.subject}"), "body": data.get("body", "")}
            except Exception:
                continue

    return {"subject": f"Follow-up: {thread.subject}", "body": ""}
