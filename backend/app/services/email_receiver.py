"""
Gmail IMAP 수신 서비스
- 5분마다 받은메일함 폴링
- 우리가 보낸 메일의 답장 감지 (In-Reply-To 헤더 매칭)
- 답장 본문 파싱 후 thread_store에 전달
"""
import imaplib
import email
import asyncio
import quopri
from email.header import decode_header
from email.utils import parseaddr
import structlog

from ..config import get_settings

logger = structlog.get_logger()
settings = get_settings()

IMAP_HOST = "imap.gmail.com"
IMAP_PORT = 993
POLL_INTERVAL = 300  # 5분


def _decode_str(value: str | bytes | None) -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


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
    """이메일에서 텍스트 본문 추출"""
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


def _fetch_replies_sync() -> list[dict]:
    """
    동기 IMAP 조회 (asyncio executor에서 실행)
    Returns: [{"in_reply_to", "references", "from_email", "subject", "body"}]
    """
    replies = []
    try:
        imap_user = settings.IMAP_USER or settings.SMTP_USER
        imap_pass = settings.IMAP_PASSWORD or settings.SMTP_PASSWORD
        if not imap_user or not imap_pass:
            return []
        with imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT) as imap:
            imap.login(imap_user, imap_pass)
            imap.select("INBOX")

            # 안 읽은 메일 중 답장(In-Reply-To 헤더 있는 것)만 검색
            _, msg_nums = imap.search(None, "UNSEEN")
            if not msg_nums or not msg_nums[0]:
                return []

            for num in msg_nums[0].split():
                _, data = imap.fetch(num, "(RFC822)")
                if not data or not data[0]:
                    continue

                raw = data[0][1]
                msg = email.message_from_bytes(raw)

                in_reply_to = msg.get("In-Reply-To", "").strip()
                references = msg.get("References", "").strip()

                # In-Reply-To가 없으면 우리 메일에 대한 답장이 아님
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

                # 읽음 처리
                imap.store(num, "+FLAGS", "\\Seen")

        logger.info("imap_poll_done", found_replies=len(replies))
    except Exception as exc:
        logger.error("imap_poll_failed", error=str(exc))

    return replies


async def fetch_replies() -> list[dict]:
    """비동기 래퍼 - blocking IMAP을 executor에서 실행"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _fetch_replies_sync)


async def start_polling(on_reply_callback):
    """
    백그라운드 폴링 루프
    on_reply_callback(reply_dict) 호출로 답장 처리 위임
    """
    logger.info("email_poller_started", interval_seconds=POLL_INTERVAL)
    while True:
        try:
            replies = await fetch_replies()
            for reply in replies:
                await on_reply_callback(reply)
        except Exception as exc:
            logger.error("poller_error", error=str(exc))
        await asyncio.sleep(POLL_INTERVAL)
