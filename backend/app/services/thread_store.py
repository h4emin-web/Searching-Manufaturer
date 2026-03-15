"""
이메일 스레드 저장소
- 인메모리(primary) + Supabase(persistence) 하이브리드
- 기존 동기 API 유지 (callers 변경 없음)
- Supabase ops는 백그라운드 asyncio task로 처리
"""
import asyncio
from dataclasses import dataclass, field
from datetime import datetime
import structlog

logger = structlog.get_logger()


@dataclass
class EmailThread:
    message_id: str             # 우리가 보낸 최초 메일의 Message-ID
    last_message_id: str        # 가장 최근 발송 Message-ID (In-Reply-To용)
    to_email: str
    manufacturer_name: str
    ingredient: str             # 소싱 중인 원료명
    subject: str
    country: str = ""           # 제조원 국가 (언어 선택용)
    auto_reply_count: int = 0   # 자동 답변 횟수 (무한루프 방지)
    max_auto_replies: int = 3
    conversation: list[dict] = field(default_factory=list)


class ThreadStore:
    def __init__(self):
        self._threads: dict[str, EmailThread] = {}
        self._by_message_id: dict[str, str] = {}   # any_msg_id → original_message_id
        self._db = None  # Supabase AsyncClient (설정 후 주입)

    def set_db(self, client) -> None:
        self._db = client

    # ─── 로드 (서버 시작 시 Supabase → 메모리) ─────────────────
    async def load_from_db(self) -> None:
        if not self._db:
            return
        try:
            res = await self._db.table("email_threads").select("*").execute()
            for row in res.data:
                thread = self._row_to_thread(row)
                self._threads[thread.message_id] = thread

            idx_res = await self._db.table("thread_message_index").select("*").execute()
            for row in idx_res.data:
                self._by_message_id[row["any_message_id"]] = row["original_message_id"]

            logger.info("thread_store_loaded", count=len(self._threads))
        except Exception as exc:
            logger.warning("thread_store_load_failed", error=str(exc))

    # ─── 등록 ────────────────────────────────────────────────────
    def register(
        self,
        message_id: str,
        to_email: str,
        manufacturer_name: str,
        ingredient: str,
        subject: str,
        body: str,
        country: str = "",
    ) -> None:
        thread = EmailThread(
            message_id=message_id,
            last_message_id=message_id,
            to_email=to_email,
            manufacturer_name=manufacturer_name,
            ingredient=ingredient,
            subject=subject,
            country=country,
            conversation=[{"role": "us", "body": body, "sent_at": datetime.utcnow().isoformat()}],
        )
        self._threads[message_id] = thread
        self._by_message_id[message_id] = message_id

        self._bg(self._persist_thread(thread))
        self._bg(self._persist_index(message_id, message_id))

    # ─── 조회 ────────────────────────────────────────────────────
    def find_thread_by_reply(self, in_reply_to: str, references: str = "") -> EmailThread | None:
        for msg_id in [in_reply_to] + references.split():
            msg_id = msg_id.strip()
            origin = self._by_message_id.get(msg_id)
            if origin and origin in self._threads:
                return self._threads[origin]
        return None

    # ─── 대화 추가 ───────────────────────────────────────────────
    def add_reply(self, thread: EmailThread, body: str) -> None:
        thread.conversation.append({
            "role": "manufacturer",
            "body": body,
            "sent_at": datetime.utcnow().isoformat(),
        })
        self._bg(self._update_conversation(thread))

    def add_our_reply(self, thread: EmailThread, message_id: str, body: str) -> None:
        thread.conversation.append({
            "role": "us",
            "body": body,
            "sent_at": datetime.utcnow().isoformat(),
        })
        thread.last_message_id = message_id
        thread.auto_reply_count += 1
        self._by_message_id[message_id] = thread.message_id

        self._bg(self._update_conversation(thread))
        self._bg(self._persist_index(message_id, thread.message_id))

    def can_auto_reply(self, thread: EmailThread) -> bool:
        return thread.auto_reply_count < thread.max_auto_replies

    def all_threads(self) -> list[EmailThread]:
        return list(self._threads.values())

    # ─── 내부 헬퍼 ───────────────────────────────────────────────
    def _bg(self, coro) -> None:
        """백그라운드 asyncio task로 실행 (fire-and-forget)"""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(coro)
        except RuntimeError:
            pass

    def _row_to_thread(self, row: dict) -> EmailThread:
        return EmailThread(
            message_id=row["message_id"],
            last_message_id=row["last_message_id"],
            to_email=row["to_email"],
            manufacturer_name=row["manufacturer_name"],
            ingredient=row["ingredient"],
            subject=row["subject"],
            country=row.get("country", ""),
            auto_reply_count=row.get("auto_reply_count", 0),
            max_auto_replies=row.get("max_auto_replies", 3),
            conversation=row.get("conversation", []),
        )

    async def _persist_thread(self, thread: EmailThread) -> None:
        if not self._db:
            return
        try:
            await self._db.table("email_threads").upsert({
                "message_id": thread.message_id,
                "last_message_id": thread.last_message_id,
                "to_email": thread.to_email,
                "manufacturer_name": thread.manufacturer_name,
                "ingredient": thread.ingredient,
                "subject": thread.subject,
                "country": thread.country,
                "auto_reply_count": thread.auto_reply_count,
                "max_auto_replies": thread.max_auto_replies,
                "conversation": thread.conversation,
            }).execute()
        except Exception as exc:
            logger.warning("thread_persist_failed", error=str(exc))

    async def _update_conversation(self, thread: EmailThread) -> None:
        if not self._db:
            return
        try:
            await self._db.table("email_threads").update({
                "conversation": thread.conversation,
                "last_message_id": thread.last_message_id,
                "auto_reply_count": thread.auto_reply_count,
            }).eq("message_id", thread.message_id).execute()
        except Exception as exc:
            logger.warning("thread_update_failed", error=str(exc))

    async def _persist_index(self, any_msg_id: str, original_msg_id: str) -> None:
        if not self._db:
            return
        try:
            await self._db.table("thread_message_index").upsert({
                "any_message_id": any_msg_id,
                "original_message_id": original_msg_id,
            }).execute()
        except Exception as exc:
            logger.warning("thread_index_persist_failed", error=str(exc))


# 싱글톤
thread_store = ThreadStore()
