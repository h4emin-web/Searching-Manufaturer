"""
초기 아웃리치 이메일 생성 에이전트 (Gemini 직접 httpx 호출)
- 제조원 국가에 맞는 언어로 이메일 생성
- 설문 정보(고객사, 용도, 요건 등) 반영
"""
import httpx
import json
import structlog

from ..config import get_settings

logger = structlog.get_logger()
settings = get_settings()

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


def _get_language(country: str) -> str:
    for key, lang in _COUNTRY_LANGUAGE.items():
        if key.lower() in country.lower():
            return lang
    return "English"


async def generate_initial_email(
    manufacturer_name: str,
    manufacturer_country: str,
    ingredient: str,
    use_case: str,
    requirements: list[str],
    sourcing_notes: str,
    requester_name: str,
) -> tuple[str, str]:
    """
    초기 아웃리치 이메일 생성
    Returns: (subject, body)
    """
    api_key = settings.GEMINI_API_KEY or ""
    if not api_key:
        return _fallback_email(manufacturer_name, ingredient, requester_name)

    language = _get_language(manufacturer_country)
    req_str = ", ".join(requirements) if requirements else "GMP"

    prompt = f"""Write a professional pharmaceutical ingredient sourcing inquiry email.

Manufacturer: {manufacturer_name} ({manufacturer_country})
Ingredient: {ingredient}
Use case: {use_case}
Required certifications: {req_str}
Language to use: {language}
Requester: {requester_name} (Korean pharmaceutical company)

{f'Additional context: {sourcing_notes}' if sourcing_notes else ''}

Write the email in {language}.
Include:
1. Brief introduction of who we are (Korean pharma company)
2. Specific request for: product availability, certifications (COA, GMP certificate), pricing (CIF Busan port), and free sample
3. Professional closing — sign off with exactly "{requester_name}" as the name, no placeholders like [Your Name] or [Your Title]

Return ONLY valid JSON:
{{"subject": "...", "body": "..."}}
"""

    headers = {"Content-Type": "application/json", "X-goog-api-key": api_key}
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3},
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
                # JSON 추출
                import re
                text = re.sub(r"```(?:json)?\s*", "", text).strip().rstrip("`").strip()
                match = re.search(r"\{[\s\S]*\}", text)
                if match:
                    data = json.loads(match.group())
                    subject = data.get("subject", f"Sourcing Inquiry: {ingredient}")
                    body = data.get("body", "")
                    if body:
                        logger.info("outreach_email_generated", model=model, manufacturer=manufacturer_name)
                        return subject, body
            except Exception as e:
                logger.warning("outreach_email_gen_failed", model=model, error=str(e))
                continue

    return _fallback_email(manufacturer_name, ingredient, requester_name)


def _fallback_email(manufacturer_name: str, ingredient: str, requester_name: str) -> tuple[str, str]:
    subject = f"Sourcing Inquiry: {ingredient}"
    body = f"""Dear {manufacturer_name} Team,

I hope this message finds you well. My name is {requester_name}, representing a Korean pharmaceutical company.

We are currently sourcing {ingredient} and would like to inquire about your products and capabilities.

Could you please provide:
1. Product specifications and Certificate of Analysis (COA)
2. GMP / regulatory certifications
3. Pricing (CIF Busan Port, South Korea)
4. Availability of a free sample

We look forward to the possibility of establishing a business relationship with your company.

Best regards,
{requester_name}
"""
    return subject, body
