"""
개발/테스트용 디버그 엔드포인트
- 스레드 수동 등록
- IMAP 즉시 폴링
"""
import asyncio
from fastapi import APIRouter
from pydantic import BaseModel

from ..services.thread_store import thread_store
from ..services.email_receiver import fetch_replies
from ..services.reply_handler import handle_reply

router = APIRouter()


class RegisterThreadRequest(BaseModel):
    message_id: str
    to_email: str
    manufacturer_name: str
    ingredient: str
    subject: str
    body: str
    country: str = ""


@router.post("/register-thread")
async def register_thread(req: RegisterThreadRequest):
    """수동으로 이메일 스레드 등록 (테스트용)"""
    thread_store.register(
        message_id=req.message_id,
        to_email=req.to_email,
        manufacturer_name=req.manufacturer_name,
        ingredient=req.ingredient,
        subject=req.subject,
        body=req.body,
        country=req.country,
    )
    return {"status": "registered", "message_id": req.message_id}


@router.post("/poll-now")
async def poll_now():
    """IMAP 즉시 폴링 (5분 기다리지 않고 바로 체크)"""
    replies = await fetch_replies()
    processed = 0
    for reply in replies:
        await handle_reply(reply)
        processed += 1
    return {"status": "done", "replies_found": len(replies), "processed": processed}


@router.get("/threads")
async def list_threads():
    """등록된 스레드 목록"""
    return [
        {
            "message_id": t.message_id,
            "manufacturer": t.manufacturer_name,
            "to_email": t.to_email,
            "ingredient": t.ingredient,
            "auto_reply_count": t.auto_reply_count,
            "conversation_turns": len(t.conversation),
        }
        for t in thread_store.all_threads()
    ]
