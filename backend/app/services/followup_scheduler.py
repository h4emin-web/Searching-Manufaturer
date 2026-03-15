"""
24시간 팔로업 스케줄러
- 매 30분 실행
- 마지막 발송 후 24시간 경과 + 미답변 → 팔로업 이메일 발송
- 최대 2회 팔로업
"""
import asyncio
from email.utils import make_msgid
import structlog

from .thread_store import thread_store
from .email_sender import send_outreach_email
from ..agents.reply_agent import generate_followup_email

logger = structlog.get_logger()

FOLLOWUP_INTERVAL = 1800   # 30분마다 체크
FOLLOWUP_HOURS = 24        # 24시간 무응답 시 팔로업


async def run_followup_scheduler() -> None:
    """백그라운드 팔로업 루프"""
    logger.info("followup_scheduler_started", interval_seconds=FOLLOWUP_INTERVAL)
    await asyncio.sleep(60)  # 서버 시작 후 1분 대기
    while True:
        try:
            await _check_all_threads()
        except Exception as exc:
            logger.error("followup_scheduler_error", error=str(exc))
        await asyncio.sleep(FOLLOWUP_INTERVAL)


async def _check_all_threads() -> None:
    threads = thread_store.all_threads()
    pending = [t for t in threads if thread_store.needs_followup(t, FOLLOWUP_HOURS)
               and thread_store.can_follow_up(t)]

    if not pending:
        return

    logger.info("followup_check", pending_count=len(pending))

    for thread in pending:
        try:
            follow_up_num = thread.follow_up_count + 1
            email_data = await generate_followup_email(thread, follow_up_num)
            if not email_data.get("body"):
                continue

            new_msg_id = make_msgid(domain="pharma-sourcing.local")
            success, error = await send_outreach_email(
                to_email=thread.to_email,
                manufacturer_name=thread.manufacturer_name,
                subject=email_data["subject"],
                body_en=email_data["body"],
                message_id=new_msg_id,
                in_reply_to=thread.last_message_id,
                ingredient=thread.ingredient,
                country=thread.country,
                register_thread=False,
            )

            if success:
                thread.follow_up_count += 1
                thread_store.add_our_reply(thread, new_msg_id, email_data["body"])
                logger.info("followup_sent", manufacturer=thread.manufacturer_name,
                            follow_up_num=follow_up_num)
            else:
                logger.warning("followup_send_failed", manufacturer=thread.manufacturer_name, error=error)
        except Exception as exc:
            logger.error("followup_error", manufacturer=thread.manufacturer_name, error=str(exc))
