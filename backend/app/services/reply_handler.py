"""
이메일 답장 처리 오케스트레이터
- thread_store에서 스레드 찾기
- reply_agent로 AI 답변 생성
- email_sender로 발송
"""
from email.utils import make_msgid
import structlog

from .thread_store import thread_store
from .email_sender import send_outreach_email
from ..agents.reply_agent import generate_reply

logger = structlog.get_logger()


async def handle_reply(reply: dict) -> None:
    """답장 수신 시 처리: 스레드 찾기 → AI 답변 생성 → 자동 발송"""
    thread = thread_store.find_thread_by_reply(
        in_reply_to=reply["in_reply_to"],
        references=reply.get("references", ""),
    )
    if not thread:
        logger.debug("reply_no_thread_found", in_reply_to=reply["in_reply_to"])
        return

    if not thread_store.can_auto_reply(thread):
        logger.info("auto_reply_limit_reached", manufacturer=thread.manufacturer_name)
        return

    logger.info(
        "reply_received",
        manufacturer=thread.manufacturer_name,
        from_email=reply["from_email"],
        auto_reply_count=thread.auto_reply_count,
    )

    thread_store.add_reply(thread, reply["body"])

    try:
        reply_content = await generate_reply(thread)
    except Exception as exc:
        logger.error("reply_generation_failed", error=str(exc))
        return

    # 언어 코드에 따라 올바른 파라미터에 body 전달
    lang = reply_content.language
    body_en = reply_content.body if lang == "en" else ""
    body_ko = reply_content.body if lang == "ko" else ""
    body_zh = reply_content.body if lang == "zh" else ""
    body_other = reply_content.body if lang not in ("en", "ko", "zh") else ""
    # 기타 언어(일본어, 독일어 등)는 영문 파라미터에 담아서 발송
    if body_other:
        body_en = body_other

    new_msg_id = make_msgid(domain="pharma-sourcing.local")
    success, error = await send_outreach_email(
        to_email=thread.to_email,
        manufacturer_name=thread.manufacturer_name,
        subject=reply_content.subject,
        body_en=body_en,
        body_ko=body_ko,
        body_zh=body_zh,
        message_id=new_msg_id,
        in_reply_to=thread.last_message_id,
        register_thread=False,
    )

    if success:
        thread_store.add_our_reply(thread, new_msg_id, reply_content.body)
        logger.info(
            "auto_reply_sent",
            manufacturer=thread.manufacturer_name,
            reply_count=thread.auto_reply_count,
        )
    else:
        logger.error("auto_reply_send_failed", error=error)
