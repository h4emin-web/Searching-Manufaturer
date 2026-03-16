"""
Gmail API 수신 서비스 (OAuth2 - Railway 호환)
- 5분마다 받은메일함 폴링
- 우리가 보낸 메일의 답장 감지 (In-Reply-To 헤더 매칭)
"""
import asyncio
import base64
import email
from email.header import decode_header
from email.utils import parseaddr
import structlog
import httpx

from ..config import get_settings

logger = structlog.get_logger()
settings = get_settings()

POLL_INTERVAL = 300
GMAIL_TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"


def _decode_header_value(raw: str) -> str:
    parts = decode_header(raw)
    result = []
    for part, charset in parts:
        if isinstance(part, bytes):
            result.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            result.append(part)
    return "".join(result)


def _extract_body(msg: email.message.Message) -> str:
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            disp = str(part.get("Content-Disposition", ""))
            if ct == "text/plain" and "attachment" not in disp:
                payload = part.get_payload(decode=True)
                charset = part.get_content_charset() or "utf-8"
                body = payload.decode(charset, errors="replace")
                break
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or "utf-8"
            body = payload.decode(charset, errors="replace")
    return body.strip()


async def _get_access_token(client: httpx.AsyncClient) -> str | None:
    if not all([settings.GMAIL_CLIENT_ID, settings.GMAIL_CLIENT_SECRET, settings.GMAIL_REFRESH_TOKEN]):
        logger.error("gmail_oauth_missing", msg="GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN 필요")
        return None
    resp = await client.post(GMAIL_TOKEN_URL, data={
        "client_id": settings.GMAIL_CLIENT_ID,
        "client_secret": settings.GMAIL_CLIENT_SECRET,
        "refresh_token": settings.GMAIL_REFRESH_TOKEN,
        "grant_type": "refresh_token",
    })
    if resp.is_success:
        return resp.json().get("access_token")
    logger.error("gmail_token_failed", status=resp.status_code, body=resp.text[:200])
    return None


async def _fetch_replies_gmail() -> list[dict]:
    replies = []
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            access_token = await _get_access_token(client)
            if not access_token:
                return []
            headers = {"Authorization": "Bearer " + access_token}
            list_resp = await client.get(
                GMAIL_API_BASE + "/messages",
                headers=headers,
                params={"q": "is:unread", "maxResults": 50},
            )
            if not list_resp.is_success:
                logger.error("gmail_list_failed", status=list_resp.status_code)
                return []
            messages = list_resp.json().get("messages", [])
            if not messages:
                return []
            msg_ids_to_mark = []
            for msg_ref in messages:
                msg_id = msg_ref["id"]
                msg_resp = await client.get(
                    GMAIL_API_BASE + "/messages/" + msg_id,
                    headers=headers,
                    params={"format": "raw"},
                )
                if not msg_resp.is_success:
                    continue
                raw_b64 = msg_resp.json().get("raw", "")
                raw_bytes = base64.urlsafe_b64decode(raw_b64 + "==")
                msg = email.message_from_bytes(raw_bytes)
                in_reply_to = msg.get("In-Reply-To", "").strip()
                references = msg.get("References", "").strip()
                if not in_reply_to:
                    continue
                from_raw = msg.get("From", "")
                _, from_email = parseaddr(from_raw)
                subject = _decode_header_value(msg.get("Subject", ""))
                body = _extract_body(msg)
                replies.append({
                    "in_reply_to": in_reply_to,
                    "references": references,
                    "from_email": from_email,
                    "subject": subject,
                    "body": body,
                })
                msg_ids_to_mark.append(msg_id)
            for msg_id in msg_ids_to_mark:
                await client.post(
                    GMAIL_API_BASE + "/messages/" + msg_id + "/modify",
                    headers=headers,
                    json={"removeLabelIds": ["UNREAD"]},
                )
        logger.info("gmail_poll_done", found_replies=len(replies))
    except Exception as exc:
        logger.error("gmail_poll_failed", error=str(exc))
    return replies


async def fetch_replies() -> list[dict]:
    return await _fetch_replies_gmail()


async def start_polling(on_reply_callback):
    logger.info("email_poller_started", interval_seconds=POLL_INTERVAL, method="gmail_api")
    while True:
        try:
            replies = await fetch_replies()
            for reply in replies:
                await on_reply_callback(reply)
        except Exception as exc:
            logger.error("poller_error", error=str(exc))
        await asyncio.sleep(POLL_INTERVAL)
