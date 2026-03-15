"""
Multi-LLM 소싱 에이전트 (pydantic-ai 기반)
- Gemini (유료 API), DeepSeek / Qwen / llama3.2 (Ollama 무료 로컬)
- 구조화된 출력 (Pydantic 스키마)
- 각 LLM 오류 격리 (하나 실패해도 나머지 결과 사용)
"""
import asyncio
import json
from typing import AsyncIterator
import structlog
import httpx

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIModel

from ..models.schemas import RawManufacturer, LLMProvider, UseCase
from ..config import get_settings

logger = structlog.get_logger()
settings = get_settings()

# Ollama 직접 API (tool calling 미지원 모델용)
_OLLAMA_DIRECT = "http://localhost:11434"

# Ollama 응답 JSON 스키마
_OLLAMA_SCHEMA = {
    "type": "object",
    "properties": {
        "manufacturers": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name":               {"type": "string"},
                    "country":            {"type": "string"},
                    "country_code":       {"type": ["string", "null"]},
                    "city":               {"type": ["string", "null"]},
                    "contact_email":      {"type": ["string", "null"]},
                    "contact_wechat":     {"type": ["string", "null"]},
                    "contact_whatsapp":   {"type": ["string", "null"]},
                    "website":            {"type": ["string", "null"]},
                    "certifications":     {"type": "array", "items": {"type": "string"}},
                    "products":           {"type": "array", "items": {"type": "string"}},
                    "annual_capacity_kg": {"type": ["number", "null"]},
                    "established_year":   {"type": ["integer", "null"]},
                    "confidence_score":   {"type": "number", "minimum": 0.0, "maximum": 1.0},
                    "source_notes":       {"type": "string"},
                },
                "required": ["name", "country"],
            }
        }
    },
    "required": ["manufacturers"],
}


# ─── 프롬프트 템플릿 ───────────────────────────────────────────
SOURCING_SYSTEM_PROMPT = """
You are a pharmaceutical ingredient sourcing specialist with deep knowledge of global API
and excipient manufacturers. Your task is to identify real, verifiable manufacturers of
pharmaceutical ingredients.

CRITICAL RULES:
1. Only return manufacturers you have HIGH confidence actually exist.
2. Return at least 8-15 manufacturers per query when possible.
3. Prioritize manufacturers with verified GMP certifications.
4. Include specific contact information whenever known (email, WeChat, WhatsApp, website).
5. For Chinese manufacturers, include WeChat contact IDs if known.
6. Return data in the exact JSON structure requested.
"""


def _build_sourcing_prompt(
    ingredient: str,
    use_case: UseCase,
    regulatory_requirements: list[str],
    ingredient_zh: str | None = None,
    sourcing_notes: str = "",
) -> str:
    req_list = ", ".join(regulatory_requirements) if regulatory_requirements else "Standard GMP"
    zh_hint = f" (Chinese: {ingredient_zh})" if ingredient_zh else ""
    notes_section = f"\nSpecial Sourcing Notes (from procurement team):\n{sourcing_notes}" if sourcing_notes.strip() else ""

    return f"""
Find manufacturers of the pharmaceutical ingredient: **{ingredient}**{zh_hint}

Use Case: {use_case.value}
Required Certifications: {req_list}{notes_section}

For each manufacturer, provide:
- Company name (official legal name)
- Country and city of manufacturing site
- Contact email
- Official website URL
- Certifications held (WHO-GMP, CoPP, CEP, ICH Q7, KDMF, etc.)
- Key products manufactured
- Estimated annual capacity if known
- Confidence level (0.0-1.0) in this information

Focus on: China, India, Europe (Germany, Italy, Netherlands), USA manufacturers.
Return minimum 10 manufacturers if possible.
""".strip()


