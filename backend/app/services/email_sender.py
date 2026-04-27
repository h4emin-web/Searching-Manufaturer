"""
이메일 발송 서비스
- Brevo API (기본, HTTPS - 클라우드 서버 포트 차단 우회)
- 네이버 SMTP (로컬 fallback)
"""
from email.utils import make_msgid
import structlog
import httpx

from ..config import get_settings

logger = structlog.get_logger()
settings = get_settings()


async def _send_via_brevo(
    to_email: str,
    from_email: str,
    subject: str,
    body: str,
    message_id: str,
    in_reply_to: str | None,
    reply_to: str | None,
) -> tuple[bool, str | None, str]:
    """Returns (success, error, actual_message_id)"""
    payload: dict = {
        "sender": {"email": from_email},
        "to": [{"email": to_email}],
        "subject": subject,
        "textContent": body,
    }
    if reply_to:
        payload["replyTo"] = {"email": reply_to}
    extra_headers: dict[str, str] = {
        "Message-ID": message_id,  # Force our own Message-ID so thread matching works
    }
    if in_reply_to:
        extra_headers["In-Reply-To"] = in_reply_to
        extra_headers["References"] = in_reply_to
    payload["headers"] = extra_headers
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.brevo.com/v3/smtp/email",
                headers={"api-key": settings.BREVO_API_KEY, "Content-Type": "application/json"},
                json=payload,
            )
        if resp.is_success:
            resp_data = resp.json()
            brevo_msg_id = resp_data.get("messageId") or message_id
            logger.info("brevo_send_ok", our_msg_id=message_id, brevo_msg_id=brevo_msg_id, raw=str(resp_data)[:200])
            return True, None, brevo_msg_id
        return False, f"Brevo {resp.status_code}: {resp.text[:300]}", message_id
    except Exception as exc:
        return False, str(exc), message_id


async def _send_via_smtp(
    to_email: str,
    from_email: str,
    subject: str,
    body: str,
    message_id: str,
    in_reply_to: str | None,
) -> tuple[bool, str | None]:
    import aiosmtplib
    from email.message import EmailMessage
    from email.policy import SMTP as SMTP_POLICY
    msg = EmailMessage(policy=SMTP_POLICY)
    msg["Subject"]    = subject
    msg["From"]       = from_email
    msg["To"]         = to_email
    msg["Message-ID"] = message_id
    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
        msg["References"]  = in_reply_to
    msg.set_content(body, charset="utf-8")
    try:
        await aiosmtplib.send(
            msg.as_bytes(),
            sender=from_email,
            recipients=[to_email],
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )
        return True, None
    except Exception as exc:
        return False, str(exc)


async def send_outreach_email(
    to_email: str,
    manufacturer_name: str,
    subject: str,
    body_en: str,
    body_ko: str = "",
    body_zh: str = "",
    message_id: str | None = None,
    in_reply_to: str | None = None,
    ingredient: str = "",
    country: str = "",
    register_thread: bool = True,
    plan_id: str = "",
    manufacturer_id: str = "",
    end_user_disclosable: bool = True,
    end_user_name: str = "",
) -> tuple[bool, str | None]:
    final_message_id = message_id or make_msgid(domain="naver.com")
    from_email = settings.FROM_EMAIL or settings.SMTP_USER
    reply_to = settings.REPLY_TO_EMAIL or from_email

    parts = [p for p in [
        body_en,
        body_ko and f"\n---\n[Korean / 한국어]\n{body_ko}",
        body_zh and f"\n---\n[Chinese / 中文]\n{body_zh}",
    ] if p]
    full_body = "\n".join(parts)

    actual_to = settings.TEST_EMAIL_OVERRIDE if settings.TEST_EMAIL_OVERRIDE else to_email
    if settings.TEST_EMAIL_OVERRIDE:
        subject = f"[TEST→{to_email}] {subject}"
        logger.info("email_test_override", original_to=to_email, override_to=actual_to)

    if settings.BREVO_API_KEY:
        success, error, final_message_id = await _send_via_brevo(
            actual_to, from_email, subject, full_body, final_message_id, in_reply_to, reply_to
        )
        method = "brevo"
    elif settings.SMTP_USER and settings.SMTP_PASSWORD:
        success, error = await _send_via_smtp(
            actual_to, from_email, subject, full_body, final_message_id, in_reply_to
        )
        method = "naver_smtp"
    else:
        return False, "이메일 발송 설정 없음 (BREVO_API_KEY 또는 SMTP_USER/PASSWORD 필요)"

    if success:
        logger.info("email_sent", method=method, to=to_email, manufacturer=manufacturer_name, message_id=final_message_id)
        if register_thread and not in_reply_to and ingredient:
            from .thread_store import thread_store
            thread_store.register(
                message_id=final_message_id,
                to_email=to_email,
                manufacturer_name=manufacturer_name,
                ingredient=ingredient,
                subject=subject,
                body=full_body,
                country=country,
                plan_id=plan_id,
                manufacturer_id=manufacturer_id,
                end_user_disclosable=end_user_disclosable,
                end_user_name=end_user_name,
            )
    else:
        logger.error("email_failed", method=method, to=to_email, error=error)

    return success, error
