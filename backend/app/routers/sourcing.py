"""
소싱 라우터 - Multi-LLM 제조소 검색 + 중복 제거
"""
import asyncio
import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from ..models.schemas import SourcingRequest, SourcingResult, LLMProvider
from ..agents.sourcing_agent import run_multi_llm_sourcing
from ..services.deduplication import deduplicate_manufacturers
from ..config import get_settings

router = APIRouter()
settings = get_settings()

# 인메모리 태스크 저장소 (실제 운영에서는 Redis/DB 사용)
_tasks: dict[str, SourcingResult] = {}


class SuggestIngredientRequest(BaseModel):
    name: str


@router.post("/suggest-ingredient")
async def suggest_ingredient(req: SuggestIngredientRequest):
    """원료명 오타 검사 및 교정 제안"""
    if not req.name.strip():
        return {"suggested": None}

    api_key = settings.GEMINI_API_KEY
    if not api_key:
        return {"suggested": None}

    prompt = (
        f"The user typed this pharmaceutical ingredient name: \"{req.name}\"\n\n"
        "1. If this is already a correct pharmaceutical ingredient name (API, excipient, or chemical), return it as-is.\n"
        "2. If it looks like a typo or misspelling, return the correct name.\n"
        "3. If it's completely unrecognizable, return null.\n\n"
        "Return ONLY valid JSON: {\"suggested\": \"Corrected Name\"} or {\"suggested\": null}"
    )

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0, "maxOutputTokens": 64},
    }
    headers = {"Content-Type": "application/json", "X-goog-api-key": api_key}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
                headers=headers, json=payload,
            )
        if not resp.is_success:
            return {"suggested": None}
        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        import re, json as _json
        m = re.search(r"\{[\s\S]*\}", text)
        if m:
            data = _json.loads(m.group())
            return {"suggested": data.get("suggested")}
    except Exception:
        pass
    return {"suggested": None}


class SourcingResponse(BaseModel):
    task_id: str
    message: str


@router.post("/run", response_model=SourcingResponse)
async def start_sourcing(req: SourcingRequest, background_tasks: BackgroundTasks):
    """소싱 태스크 시작 (비동기 백그라운드)"""
    import uuid
    task_id = str(uuid.uuid4())

    _tasks[task_id] = SourcingResult(
        task_id=task_id,
        status="queued",
        progress=0,
    )

    background_tasks.add_task(_run_sourcing, task_id, req)
    return SourcingResponse(task_id=task_id, message="Sourcing started")


@router.get("/{task_id}", response_model=SourcingResult)
async def get_sourcing_status(task_id: str):
    """소싱 태스크 상태 조회"""
    result = _tasks.get(task_id)
    if not result:
        raise HTTPException(status_code=404, detail="Task not found")
    return result


@router.delete("/{task_id}")
async def cancel_sourcing(task_id: str):
    """소싱 태스크 취소"""
    if task_id in _tasks:
        _tasks[task_id].status = "failed"
        _tasks[task_id].error = "cancelled"
    return {"message": "cancelled"}


async def _run_sourcing(task_id: str, req: SourcingRequest):
    """백그라운드 소싱 실행"""
    try:
        _tasks[task_id].status = "running"
        _tasks[task_id].progress = 10

        # 1. Multi-LLM 소싱
        raw_result = await run_multi_llm_sourcing(
            ingredient=req.ingredient_name,
            use_case=req.use_case,
            regulatory_requirements=req.regulatory_requirements,
            sourcing_notes=req.sourcing_notes,
            regions=req.regions,
            providers=req.llm_providers,
        )
        _tasks[task_id].progress = 70
        _tasks[task_id].llm_results = raw_result["llm_results"]
        _tasks[task_id].total_raw = raw_result["total_raw"]

        # LLM 에러 또는 0개 결과 처리
        errors = raw_result.get("errors", {})
        if raw_result["total_raw"] == 0:
            err_msg = " | ".join(f"{k.value}: {str(v)[:120]}" for k, v in errors.items()) if errors else "LLM 응답에서 제조소를 파싱하지 못했습니다"
            _tasks[task_id].status = "failed"
            _tasks[task_id].error = err_msg
            return
        elif errors:
            _tasks[task_id].error = " | ".join(f"{k.value}: {str(v)[:80]}" for k, v in errors.items())

        # 2. 중복 제거 + 병합
        dedup_result = deduplicate_manufacturers(raw_result["llm_results"])
        _tasks[task_id].progress = 100
        _tasks[task_id].deduplicated = dedup_result.manufacturers
        _tasks[task_id].total_deduplicated = dedup_result.total_deduplicated
        _tasks[task_id].status = "completed"

    except Exception as exc:
        _tasks[task_id].status = "failed"
        _tasks[task_id].error = str(exc)
