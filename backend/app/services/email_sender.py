"""
이메일 발송 서비스 (aiosmtplib 기반)
- Gmail App Password 인증
- 한/영/중 멀티랭귀지 메시지
- 발송 후 thread_store에 자동 등록 (답장 추적)
"""
from email.message import EmailMessage
from email.utils import make_msgid
from email.policy import SMTP as SMTP_POLICY
import aiosmtplib
import structlog

from ..config import get_settings

logger = structlog.get_logger()
settings = get_settings()


async def send_outreach_email(
    to_email: str,
    manufacturer_name: str,
    subject: str,
    body_en: str,
    body_ko: str = "",
    body_zh: str = "",
    message_id: str | None = None,
    in_reply_to: str | None = None,
    ingredient: str = "",          # thread 등록용
    country: str = "",             # 제조원 국가 (언어 선택용)
    register_thread: bool = True,  # 최초 발송 시 thread_store 등록
) -> tuple[bool, str | None]:
    """
    아웃리치 이메일 발송
    Returns: (success, error_message)
    """
    final_message_id = message_id or make_msgid(domain="pharma-sourcing.local")

    msg = EmailMessage(policy=SMTP_POLICY)
    msg["Subject"]    = subject
    msg["From"]       = settings.FROM_EMAIL
    msg["To"]         = to_email
    msg["Message-ID"] = final_message_id

    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
        msg["References"]  = in_reply_to

    parts = []
    if body_en:
        parts.append(body_en)
    if body_ko:
        parts.append(f"\n---\n[Korean / 한국어]\n{body_ko}")
    if body_zh:
        parts.append(f"\n---\n[Chinese / 中文]\n{body_zh}")

    full_body = "\n".join(parts)
    msg.set_content(full_body, charset="utf-8")

    try:
        await aiosmtplib.send(
            msg.as_bytes(),
            sender=settings.FROM_EMAIL,
            recipients=[to_email],
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
            local_hostname="pharma-sourcing-agent",
        )
        logger.info("email_sent", to=to_email, manufacturer=manufacturer_name, subject=subject)

        # 최초 발송 시 thread_store에 등록
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

        return True, None

    except Exception as exc:
        logger.error("email_failed", to=to_email, error=str(exc))
        return False, str(exc)
