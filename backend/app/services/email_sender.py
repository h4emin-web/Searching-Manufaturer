"""
이메일 발송 서비스
- Resend API (Railway 권장 - HTTPS, 포트 차단 없음)
- aiosmtplib SMTP (로컬/서버에서 SMTP 허용 시 fallback)
"""
from email.message import EmailMessage
from email.utils import make_msgid
from email.policy import SMTP as SMTP_POLICY
import asyncio
import structlog

from ..config import get_settings

logger = structlog.get_logger()
settings = get_settings()


async def _send_via_resend(
    to_email: str,
    from_email: str,
    subject: str,
    body: str,
    message_id: str,
) -> tuple[bool, str | None]:
    """Resend API로 이메일 발송 (HTTPS, Railway 호환)"""
    import resend
    resend.api_key = settings.RESEND_API_KEY

    def _send():
        return resend.Emails.send({
            "from": from_email,
            "to": [to_email],
            "subject": subject,
            "text": body,
            "headers": {"Message-ID": message_id},
        })

    try:
        result = await asyncio.get_event_loop().run_in_executor(None, _send)
        if result and result.get("id"):
            return True, None
        return False, f"Resend returned no ID: {result}"
    except Exception as exc:
        return False, str(exc)


async def _send_via_smtp(
    to_email: str,
    from_email: str,
    subject: str,
    body: str,
    message_id: str,
    in_reply_to: str | None,
) -> tuple[bool, str | None]:
    """aiosmtplib SMTP 발송 (로컬 환경 fallback)"""
    import aiosmtplib
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
            local_hostname="pharma-sourcing-agent",
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
) -> tuple[bool, str | None]:
    """
    아웃리치 이메일 발송
    Resend API 우선, 없으면 SMTP fallback
    Returns: (success, error_message)
    """
    final_message_id = message_id or make_msgid(domain="pharma-sourcing.local")
    from_email = settings.FROM_EMAIL or "onboarding@resend.dev"

    parts = [p for p in [body_en, body_ko and f"\n---\n[Korean / 한국어]\n{body_ko}", body_zh and f"\n---\n[Chinese / 中文]\n{body_zh}"] if p]
    full_body = "\n".join(parts)

    # Resend 우선 (Railway 호환)
    if settings.RESEND_API_KEY:
        success, error = await _send_via_resend(to_email, from_email, subject, full_body, final_message_id)
        method = "resend"
    elif settings.SMTP_USER and settings.SMTP_PASSWORD:
        success, error = await _send_via_smtp(to_email, from_email, subject, full_body, final_message_id, in_reply_to)
        method = "smtp"
    else:
        return False, "이메일 발송 설정 없음 (RESEND_API_KEY 또는 SMTP 자격증명 필요)"

    if success:
        logger.info("email_sent", method=method, to=to_email, manufacturer=manufacturer_name)
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
            )
    else:
        logger.error("email_failed", method=method, to=to_email, error=error)

    return success, error
