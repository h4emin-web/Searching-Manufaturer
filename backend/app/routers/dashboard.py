"""
SSE 기반 실시간 대시보드
"""
import asyncio
import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter()


@router.get("/{session_id}/stream")
async def dashboard_stream(session_id: str):
    """Server-Sent Events로 실시간 아웃리치 상태 스트리밍"""

    async def event_generator():
        # 실제 구현: Redis Pub/Sub 구독
        # 여기서는 모의 이벤트로 시연
        events = [
            {"type": "sourcing_progress", "progress": 25, "message": "GPT-4o 검색 완료 (12개)"},
            {"type": "sourcing_progress", "progress": 50, "message": "Gemini 검색 완료 (9개)"},
            {"type": "sourcing_progress", "progress": 75, "message": "DeepSeek 검색 완료 (15개)"},
            {"type": "dedup_complete", "total_raw": 36, "total_dedup": 18, "message": "중복 제거 완료"},
            {"type": "outreach_sent", "manufacturer": "BASF SE", "channel": "email"},
            {"type": "outreach_replied", "manufacturer": "BASF SE", "channel": "email"},
        ]
        for event in events:
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
            await asyncio.sleep(1)

        yield "data: {\"type\": \"complete\"}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{session_id}/snapshot")
async def dashboard_snapshot(session_id: str):
    """현재 상태 스냅샷 (SSE 없이 한 번 조회)"""
    return {
        "session_id": session_id,
        "sourcing": {"status": "completed", "total_raw": 36, "total_dedup": 18},
        "outreach": {"sent": 12, "replied": 4, "pending": 6, "failed": 0},
        "channels": {
            "wechat": {"sent": 5, "replied": 2},
            "whatsapp": {"sent": 3, "replied": 1},
            "email": {"sent": 4, "replied": 1},
            "web_form": {"sent": 0, "replied": 0},
        },
    }
