"""
아웃리치 Priority Queue - ②번 핵심 포인트
- 연락 채널 우선순위: Email(1) > Web Form(2)
- 제조소별 가용 채널 기반으로 자동 우선순위 결정
- SLA 초과 시 자동 다음 채널로 폴백
- heapq 기반 Priority Queue 구현
"""
import heapq
import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Callable, Awaitable

import structlog

from ..models.schemas import Manufacturer, OutreachAttempt, OutreachChannel, OutreachPlan
from ..config import get_settings

logger = structlog.get_logger()
settings = get_settings()


# ─── 채널 우선순위 정의 ───────────────────────────────────────
CHANNEL_PRIORITY: dict[OutreachChannel, int] = {
    OutreachChannel.EMAIL:     1,   # 최우선
    OutreachChannel.WEB_FORM:  2,   # 이메일 없을 때 홈페이지 문의폼
    OutreachChannel.NONE:      99,
}

# 채널 가용성 확인 함수 맵 (제조소 필드명)
CHANNEL_CONTACT_FIELD: dict[OutreachChannel, str] = {
    OutreachChannel.EMAIL:    "contact_email",
    OutreachChannel.WEB_FORM: "web_form_url",
}


# ─── Priority Queue 항목 ──────────────────────────────────────
@dataclass(order=True)
class OutreachQueueItem:
    """
    heapq는 최솟값 우선 → priority가 낮을수록(=중요할수록) 먼저 처리
    """
    priority: int                           # 1=WeChat, 2=WhatsApp...
    scheduled_at: datetime                  # 같은 우선순위면 일찍 예약된 것 먼저
    attempt: OutreachAttempt = field(compare=False)
    manufacturer: Manufacturer = field(compare=False)


class OutreachPriorityQueue:
    """
    제조소 × 채널 조합에 대한 Priority Queue
    - 각 제조소에 대해 가용 채널 중 가장 높은 우선순위 채널로 즉시 발송
    - SLA 내 응답 없으면 다음 채널로 자동 폴백 (fallback scheduling)
    """

    def __init__(self):
        self._heap: list[OutreachQueueItem] = []
        self._in_queue: set[str] = set()  # manufacturer_id 추적 (중복 방지)

    def __len__(self) -> int:
        return len(self._heap)

    def enqueue(
        self,
        manufacturer: Manufacturer,
        attempt: OutreachAttempt,
        scheduled_at: datetime | None = None,
    ) -> None:
        priority = CHANNEL_PRIORITY.get(attempt.channel, 99)
        at = scheduled_at or datetime.utcnow()
        item = OutreachQueueItem(
            priority=priority,
            scheduled_at=at,
            attempt=attempt,
            manufacturer=manufacturer,
        )
        heapq.heappush(self._heap, item)
        self._in_queue.add(f"{manufacturer.id}:{attempt.channel.value}")
        logger.debug(
            "enqueued",
            manufacturer=manufacturer.name,
            channel=attempt.channel.value,
            priority=priority,
        )

    def dequeue(self) -> OutreachQueueItem | None:
        while self._heap:
            item = heapq.heappop(self._heap)
            # 예약 시간이 아직 안 됐으면 다시 넣음
            if item.scheduled_at > datetime.utcnow():
                heapq.heappush(self._heap, item)
                return None
            return item
        return None

    def peek(self) -> OutreachQueueItem | None:
        return self._heap[0] if self._heap else None


