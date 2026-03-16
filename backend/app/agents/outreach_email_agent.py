"""
초기 아웃리치 이메일 생성 에이전트 (Gemini 직접 httpx 호출)
- 제조원 국가에 맞는 언어로 이메일 생성
- 고객사명은 절대 제목/본문에 포함하지 않음
"""
import httpx
import json
import structlog

from ..config import get_settings

logger = structlog.get_logger()
settings = get_settings()

_COUNTRY_LANGUAGE: dict[str, str] = {
    "China": "Chinese (Simplified)",
    "Taiwan": "Chinese (Traditional)",
    "Hong Kong": "Chinese (Traditional)",
    "Japan": "Japanese",
    "Germany": "German",
    "France": "French",
    "Italy": "Italian",
    "Spain": "Spanish",
}


def _get_language(country: str) -> str:
    for key, lang in _COUNTRY_LANGUAGE.items():
        if key.lower() in country.lower():
            return lang
    return "English"


def _clean_notes(sourcing_notes: str) -> str:
    """고객사명 라인 제거 (제조원 노출 방지)"""
    hide_prefix = "[유객사명]"  # [고객사명]
    lines = [l for l in sourcing_notes.splitlines()
             if not l.startswith(hide_prefix)]
    return "\n".join(lines).strip()


async def generate_initial_email(
    manufacturer_name: str,
    manufacturer_country: str,
    ingredient: str,
    use_case: str,
    requirements: list[str],
    sourcing_notes: str,
    requester_name: str,
) -> tuple[str, str]:
    api_key = settings.GEMINI_API_KEY or ""
    if not api_key:
        return _fallback_email(manufacturer_name, ingredient, requester_name)

    language = _get_language(manufacturer_country)
    req_str = ", ".join(requirements) if requirements else "GMP"
    notes_clean = _clean_notes(sourcing_notes or "")
    context_part = ("Additional context: " + notes_clean + "\n") if notes_clean else ""

    prompt_lines = [
        "Write a professional pharmaceutical ingredient sourcing inquiry email.",
        "",
        "Manufacturer: " + manufacturer_name + " (" + manufacturer_country + ")",
        "Ingredient: " + ingredient,
        "Use case: " + use_case,
        "Required certifications: " + req_str,
        "Language: " + language,
        "Requester: " + requester_name + " (Korean pharmaceutical company)",
    ]
    if notes_clean:
        prompt_lines.append("Additional context: " + notes_clean)

    prompt_lines += [
        "",
        "IMPORTANT rules:",
        "- Do NOT include end-user or client company name anywhere in subject or body",
        "- Do NOT write phrases like 'due to internal policy' or 'cannot disclose client'",
        "- Do NOT use any placeholder text like [Your Name] or [Company]",
        "- Subject line must only reference the ingredient, not any company name",
        "- Sign off with exactly \"" + requester_name + "\" as the name",
        "",
        "Write the email in " + language + ".",
        "Include: intro as Korean pharma company, product availability, COA/GMP certs,",
        "pricing (CIF Busan port), free sample request.",
        "",
        "Return ONLY valid JSON:",
        "{\"subject\": \"...\", \"body\": \"...\"}",
    ]
    prompt = "\n".join(prompt_lines)

    headers = {"Content-Type": "application/json", "X-goog-api-key": api_key}
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3},
    }
    models = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash-001"]

    async with httpx.AsyncClient(timeout=30.0) as client:
        for model in models:
            url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent"
            try:
                resp = await client.post(url, headers=headers, json=payload)
                if not resp.is_success:
                    continue
                text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                import re
                text = re.sub(r"```(?:json)?\s*", "", text).strip().rstrip("`").strip()
                match = re.search(r"\{[\s\S]*\}", text)
                if match:
                    data = json.loads(match.group())
                    subject = data.get("subject", "Sourcing Inquiry: " + ingredient)
                    body = data.get("body", "")
                    if body:
                        logger.info("outreach_email_generated", model=model, manufacturer=manufacturer_name)
                        return subject, body
            except Exception as e:
                logger.warning("outreach_email_gen_failed", model=model, error=str(e))
                continue

    return _fallback_email(manufacturer_name, ingredient, requester_name)


def _fallback_email(manufacturer_name: str, ingredient: str, requester_name: str) -> tuple[str, str]:
    subject = "Sourcing Inquiry: " + ingredient
    body = (
        "Dear " + manufacturer_name + " Team,\n\n"
        "I hope this message finds you well. My name is " + requester_name + ", "
        "representing a Korean pharmaceutical company.\n\n"
        "We are currently sourcing " + ingredient + " and would like to inquire about "
        "your products and capabilities.\n\n"
        "Could you please provide:\n"
        "1. Product specifications and Certificate of Analysis (COA)\n"
        "2. GMP / regulatory certifications\n"
        "3. Pricing (CIF Busan Port, South Korea)\n"
        "4. Availability of a free sample\n\n"
        "We look forward to the possibility of establishing a business relationship.\n\n"
        "Best regards,\n" + requester_name
    )
    return subject, body
