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


_REGION_MAP = {
    "china":  "China (including Hong Kong)",
    "india":  "India",
    "europe": "Europe (Germany, Italy, Netherlands, France, Spain, UK)",
    "usa":    "USA",
    "korea":  "South Korea",
    "other":  "Japan, Taiwan, and other countries",
}


def _build_prompt(
    ingredient: str,
    use_case: UseCase,
    regulatory_requirements: list[str],
    regions: list[str] | None = None,
    sourcing_notes: str = "",
) -> str:
    req_list = ", ".join(regulatory_requirements) if regulatory_requirements else "Standard GMP"
    notes = f"\nSourcing context: {sourcing_notes}" if sourcing_notes.strip() else ""

    if regions:
        region_str = ", ".join(_REGION_MAP.get(r.lower(), r) for r in regions)
        region_instruction = (
            f"ONLY include manufacturers physically located in: {region_str}. "
            f"Do NOT include manufacturers from any other country."
        )
    else:
        region_instruction = "Focus on China, India, Europe (Germany, Italy, Netherlands), USA."

    return (
        f"List 10 real manufacturers that PRODUCE '{ingredient}' (not distributors).\n"
        f"Use case: {use_case.value} | Certifications: {req_list}\n"
        f"{region_instruction}\n"
        f"{notes}\n"
        f"Return JSON only: {{\"manufacturers\":[{{\"name\":\"\",\"country\":\"\",\"city\":\"\","
        f"\"contact_email\":\"\",\"website\":\"\",\"certifications\":[],\"confidence_score\":0.9}}]}}"
    )


# ─── OpenAI-compatible 직접 호출 ───────────────────────────────
def _extract_manufacturers(text: str) -> list[dict]:
    """JSON 텍스트에서 manufacturers 배열 추출 (마크다운 코드블록 허용)"""
    import re
    # 마크다운 코드블록 제거
    text = re.sub(r"```(?:json)?\s*", "", text).strip().rstrip("`").strip()

    def _from_parsed(data) -> list[dict] | None:
        if isinstance(data, list) and data:
            return data
        if isinstance(data, dict):
            # 알려진 키 우선
            for key in ("manufacturers", "results", "data", "items", "companies", "suppliers"):
                if key in data and isinstance(data[key], list) and data[key]:
                    return data[key]
            # 딕셔너리 내 첫 번째 list 값 사용
            for v in data.values():
                if isinstance(v, list) and v and isinstance(v[0], dict):
                    return v
        return None

    try:
        result = _from_parsed(json.loads(text))
        if result is not None:
            return result
    except json.JSONDecodeError:
        pass

    # JSON 블록 탐색 (텍스트 안에 포함된 경우)
    for pattern in (r"\[[\s\S]*\]", r"\{[\s\S]*\}"):
        match = re.search(pattern, text)
        if match:
            try:
                result = _from_parsed(json.loads(match.group()))
                if result is not None:
                    return result
            except Exception:
                pass

    return []


async def _query_gemini_native(
    api_key: str,
    system_prompt: str,
    user_prompt: str,
    timeout: float = 90.0,
) -> list[dict]:
    """Gemini 네이티브 generateContent API 직접 호출 — 모델명 자동 폴백"""
    if not api_key:
        raise ValueError("GEMINI_API_KEY not configured")

    full_prompt = f"{system_prompt}\n\n{user_prompt}\n\nReturn ONLY valid JSON, no markdown."
    payload = {
        "contents": [{"parts": [{"text": full_prompt}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 4096},
    }

    # AI Studio cURL 방식 그대로 — X-goog-api-key 헤더 + gemini-flash-latest
    headers = {"Content-Type": "application/json", "X-goog-api-key": api_key}
    models_to_try = [
        "gemini-flash-latest",
        "gemini-2.0-flash-lite",
        "gemini-2.0-flash-001",
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-1.5-flash-001",
    ]

    errors: list[str] = []
    async with httpx.AsyncClient(timeout=timeout) as client:
        for model in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            try:
                resp = await client.post(url, headers=headers, json=payload)
                if not resp.is_success:
                    errors.append(f"{model} → {resp.status_code}: {resp.text[:200]}")
                    logger.warning("gemini_attempt_failed", model=model, status=resp.status_code)
                    continue
                rjson = resp.json()
                # 안전 필터 차단 확인
                feedback = rjson.get("promptFeedback", {})
                if feedback.get("blockReason"):
                    errors.append(f"{model}: blocked by safety filter ({feedback['blockReason']})")
                    continue
                candidates = rjson.get("candidates", [])
                if not candidates:
                    errors.append(f"{model}: empty candidates. response={str(rjson)[:200]}")
                    continue
                candidate = candidates[0]
                finish = candidate.get("finishReason", "")
                if "content" not in candidate:
                    errors.append(f"{model}: no content field (finishReason={finish})")
                    continue
                content = candidate["content"]["parts"][0]["text"]
                logger.info("gemini_raw_response", model=model, preview=content[:600])
                result = _extract_manufacturers(content)
                if not result:
                    errors.append(f"{model}: 0 manufacturers parsed. content={content[:300]}")
                    continue
                logger.info("gemini_success", model=model, count=len(result))
                return result
            except Exception as e:
                errors.append(f"{model}: {e}")
                continue

    raise RuntimeError("All Gemini models failed:\n" + "\n".join(errors))


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
            raw_items = await _query_gemini_native(
                api_key=settings.GEMINI_API_KEY or "",
                system_prompt=SYSTEM_PROMPT,
                user_prompt=prompt,
            )
        elif provider == LLMProvider.QWEN:
            raw_items = await _query_gemini_native(
                api_key=settings.GEMINI_API_KEY or "",
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
        validate_errors = []
        for item in raw_items:
            try:
                # 필드명 정규화 (LLM마다 다른 키 사용)
                for alt, canonical in [
                    ("manufacturer_name", "name"), ("company_name", "name"),
                    ("company", "name"), ("manufacturer", "name"),
                    ("nation", "country"), ("location", "country"),
                    ("email", "contact_email"), ("contact", "contact_email"),
                    ("url", "website"), ("homepage", "website"),
                    ("score", "confidence_score"), ("confidence", "confidence_score"),
                ]:
                    if alt in item and canonical not in item:
                        item[canonical] = item[alt]
                item["source_llm"] = provider
                # confidence_score가 100점 만점이면 0~1로 변환
                cs = item.get("confidence_score")
                if isinstance(cs, (int, float)) and cs > 1:
                    item["confidence_score"] = cs / 100.0
                manufacturers.append(RawManufacturer.model_validate(item))
            except Exception as e:
                validate_errors.append(str(e)[:80])

        if validate_errors and not manufacturers:
            logger.warning("all_validate_failed", sample=validate_errors[:2], raw_count=len(raw_items))
            return provider, [], f"Validation failed for all {len(raw_items)} items: {validate_errors[0]}"

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
    regions: list[str] | None = None,
    progress_callback=None,
) -> dict:
    if providers is None:
        providers = [LLMProvider.GEMINI]

    prompt = _build_prompt(
        ingredient=ingredient,
        use_case=use_case,
        regulatory_requirements=regulatory_requirements,
        regions=regions,
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