# ─── Ollama 직접 호출 (JSON 스키마 모드) ──────────────────────
async def _query_ollama(model_name: str, system_prompt: str, user_prompt: str) -> list[dict]:
    """tool calling 없이 Ollama JSON 스키마 모드로 직접 호출"""
    async with httpx.AsyncClient(timeout=600.0) as client:
        resp = await client.post(
            f"{_OLLAMA_DIRECT}/api/chat",
            json={
                "model": model_name,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "format": _OLLAMA_SCHEMA,
                "stream": False,
            },
        )
        resp.raise_for_status()
        content = resp.json()["message"]["content"]
        return json.loads(content).get("manufacturers", [])


# ─── LLM별 모델명 매핑 ────────────────────────────────────────
_OLLAMA_MODEL_MAP = {
    LLMProvider.GPT4O:    settings.OLLAMA_GPT_MODEL,
    LLMProvider.DEEPSEEK: settings.OLLAMA_DEEPSEEK_MODEL,
    LLMProvider.QWEN:     settings.OLLAMA_QWEN_MODEL,
}


# ─── 단일 LLM 쿼리 ────────────────────────────────────────────
async def _query_single_llm(
    provider: LLMProvider,
    prompt: str,
) -> tuple[LLMProvider, list[RawManufacturer], str | None]:
    try:
        manufacturers: list[RawManufacturer] = []

        if provider == LLMProvider.GEMINI:
            # Gemini: OpenAI 호환 엔드포인트 사용
            model = OpenAIModel(
                "gemini-2.5-flash",
                base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
                api_key=settings.GEMINI_API_KEY,
            )
            agent = Agent(
                model=model,
                result_type=list[RawManufacturer],
                system_prompt=SOURCING_SYSTEM_PROMPT,
                retries=2,
            )
            result = await agent.run(prompt)
            manufacturers = result.data
            for m in manufacturers:
                m.source_llm = provider

        else:
            # Ollama 로컬 모델: JSON 스키마 모드 직접 호출
            model_name = _OLLAMA_MODEL_MAP[provider]
            raw_items = await _query_ollama(model_name, SOURCING_SYSTEM_PROMPT, prompt)
            for item in raw_items:
                item["source_llm"] = provider
                try:
                    manufacturers.append(RawManufacturer.model_validate(item))
                except Exception:
                    pass  # 개별 항목 파싱 실패는 무시

        logger.info("llm_sourcing_complete", provider=provider.value, count=len(manufacturers))
        return provider, manufacturers, None

    except Exception as exc:
        logger.error("llm_sourcing_failed", provider=provider.value, error=str(exc))
        return provider, [], str(exc)


# ─── 멀티-LLM 동시 쿼리 ───────────────────────────────────────
async def run_multi_llm_sourcing(
    ingredient: str,
    use_case: UseCase,
    regulatory_requirements: list[str],
    providers: list[LLMProvider] | None = None,
    ingredient_zh: str | None = None,
    sourcing_notes: str = "",
    progress_callback: AsyncIterator | None = None,
) -> dict:
    """
    모든 LLM에 동시 쿼리 후 결과 취합
    Returns: {
        "llm_results": {LLMProvider: [RawManufacturer]},
        "errors": {LLMProvider: error_str},
        "total_raw": int,
    }
    """
    if providers is None:
        providers = list(LLMProvider)

    prompt = _build_sourcing_prompt(
        ingredient=ingredient,
        use_case=use_case,
        regulatory_requirements=regulatory_requirements,
        ingredient_zh=ingredient_zh,
        sourcing_notes=sourcing_notes,
    )

    logger.info("multi_llm_sourcing_start", providers=[p.value for p in providers])

    tasks = [_query_single_llm(provider, prompt) for provider in providers]
    results = await asyncio.gather(*tasks, return_exceptions=False)

    llm_results: dict[LLMProvider, list[RawManufacturer]] = {}
    errors: dict[LLMProvider, str] = {}

    for provider, manufacturers, error in results:
        if error:
            errors[provider] = error
        else:
            llm_results[provider] = manufacturers

    total_raw = sum(len(v) for v in llm_results.values())

    logger.info(
        "multi_llm_sourcing_complete",
        total_raw=total_raw,
        successful_providers=list(llm_results.keys()),
        failed_providers=list(errors.keys()),
    )

    return {"llm_results": llm_results, "errors": errors, "total_raw": total_raw}
