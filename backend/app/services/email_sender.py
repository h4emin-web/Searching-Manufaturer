"""
이메일 발송 서비스
- Brevo API (Railway 권장 - HTTPS, 포트 차단 없음)
- aiosmtplib SMTP (로컬/서버에서 SMTP 허용 시 fallback)
"""
from email.message import EmailMessage
from email.utils import make_msgid
from email.policy import SMTP as SMTP_POLICY
import structlog

from ..config import get_settings

logger = structlog.get_logger()
settings = get_settings()


async def _send_via_brevo(
    to_email: str,
    from_email: str,
    subject: str,
    body: str,
    message_id: str | None = None,
    in_reply_to: str | None = None,
    reply_to: str | None = None,
) -> tuple[bool, str | None]:
    """Brevo API로 이메일 발송 (HTTPS, Railway 호환)"""
    import httpx
    api_headers = {
        "api-key": settings.BREVO_API_KEY,
        "Content-Type": "application/json",
    }
    payload: dict = {
        "sender": {"email": from_email},
        "to": [{"email": to_email}],
        "subject": subject,
        "textContent": body,
    }
    if reply_to:
        payload["replyTo"] = {"email": reply_to}

    # Message-ID / In-Reply-To 헤더 주입 (스레드 매칭 핵심)
    email_headers: dict[str, str] = {}
    if message_id:
        email_headers["Message-ID"] = message_id
    if in_reply_to:
        email_headers["In-Reply-To"] = in_reply_to
        email_headers["References"] = in_reply_to
    if email_headers:
        payload["headers"] = email_headers

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post("https://api.brevo.com/v3/smtp/email", headers=api_headers, json=payload)
        if resp.is_success:
            logger.info("brevo_api_success", to=to_email, message_id=message_id)
            return True, None
        return False, f"Brevo {resp.status_code}: {resp.text[:300]}"
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
    plan_id: str = "",
    manufacturer_id: str = "",
) -> tuple[bool, str | None]:
    """
    아웃리치 이메일 발송
    Brevo API 우선, 없으면 SMTP fallback
    Returns: (success, error_message)
    """
    final_message_id = message_id or make_msgid(domain="pharma-sourcing.local")
    from_email = settings.FROM_EMAIL or settings.SMTP_USER

    parts = [p for p in [body_en, body_ko and f"\n---\n[Korean / 한국어]\n{body_ko}", body_zh and f"\n---\n[Chinese / 中文]\n{body_zh}"] if p]
    full_body = "\n".join(parts)

    reply_to = settings.REPLY_TO_EMAIL or None

    # 테스트 모드: 실제 수신자 대신 지정 주소로 발송
    actual_to = settings.TEST_EMAIL_OVERRIDE if settings.TEST_EMAIL_OVERRIDE else to_email
    if settings.TEST_EMAIL_OVERRIDE:
        subject = f"[TEST→{to_email}] {subject}"
        logger.info("email_test_override", original_to=to_email, override_to=actual_to)

    # Brevo 우선, SMTP fallback
    if settings.BREVO_API_KEY:
        success, error = await _send_via_brevo(
            actual_to, from_email, subject, full_body,
            message_id=final_message_id,
            in_reply_to=in_reply_to,
            reply_to=reply_to,
        )
        method = "brevo"
    elif settings.SMTP_USER and settings.SMTP_PASSWORD:
        success, error = await _send_via_smtp(actual_to, from_email, subject, full_body, final_message_id, in_reply_to)
        method = "smtp"
    else:
        return False, "이메일 발송 설정 없음 (BREVO_API_KEY 또는 SMTP 자격증명 필요)"

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
                plan_id=plan_id,
                manufacturer_id=manufacturer_id,
            )
    else:
        logger.error("email_failed", method=method, to=to_email, error=error)

    return success, error
