"""
사용자별 소싱 요청 저장/조회 (Supabase 기반, fallback 인메모리)
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import json
import httpx
from datetime import datetime

from ..db import get_supabase
from ..config import get_settings

settings = get_settings()

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
    notes: list[str] = []


class SaveRequestBody(BaseModel):
    request: UserRequest


class UpdateRequestBody(BaseModel):
    status: Optional[str] = None
    task_id: Optional[str] = None
    total_found: Optional[int] = None
    sent: Optional[int] = None
    replied: Optional[int] = None
    notes: Optional[list[str]] = None


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
                if isinstance(row.get("notes"), str):
                    row["notes"] = json.loads(row["notes"])
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
            for row in rows:
                if isinstance(row.get("requirements"), str):
                    row["requirements"] = json.loads(row["requirements"])
                if isinstance(row.get("notes"), str):
                    row["notes"] = json.loads(row["notes"])
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
                "notes": json.dumps(req.notes),
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


@router.post("/{user_name}/requests/{request_id}/briefing")
async def generate_briefing(user_name: str, request_id: str):
    """Gemini로 현재 진행상황 자동 브리핑 생성 후 notes에 저장"""
    # 현재 요청 데이터 로드
    req_data = None
    db = get_supabase()
    if db:
        try:
            rows = await db.select("user_requests", {"id": request_id, "user_name": user_name})
            if rows:
                req_data = rows[0]
                if isinstance(req_data.get("notes"), str):
                    req_data["notes"] = json.loads(req_data["notes"])
        except Exception:
            pass
    if not req_data:
        for req in _memory.get(user_name, []):
            if req["id"] == request_id:
                req_data = req
                break
    if not req_data:
        return {"ok": False, "error": "Request not found"}

    STATUS_KO = {
        "searching": "AI 제조소 검색 중",
        "reviewing": "제조소 검토 대기",
        "outreach": "연락 발송 완료",
        "monitoring": "응답 대기",
        "negotiating": "협의 진행 중",
        "completed": "완료",
    }

    prompt = f"""You are a pharmaceutical sourcing agent. Write a concise Korean status briefing (2-3 sentences max) for the following sourcing request.

Ingredient: {req_data.get('ingredient_name')}
Status: {STATUS_KO.get(req_data.get('status', ''), req_data.get('status', ''))}
Manufacturers found: {req_data.get('total_found', 0)}
Emails sent: {req_data.get('sent', 0)}
Replies received: {req_data.get('replied', 0)}
Date: {datetime.now().strftime('%Y-%m-%d')}

Write a brief status update in Korean. Be specific about numbers. No pleasantries.
Return ONLY valid JSON: {{"briefing": "..."}}"""

    api_key = settings.GEMINI_API_KEY
    briefing_text = None
    if api_key:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
                    headers={"Content-Type": "application/json", "X-goog-api-key": api_key},
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 256},
                    },
                )
            if resp.is_success:
                import re
                text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                text = re.sub(r"```(?:json)?\s*", "", text).strip().rstrip("`")
                m = re.search(r"\{[\s\S]*\}", text)
                if m:
                    briefing_text = json.loads(m.group()).get("briefing")
        except Exception:
            pass

    if not briefing_text:
        sent = req_data.get('sent', 0)
        replied = req_data.get('replied', 0)
        briefing_text = f"{req_data.get('ingredient_name')} — {req_data.get('total_found', 0)}개 제조소 확인, {sent}곳 연락 발송, {replied}곳 응답 수신."

    now_str = datetime.now().strftime("%m/%d %H:%M")
    new_note = f"[{now_str}] {briefing_text}"
    existing_notes = req_data.get("notes") or []
    # 오늘 날짜 브리핑이 이미 있으면 교체, 없으면 추가
    today_prefix = f"[{datetime.now().strftime('%m/%d')}"
    new_notes = [n for n in existing_notes if not n.startswith(today_prefix)] + [new_note]

    # 저장
    update_body = UpdateRequestBody(notes=new_notes)
    await update_user_request(user_name, request_id, update_body)
    return {"ok": True, "briefing": new_note, "notes": new_notes}


@router.patch("/{user_name}/requests/{request_id}")
async def update_user_request(user_name: str, request_id: str, body: UpdateRequestBody):
    """소싱 요청 상태 업데이트"""
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "notes" in updates:
        updates["notes"] = json.dumps(updates["notes"])
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
