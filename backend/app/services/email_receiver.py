"""
네이버 메일 IMAP 수신 서비스
- 5분마다 받은메일함 폴링
- 우리가 보낸 메일의 답장 감지 (In-Reply-To 헤더 매칭)
"""
import asyncio
import imaplib
import email
from email.header import decode_header
from email.utils import parseaddr
import structlog

from ..config import get_settings

logger = structlog.get_logger()
settings = get_settings()

POLL_INTERVAL = 10


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


def _fetch_replies_imap() -> list[dict]:
    """네이버 IMAP으로 안읽은 답장 메일 수집 (동기)"""
    imap_user = settings.IMAP_USER or settings.SMTP_USER
    imap_password = settings.IMAP_PASSWORD or settings.SMTP_PASSWORD

    if not imap_user or not imap_password:
        logger.error("naver_imap_missing", msg="IMAP_USER / IMAP_PASSWORD 설정 필요")
        return []

    replies = []
    mail = None
    try:
        mail = imaplib.IMAP4_SSL(settings.IMAP_HOST, settings.IMAP_PORT)
        mail.login(imap_user, imap_password)
        mail.select("INBOX")

        _, data = mail.search(None, "UNSEEN")
        msg_ids = data[0].split()
        if not msg_ids:
            return []

        for msg_id in msg_ids:
            _, msg_data = mail.fetch(msg_id, "(RFC822)")
            raw_bytes = msg_data[0][1]
            msg = email.message_from_bytes(raw_bytes)

            in_reply_to = msg.get("In-Reply-To", "").strip()
            references = msg.get("References", "").strip()

            if not in_reply_to:
                # 답장이 아닌 메일은 건너뜀 (읽음 처리도 하지 않음)
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

            # 읽음 처리
            mail.store(msg_id, "+FLAGS", "\\Seen")

        logger.info("naver_imap_poll_done", found_replies=len(replies))
    except Exception as exc:
        logger.error("naver_imap_poll_failed", error=str(exc))
    finally:
        if mail:
            try:
                mail.logout()
            except Exception:
                pass
    return replies


async def fetch_replies() -> list[dict]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _fetch_replies_imap)


async def start_polling(on_reply_callback):
    logger.info("email_poller_started", interval_seconds=POLL_INTERVAL, method="naver_imap")
    while True:
        try:
            replies = await fetch_replies()
            for reply in replies:
                await on_reply_callback(reply)
        except Exception as exc:
            logger.error("poller_error", error=str(exc))
        await asyncio.sleep(POLL_INTERVAL)
