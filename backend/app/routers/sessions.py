"""
세션 라우터 - 단계별 상태 유지 (7단계에서 수동 기재해도 이전 데이터 유지)
"""
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..models.schemas import SessionStepData, SessionResponse

router = APIRouter()

# 인메모리 세션 저장소 (실제 운영에서는 Supabase/PostgreSQL)
_sessions: dict[str, dict] = {}


class CreateSessionRequest(BaseModel):
    ingredient_name: str | None = None


class PatchSessionRequest(BaseModel):
    current_step: int | None = None
    max_completed_step: int | None = None
    step_data: dict | None = None   # JSONB partial update


@router.post("/", response_model=SessionResponse)
async def create_session(req: CreateSessionRequest):
    session_id = str(uuid.uuid4())
    _sessions[session_id] = {
        "id": session_id,
        "current_step": 1,
        "max_completed_step": 0,
        "status": "draft",
        "step_data": {},
        "manufacturers": [],
    }
    return SessionResponse(**_sessions[session_id])


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str):
    """세션 전체 상태 조회 - 페이지 리로드 시 상태 복원에 사용"""
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionResponse(**session)


@router.patch("/{session_id}", response_model=SessionResponse)
async def patch_session(session_id: str, req: PatchSessionRequest):
    """
    단계별 상태 저장 (딥 머지).
    step_data는 전체 교체가 아닌 부분 업데이트(deep merge).
    step3에서 step4로 이동해도 step1, step2 데이터 유지됨.
    """
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if req.current_step is not None:
        session["current_step"] = req.current_step
    if req.max_completed_step is not None:
        session["max_completed_step"] = max(
            session["max_completed_step"],
            req.max_completed_step,
        )
    if req.step_data is not None:
        # Deep merge: 기존 step_data + 새 데이터
        existing = session["step_data"]
        for key, value in req.step_data.items():
            if isinstance(value, dict) and isinstance(existing.get(key), dict):
                existing[key] = {**existing[key], **value}
            else:
                existing[key] = value

    return SessionResponse(**session)
