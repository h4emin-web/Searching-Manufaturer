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
            model="gemini-2.5-flash",
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
    """등록된 스레드 목록 (자동답변 진단용)"""
    from ..routers import outreach as outreach_router
    all_plans = list(outreach_router._simple_plans.keys())
    return {
        "total_threads": len(thread_store.all_threads()),
        "plans_in_memory": all_plans,
        "threads": [
            {
                "message_id": t.message_id,
                "last_message_id": t.last_message_id,
                "manufacturer": t.manufacturer_name,
                "to_email": t.to_email,
                "ingredient": t.ingredient,
                "plan_id": t.plan_id,
                "has_reply": t.has_reply,
                "auto_reply_count": t.auto_reply_count,
                "follow_up_count": t.follow_up_count,
                "conversation_turns": len(t.conversation),
                "last_sent_at": t.last_sent_at,
            }
            for t in thread_store.all_threads()
        ],
    }


@router.get("/threads/message-index")
async def message_index():
    """메시지 ID 인덱스 조회 (스레드 매칭 진단)"""
    return {k: v for k, v in thread_store._by_message_id.items()}


@router.get("/imap-check")
async def imap_check():
    """IMAP 연결 직접 테스트 - 인증 오류 진단용"""
    import imaplib
    from ..config import get_settings
    settings = get_settings()

    imap_user = settings.IMAP_USER or settings.SMTP_USER
    imap_pass = settings.IMAP_PASSWORD or settings.SMTP_PASSWORD
    imap_host = settings.IMAP_HOST or "imap.naver.com"
    imap_port = settings.IMAP_PORT or 993

    result = {
        "imap_host": imap_host,
        "imap_port": imap_port,
        "imap_user": imap_user,
        "imap_password_length": len(imap_pass) if imap_pass else 0,
        "imap_password_preview": imap_pass[:4] + "..." if imap_pass else "(empty)",
        "has_spaces": " " in imap_pass if imap_pass else False,
        "status": None,
        "unseen_count": None,
        "error": None,
    }

    try:
        with imaplib.IMAP4_SSL(imap_host, imap_port) as imap:
            imap.login(imap_user, imap_pass)
            imap.select("INBOX")
            _, data = imap.search(None, "UNSEEN")
            unseen = data[0].split() if data[0] else []
            result["status"] = "success"
            result["unseen_count"] = len(unseen)
    except imaplib.IMAP4.error as e:
        result["status"] = "auth_failed"
        result["error"] = str(e)
    except Exception as e:
        result["status"] = "connection_error"
        result["error"] = str(e)

    return result


@router.get("/email-send-check")
async def email_send_check():
    """이메일 발송 설정 진단 (실제 발송 없음)"""
    from ..config import get_settings
    settings = get_settings()

    return {
        "brevo_api_key_set": bool(settings.BREVO_API_KEY),
        "brevo_key_preview": settings.BREVO_API_KEY[:8] + "..." if settings.BREVO_API_KEY else "(empty)",
        "smtp_user": settings.SMTP_USER or "(empty)",
        "smtp_password_set": bool(settings.SMTP_PASSWORD),
        "from_email": settings.FROM_EMAIL or settings.SMTP_USER or "(empty)",
        "reply_to_email": settings.REPLY_TO_EMAIL or "(same as from)",
        "test_email_override": settings.TEST_EMAIL_OVERRIDE or "(disabled)",
        "send_method": "brevo" if settings.BREVO_API_KEY else ("smtp" if settings.SMTP_USER else "NONE"),
    }

@router.get("/brevo-check")
async def brevo_check():
    """Brevo API 상태 확인 - 크레딧/잔액 조회"""
    import httpx
    from ..config import get_settings
    settings = get_settings()

    if not settings.BREVO_API_KEY:
        return {"status": "no_key", "error": "BREVO_API_KEY not set"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.brevo.com/v3/account",
                headers={"api-key": settings.BREVO_API_KEY},
            )
            if resp.is_success:
                data = resp.json()
                plan = data.get("plan", [{}])
                return {
                    "status": "ok",
                    "email": data.get("email", ""),
                    "company": data.get("companyName", ""),
                    "plan": plan,
                }
            return {"status": "failed", "code": resp.status_code, "error": resp.text[:200]}
    except Exception as e:
        return {"status": "error", "error": str(e)}


@router.get("/gmail-check")
async def gmail_check():
    """Gmail OAuth 연결 진단"""
    import httpx
    from ..config import get_settings
    settings = get_settings()

    result = {
        "GMAIL_CLIENT_ID": bool(settings.GMAIL_CLIENT_ID),
        "GMAIL_CLIENT_SECRET": bool(settings.GMAIL_CLIENT_SECRET),
        "GMAIL_REFRESH_TOKEN": bool(settings.GMAIL_REFRESH_TOKEN),
        "client_id_preview": settings.GMAIL_CLIENT_ID[:20] + "..." if settings.GMAIL_CLIENT_ID else "(empty)",
        "refresh_token_preview": settings.GMAIL_REFRESH_TOKEN[:10] + "..." if settings.GMAIL_REFRESH_TOKEN else "(empty)",
        "token_status": None,
        "error": None,
    }

    if not all([settings.GMAIL_CLIENT_ID, settings.GMAIL_CLIENT_SECRET, settings.GMAIL_REFRESH_TOKEN]):
        result["token_status"] = "missing_credentials"
        return result

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post("https://oauth2.googleapis.com/token", data={
                "client_id": settings.GMAIL_CLIENT_ID,
                "client_secret": settings.GMAIL_CLIENT_SECRET,
                "refresh_token": settings.GMAIL_REFRESH_TOKEN,
                "grant_type": "refresh_token",
            })
            if resp.is_success:
                result["token_status"] = "success"
            else:
                result["token_status"] = "failed"
                result["error"] = resp.text[:200]
    except Exception as e:
        result["token_status"] = "error"
        result["error"] = str(e)

    return result
