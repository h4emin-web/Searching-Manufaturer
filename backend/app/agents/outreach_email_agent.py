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
        "Language: " + language,
        "",
        "Use EXACTLY this structure and tone:",
        "---",
        "Subject: [Acebiopharm] Product inquiry_" + ingredient,
        "",
        "Dear Sir/Madam,",
        "Good day",
        "",
        "My name is Mason from Acebiopharm, a leading distributor dealing with pharmaceutical materials, food and cosmetics from South Korea.",
        "",
        "It's a huge pleasure to contact you for the first time.",
        "Currently we are looking for \"" + ingredient + "\" which we surveyed that it is being produced by your company.",
        "",
        "In order to proceed the importing review process, we would like to kindly request the following information for our reference:",
        "",
        "1. Pricing for MOQ based on CIF term",
        "2. WHO-GMP, SMF certificate (or COPP)",
        "3. Latest Certificate of Analysis (COA)",
        "4. Packing unit",
        "5. Estimated lead time",
        "6. Possibility of receiving samples for evaluation",
        "",
        "We hope this will be the start of a mutually beneficial relationship.",
        "If you have any inquiries about us, please feel free to reach out!",
        "I look forward to your reply.",
        "",
        "Thank you.",
        "Have a nice day!",
        "Best regards, Mason",
        "---",
        "",
        "If language is not English, translate the body naturally into " + language + " while keeping the same structure.",
        "The subject must always be in English: [Acebiopharm] Product inquiry_" + ingredient,
        "",
        "Return ONLY valid JSON:",
        "{\"subject\": \"[Acebiopharm] Product inquiry_" + ingredient + "\", \"body\": \"...\"}",
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
    subject = "[Acebiopharm] Product inquiry_" + ingredient
    body = (
        "Dear Sir/Madam,\n"
        "Good day\n\n"
        "My name is Mason from Acebiopharm, a leading distributor dealing with pharmaceutical materials, food and cosmetics from South Korea.\n\n"
        "It's a huge pleasure to contact you for the first time.\n"
        "Currently we are looking for \"" + ingredient + "\" which we surveyed that it is being produced by your company.\n\n"
        "In order to proceed the importing review process, we would like to kindly request the following information for our reference:\n\n"
        "1. Pricing for MOQ based on CIF term\n"
        "2. WHO-GMP, SMF certificate (or COPP)\n"
        "3. Latest Certificate of Analysis (COA)\n"
        "4. Packing unit\n"
        "5. Estimated lead time\n"
        "6. Possibility of receiving samples for evaluation\n\n"
        "We hope this will be the start of a mutually beneficial relationship.\n"
        "If you have any inquiries about us, please feel free to reach out!\n"
        "I look forward to your reply.\n\n"
        "Thank you.\n"
        "Have a nice day!\n"
        "Best regards, Mason"
    )
    return subject, body
