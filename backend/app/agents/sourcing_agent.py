"""
Multi-LLM 소싱 에이전트 — httpx 직접 호출 (pydantic-ai 제거)
- Gemini / Qwen: OpenAI-compatible API, JSON mode, 단일 호출
- Ollama: 로컬 fallback
"""
import asyncio
import json
import httpx
import structlog

from ..models.schemas import RawManufacturer, LLMProvider, UseCase
from ..config import get_settings

logger = structlog.get_logger()
settings = get_settings()

# ─── 공통 JSON 스키마 ──────────────────────────────────────────
_SCHEMA = {
    "type": "object",
    "properties": {
        "manufacturers": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name":               {"type": "string"},
                    "country":            {"type": "string"},
                    "city":               {"type": ["string", "null"]},
                    "contact_email":      {"type": ["string", "null"]},
                    "website":            {"type": ["string", "null"]},
                    "certifications":     {"type": "array", "items": {"type": "string"}},
                    "confidence_score":   {"type": "number"},
                },
                "required": ["name", "country"],
            }
        }
    },
    "required": ["manufacturers"],
}

SYSTEM_PROMPT = (
    "You are a pharmaceutical ingredient sourcing specialist. "
    "Identify real, verifiable manufacturers of pharmaceutical ingredients. "
    "Return ONLY a JSON object matching the requested schema. "
    "Include 10-15 manufacturers with high confidence. "
    "Include contact emails and websites when known."
)


def _build_prompt(
    ingredient: str,
    use_case: UseCase,
    regulatory_requirements: list[str],
    sourcing_notes: str = "",
) -> str:
    req_list = ", ".join(regulatory_requirements) if regulatory_requirements else "Standard GMP"
    notes = f"\nSpecial notes: {sourcing_notes}" if sourcing_notes.strip() else ""
    return (
        f"Find manufacturers of: {ingredient}\n"
        f"Use case: {use_case.value}\n"
        f"Required certifications: {req_list}{notes}\n"
        f"Focus on China, India, Europe (Germany, Italy, Netherlands), USA.\n"
        f"Return minimum 10 manufacturers."
    )


# ─── OpenAI-compatible 직접 호출 ───────────────────────────────
def _extract_manufacturers(text: str) -> list[dict]:
    """JSON 텍스트에서 manufacturers 배열 추출 (마크다운 코드블록 허용)"""
    import re
    # 마크다운 코드블록 제거
    text = re.sub(r"```(?:json)?\s*", "", text).strip().rstrip("`").strip()
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            # {"manufacturers": [...]} 형태
            for key in ("manufacturers", "results", "data", "items"):
                if key in data and isinstance(data[key], list):
                    return data[key]
    except json.JSONDecodeError:
        # JSON 블록 탐색
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            try:
                data = json.loads(match.group())
                if isinstance(data, dict):
                    for key in ("manufacturers", "results", "data", "items"):
                        if key in data and isinstance(data[key], list):
                            return data[key]
            except Exception:
                pass
    return []


async def _query_openai_compatible(
    base_url: str,
    api_key: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    timeout: float = 90.0,
) -> list[dict]:
    if not api_key:
        raise ValueError(f"API key not configured for {base_url}")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
        "max_tokens": 4096,
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            f"{base_url.rstrip('/')}/chat/completions",
            headers=headers,
            json=payload,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        result = _extract_manufacturers(content)
        logger.info("api_response_parsed", base_url=base_url, count=len(result), raw_length=len(content))
        return result


# ─── Ollama 직접 호출 ──────────────────────────────────────────
async def _query_ollama(model_name: str, system_prompt: str, user_prompt: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            "http://localhost:11434/api/chat",
            json={
                "model": model_name,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "format": _SCHEMA,
                "stream": False,
            },
        )
        resp.raise_for_status()
        content = resp.json()["message"]["content"]
        return json.loads(content).get("manufacturers", [])


# ─── 단일 LLM 쿼리 ────────────────────────────────────────────
async def _query_single_llm(
    provider: LLMProvider,
    prompt: str,
) -> tuple[LLMProvider, list[RawManufacturer], str | None]:
    try:
        raw_items: list[dict] = []

        if provider == LLMProvider.GEMINI:
            raw_items = await _query_openai_compatible(
                base_url="https://generativelanguage.googleapis.com/v1beta/openai",
                api_key=settings.GEMINI_API_KEY or "",
                model="gemini-2.0-flash",
                system_prompt=SYSTEM_PROMPT,
                user_prompt=prompt,
            )
        elif provider == LLMProvider.QWEN:
            raw_items = await _query_openai_compatible(
                base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                api_key=settings.QWEN_API_KEY or "",
                model="qwen-plus",
                system_prompt=SYSTEM_PROMPT,
                user_prompt=prompt,
            )
        else:
            model_map = {
                LLMProvider.GPT4O:    settings.OLLAMA_GPT_MODEL,
                LLMProvider.DEEPSEEK: settings.OLLAMA_DEEPSEEK_MODEL,
            }
            model_name = model_map.get(provider, "qwen2.5:7b")
            raw_items = await _query_ollama(model_name, SYSTEM_PROMPT, prompt)

        manufacturers: list[RawManufacturer] = []
        for item in raw_items:
            try:
                item["source_llm"] = provider
                manufacturers.append(RawManufacturer.model_validate(item))
            except Exception:
                pass

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
    progress_callback=None,
) -> dict:
    if providers is None:
        providers = [LLMProvider.GEMINI, LLMProvider.QWEN]

    prompt = _build_prompt(
        ingredient=ingredient,
        use_case=use_case,
        regulatory_requirements=regulatory_requirements,
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
    logger.info("multi_llm_sourcing_complete", total_raw=total_raw)

    return {"llm_results": llm_results, "errors": errors, "total_raw": total_raw}
