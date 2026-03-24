"""
이메일 발송 서비스 - 네이버 SMTP 전용
- smtp.naver.com:587 (STARTTLS)
"""
from email.message import EmailMessage
from email.utils import make_msgid
from email.policy import SMTP as SMTP_POLICY
import structlog

from ..config import get_settings

logger = structlog.get_logger()
settings = get_settings()


async def _send_via_smtp(
    to_email: str,
    from_email: str,
    subject: str,
    body: str,
    message_id: str,
    in_reply_to: str | None,
) -> tuple[bool, str | None]:
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
) -> tuple[bool, str | None]:
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        return False, "이메일 발송 설정 없음 (SMTP_USER / SMTP_PASSWORD 필요)"

    final_message_id = message_id or make_msgid(domain="naver.com")
    from_email = settings.FROM_EMAIL or settings.SMTP_USER

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

    success, error = await _send_via_smtp(
        actual_to, from_email, subject, full_body, final_message_id, in_reply_to
    )

    if success:
        logger.info("email_sent", method="naver_smtp", to=to_email, manufacturer=manufacturer_name)
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
            )
    else:
        logger.error("email_failed", method="naver_smtp", to=to_email, error=error)

    return success, error
