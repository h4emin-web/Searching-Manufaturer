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
        # 연결 확인용 ping만 보내고 실제 이벤트는 없음
        # (실제 이메일 발송/응답 이벤트는 추후 Redis pub/sub으로 구현)
        yield f"data: {json.dumps({'type': 'connected', 'session_id': session_id})}\n\n"
        # 30초마다 keepalive ping (연결 유지)
        for _ in range(60):
            await asyncio.sleep(30)
            yield ": keepalive\n\n"

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
