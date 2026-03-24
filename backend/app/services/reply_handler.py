"""
이메일 답장 처리 오케스트레이터
- thread_store에서 스레드 찾기
- Gemini로 답장 분석: 누락 항목 체크 + 질문 파악
- AI 판단 가능 → 자동 답장 발송
- AI 판단 불가 → 에스컬레이션 (outreach plan 현황에 기재)
"""
import asyncio
from email.utils import make_msgid
import structlog

from .thread_store import thread_store
from .email_sender import send_outreach_email
from ..agents.reply_agent import analyze_and_reply
from ..routers import outreach as outreach_router

logger = structlog.get_logger()


async def handle_reply(reply: dict) -> None:
    """답장 수신 시 처리"""
    thread = thread_store.find_thread_by_reply(
        in_reply_to=reply["in_reply_to"],
        references=reply.get("references", ""),
    )
    if not thread:
        logger.debug("reply_no_thread_found", in_reply_to=reply["in_reply_to"])
        return

    logger.info("reply_received", manufacturer=thread.manufacturer_name, from_email=reply["from_email"])
    thread_store.add_reply(thread, reply["body"])

    # outreach plan 상태 업데이트 → "replied"
    _update_plan_status(thread, "replied")

    if not thread_store.can_auto_reply(thread):
        logger.info("auto_reply_limit_reached", manufacturer=thread.manufacturer_name)
        return

    # Gemini로 분석
    try:
        analysis = await analyze_and_reply(thread)
    except Exception as exc:
        logger.error("reply_analysis_failed", error=str(exc))
        return

    # 공급 불가 → 플랜 상태 closed
    if analysis.get("supplier_cannot_supply"):
        _update_plan_status(thread, "closed")
        logger.info("supplier_cannot_supply", manufacturer=thread.manufacturer_name)
        return

    # 에스컬레이션 필요 → 현황에 기재, 발송 보류
    if analysis.get("needs_human") and analysis.get("human_questions"):
        questions = analysis["human_questions"]
        missing = analysis.get("missing_items", [])
        thread_store.set_escalated(thread, questions, missing)
        _escalate_to_plan(thread, questions, missing)
        logger.info("escalated_to_human", manufacturer=thread.manufacturer_name, questions=questions)
        return

    # 자동 답장 발송
    if not analysis.get("needs_reply") or not analysis.get("body"):
        logger.info("no_reply_needed", manufacturer=thread.manufacturer_name)
        return

    new_msg_id = make_msgid(domain="pharma-sourcing.local")
    success, error = await send_outreach_email(
        to_email=thread.to_email,
        manufacturer_name=thread.manufacturer_name,
        subject=analysis["subject"],
        body_en=analysis["body"],
        message_id=new_msg_id,
        in_reply_to=thread.last_message_id,
        register_thread=False,
    )

    if success:
        thread_store.add_our_reply(thread, new_msg_id, analysis["body"])
        missing = analysis.get("missing_items", [])
        thread.missing_items = missing
        # 누락 항목 없으면 완료
        if not missing:
            _update_plan_status(thread, "completed")
        logger.info("auto_reply_sent", manufacturer=thread.manufacturer_name,
                    missing_items=missing)
    else:
        logger.error("auto_reply_send_failed", error=error)


def _update_plan_status(thread, status: str) -> None:
    """outreach plan 아이템 상태 업데이트 + Supabase 저장"""
    if not thread.plan_id or not thread.manufacturer_id:
        return
    plan = outreach_router._simple_plans.get(thread.plan_id)
    if not plan:
        return
    for item in plan["items"]:
        if item["id"] == thread.manufacturer_id:
            item["status"] = status
            break
    asyncio.create_task(outreach_router._save_plan(thread.plan_id))


def _escalate_to_plan(thread, questions: list[str], missing: list[str]) -> None:
    """outreach plan 아이템에 에스컬레이션 정보 기재 + Supabase 저장"""
    if not thread.plan_id or not thread.manufacturer_id:
        return
    plan = outreach_router._simple_plans.get(thread.plan_id)
    if not plan:
        return
    for item in plan["items"]:
        if item["id"] == thread.manufacturer_id:
            item["status"] = "escalated"
            item["escalated_questions"] = questions
            item["missing_items"] = missing
            break
    asyncio.create_task(outreach_router._save_plan(thread.plan_id))
