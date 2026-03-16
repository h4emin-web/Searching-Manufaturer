"""
개발/테스트용 디버그 엔드포인트
- 스레드 수동 등록
- IMAP 즉시 폴링
- LLM 직접 테스트
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


@router.get("/test-llm")
async def test_llm():
    """LLM API 직접 테스트 — 응답 raw 확인용"""
    from ..agents.sourcing_agent import _query_openai_compatible, _query_ollama
    from ..config import get_settings
    settings = get_settings()
    results = {}

    # Gemini
    try:
        items = await _query_openai_compatible(
            base_url="https://generativelanguage.googleapis.com/v1beta/openai",
            api_key=settings.GEMINI_API_KEY or "",
            model="gemini-2.0-flash",
            system_prompt="You are a helpful assistant. Return JSON only.",
            user_prompt='List 2 real pharmaceutical manufacturers of Ibuprofen as JSON: {"manufacturers":[{"name":"...","country":"..."}]}',
            timeout=30.0,
        )
        results["gemini"] = {"status": "ok", "count": len(items), "sample": items[:1]}
    except Exception as e:
        results["gemini"] = {"status": "error", "error": str(e)}

    # Qwen
    try:
        items = await _query_openai_compatible(
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            api_key=settings.QWEN_API_KEY or "",
            model="qwen-plus",
            system_prompt="You are a helpful assistant. Return JSON only.",
            user_prompt='List 2 real pharmaceutical manufacturers of Ibuprofen as JSON: {"manufacturers":[{"name":"...","country":"..."}]}',
            timeout=30.0,
        )
        results["qwen"] = {"status": "ok", "count": len(items), "sample": items[:1]}
    except Exception as e:
        results["qwen"] = {"status": "error", "error": str(e)}

    return results


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


@router.get("/imap-check")
async def imap_check():
    """IMAP 연결 직접 테스트 - 인증 오류 진단용"""
    import imaplib
    from ..config import get_settings
    settings = get_settings()

    imap_user = settings.IMAP_USER or settings.SMTP_USER
    imap_pass = settings.IMAP_PASSWORD or settings.SMTP_PASSWORD

    result = {
        "imap_user": imap_user,
        "imap_password_length": len(imap_pass) if imap_pass else 0,
        "imap_password_preview": imap_pass[:4] + "..." if imap_pass else "(empty)",
        "has_spaces": " " in imap_pass if imap_pass else False,
        "status": None,
        "error": None,
    }

    try:
        with imaplib.IMAP4_SSL("imap.gmail.com", 993) as imap:
            imap.login(imap_user, imap_pass)
            result["status"] = "success"
    except imaplib.IMAP4.error as e:
        result["status"] = "auth_failed"
        result["error"] = str(e)
    except Exception as e:
        result["status"] = "connection_error"
        result["error"] = str(e)

    return result
