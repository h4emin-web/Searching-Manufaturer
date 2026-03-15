"""
사용자별 소싱 요청 저장/조회 (Supabase 기반, fallback 인메모리)
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import json

from ..db import get_supabase

router = APIRouter()

# Supabase 없을 때 인메모리 폴백
_memory: dict[str, list[dict]] = {}


class UserRequest(BaseModel):
    id: str
    ingredient_name: str
    purpose: str
    requirements: list[str] = []
    status: str = "searching"
    task_id: Optional[str] = None
    total_found: int = 0
    sent: int = 0
    replied: int = 0
    created_at: str


class SaveRequestBody(BaseModel):
    request: UserRequest


class UpdateRequestBody(BaseModel):
    status: Optional[str] = None
    task_id: Optional[str] = None
    total_found: Optional[int] = None
    sent: Optional[int] = None
    replied: Optional[int] = None


@router.get("/requests/all")
async def get_all_requests():
    """모든 사용자의 소싱 요청 목록 조회"""
    db = get_supabase()
    if db:
        try:
            rows = await db.select("user_requests")
            for row in rows:
                if isinstance(row.get("requirements"), str):
                    row["requirements"] = json.loads(row["requirements"])
            rows.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            return rows
        except Exception:
            pass
    # 폴백 - 모든 사용자 합산
    all_rows: list[dict] = []
    for reqs in _memory.values():
        all_rows.extend(reqs)
    all_rows.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return all_rows


@router.get("/{user_name}/requests")
async def get_user_requests(user_name: str):
    """사용자의 소싱 요청 목록 조회"""
    db = get_supabase()
    if db:
        try:
            rows = await db.select("user_requests", {"user_name": user_name})
            # requirements는 JSON 문자열로 저장됨
            for row in rows:
                if isinstance(row.get("requirements"), str):
                    row["requirements"] = json.loads(row["requirements"])
            rows.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            return rows
        except Exception:
            pass
    # 폴백
    return _memory.get(user_name, [])


@router.post("/{user_name}/requests")
async def save_user_request(user_name: str, body: SaveRequestBody):
    """소싱 요청 저장 (upsert)"""
    req = body.request
    db = get_supabase()
    if db:
        try:
            await db.upsert("user_requests", {
                "id": req.id,
                "user_name": user_name,
                "ingredient_name": req.ingredient_name,
                "purpose": req.purpose,
                "requirements": json.dumps(req.requirements),
                "status": req.status,
                "task_id": req.task_id,
                "total_found": req.total_found,
                "sent": req.sent,
                "replied": req.replied,
                "created_at": req.created_at,
            })
            return {"ok": True}
        except Exception:
            pass
    # 폴백
    requests = _memory.setdefault(user_name, [])
    existing = next((i for i, r in enumerate(requests) if r["id"] == req.id), None)
    data = req.model_dump()
    if existing is not None:
        requests[existing] = data
    else:
        requests.insert(0, data)
    return {"ok": True}


@router.patch("/{user_name}/requests/{request_id}")
async def update_user_request(user_name: str, request_id: str, body: UpdateRequestBody):
    """소싱 요청 상태 업데이트"""
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    db = get_supabase()
    if db:
        try:
            await db.update("user_requests", updates, {"id": request_id, "user_name": user_name})
            return {"ok": True}
        except Exception:
            pass
    # 폴백
    requests = _memory.get(user_name, [])
    for req in requests:
        if req["id"] == request_id:
            req.update(updates)
            break
    return {"ok": True}