# ─── 아웃리치 계획 생성 ───────────────────────────────────────
def build_outreach_plan(
    session_id: str,
    manufacturers: list[Manufacturer],
    message_templates: dict[str, dict[str, str]],  # {lang: {subject, body}}
) -> OutreachPlan:
    """
    각 제조소에 대해 가용 채널 기반 OutreachAttempt 생성
    가용 채널이 여러 개면 최고 우선순위 채널 하나만 즉시 예약,
    나머지는 SLA 폴백으로 예약
    """
    plan = OutreachPlan(session_id=session_id, total_targets=len(manufacturers))
    attempts = []

    for mfr in manufacturers:
        if mfr.is_excluded:
            continue

        # 가용 채널 목록 (우선순위 순)
        available_channels = _get_available_channels(mfr)
        if not available_channels:
            logger.warning("no_contact_available", manufacturer=mfr.name)
            continue

        # 최우선 채널 즉시 발송 예약
        primary_channel = available_channels[0]
        primary_attempt = OutreachAttempt(
            manufacturer_id=mfr.id,
            channel=primary_channel,
            priority=CHANNEL_PRIORITY[primary_channel],
            status="pending",
            message_ko=message_templates.get("ko", {}).get("body", ""),
            message_en=message_templates.get("en", {}).get("body", ""),
            message_zh=message_templates.get("zh", {}).get("body", ""),
        )
        attempts.append(primary_attempt)

        # 폴백 채널 (SLA 초과 시 순차 발송)
        sla_hours = settings.OUTREACH_SLA_HOURS
        for i, fallback_channel in enumerate(available_channels[1:], start=1):
            fallback_attempt = OutreachAttempt(
                manufacturer_id=mfr.id,
                channel=fallback_channel,
                priority=CHANNEL_PRIORITY[fallback_channel],
                status="pending",
                message_ko=message_templates.get("ko", {}).get("body", ""),
                message_en=message_templates.get("en", {}).get("body", ""),
                message_zh=message_templates.get("zh", {}).get("body", ""),
            )
            # 폴백은 SLA × i 시간 후 발송
            # (실제 발송 시 primary가 응답하면 취소)
            attempts.append(fallback_attempt)

    plan.attempts = attempts
    plan.total_targets = len(set(a.manufacturer_id for a in attempts))
    return plan


def _get_available_channels(mfr: Manufacturer) -> list[OutreachChannel]:
    """제조소의 가용 연락처 채널을 우선순위 순으로 반환"""
    available = []
    for channel in sorted(CHANNEL_PRIORITY, key=lambda c: CHANNEL_PRIORITY[c]):
        if channel == OutreachChannel.NONE:
            continue
        contact_field = CHANNEL_CONTACT_FIELD.get(channel)
        if contact_field and getattr(mfr, contact_field, None):
            available.append(channel)
    return available


# ─── 큐 실행 엔진 ─────────────────────────────────────────────
DispatchFn = Callable[[OutreachAttempt, Manufacturer], Awaitable[bool]]


async def execute_outreach_queue(
    plan: OutreachPlan,
    manufacturers_by_id: dict[str, Manufacturer],
    dispatch_fn: DispatchFn,
    progress_callback: Callable[[int, int], Awaitable[None]] | None = None,
    max_concurrent: int = 10,
) -> OutreachPlan:
    """
    Priority Queue에 모든 아웃리치 항목을 넣고 순서대로 실행
    - max_concurrent: 동시 발송 수 제한
    - 응답받은 제조소의 폴백 시도는 자동 취소
    """
    queue = OutreachPriorityQueue()
    replied_manufacturers: set[str] = set()  # 응답받은 제조소 ID

    # 계획의 primary 시도만 우선 큐에 넣음
    primary_attempts = [
        a for a in plan.attempts
        if a.priority == CHANNEL_PRIORITY.get(a.channel, 99)
        and a.priority <= 4  # WECHAT~WEB_FORM
    ]
    # 우선순위별로 그룹화하여 중복 방지
    seen = set()
    for attempt in sorted(plan.attempts, key=lambda a: a.priority):
        key = attempt.manufacturer_id
        if key not in seen:
            mfr = manufacturers_by_id.get(attempt.manufacturer_id)
            if mfr:
                queue.enqueue(mfr, attempt)
                seen.add(key)

    semaphore = asyncio.Semaphore(max_concurrent)
    sent = 0
    total = len(queue)

    async def _dispatch_item(item: OutreachQueueItem) -> None:
        nonlocal sent
        async with semaphore:
            mfr_id = item.manufacturer.id
            if mfr_id in replied_manufacturers:
                item.attempt.status = "replied"
                return

            success = await dispatch_fn(item.attempt, item.manufacturer)
            if success:
                item.attempt.status = "sent"
                sent += 1
                if progress_callback:
                    await progress_callback(sent, total)
            else:
                item.attempt.status = "failed"
                item.attempt.retry_count += 1

    tasks = []
    while True:
        item = queue.dequeue()
        if item is None:
            break
        tasks.append(_dispatch_item(item))

    await asyncio.gather(*tasks)

    plan.sent_count = sent
    plan.status = "completed"
    return plan
