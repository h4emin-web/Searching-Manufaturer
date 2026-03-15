"""
소싱 라우터 - Multi-LLM 제조소 검색 + 중복 제거
"""
import asyncio
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from ..models.schemas import SourcingRequest, SourcingResult, LLMProvider
from ..agents.sourcing_agent import run_multi_llm_sourcing
from ..services.deduplication import deduplicate_manufacturers

router = APIRouter()

# 인메모리 태스크 저장소 (실제 운영에서는 Redis/DB 사용)
_tasks: dict[str, SourcingResult] = {}


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
