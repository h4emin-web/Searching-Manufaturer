"""
이메일 스레드 저장소
- 인메모리(primary) + Supabase REST(persistence) 하이브리드
- 기존 동기 API 유지, Supabase ops는 백그라운드 asyncio task
"""
import asyncio
from dataclasses import dataclass, field
from datetime import datetime
import structlog

logger = structlog.get_logger()


@dataclass
class EmailThread:
    message_id: str
    last_message_id: str
    to_email: str
    manufacturer_name: str
    ingredient: str
    subject: str
    country: str = ""
    auto_reply_count: int = 0
    max_auto_replies: int = 999
    follow_up_count: int = 0
    has_reply: bool = False
    last_sent_at: str = ""
    escalated_questions: list[str] = field(default_factory=list)
    missing_items: list[str] = field(default_factory=list)
    plan_id: str = ""
    manufacturer_id: str = ""
    conversation: list[dict] = field(default_factory=list)
    end_user_disclosable: bool = True
    end_user_name: str = ""


class ThreadStore:
    def __init__(self):
        self._threads: dict[str, EmailThread] = {}
        self._by_message_id: dict[str, str] = {}
        self._db = None  # SupabaseClient

    def set_db(self, client) -> None:
        self._db = client

    async def load_from_db(self) -> None:
        if not self._db:
            return
        try:
            rows = await self._db.select("email_threads")
            for row in rows:
                t = self._row_to_thread(row)
                self._threads[t.message_id] = t

            idx_rows = await self._db.select("thread_message_index")
            for row in idx_rows:
                self._by_message_id[row["any_message_id"]] = row["original_message_id"]

            logger.info("thread_store_loaded", count=len(self._threads))
        except Exception as exc:
            logger.warning("thread_store_load_failed", error=str(exc))

    def register(self, message_id, to_email, manufacturer_name, ingredient, subject, body, country="", plan_id="", manufacturer_id="", end_user_disclosable=True, end_user_name=""):
        now = datetime.utcnow().isoformat()
        thread = EmailThread(
            message_id=message_id,
            last_message_id=message_id,
            to_email=to_email,
            manufacturer_name=manufacturer_name,
            ingredient=ingredient,
            subject=subject,
            country=country,
            last_sent_at=now,
            plan_id=plan_id,
            manufacturer_id=manufacturer_id,
            conversation=[{"role": "us", "body": body, "sent_at": now}],
            end_user_disclosable=end_user_disclosable,
            end_user_name=end_user_name,
        )
        self._threads[message_id] = thread
        # Index both with and without angle brackets for robust matching
        normalized = self._normalize_msgid(message_id)
        self._by_message_id[message_id] = message_id
        self._by_message_id[normalized] = message_id
        self._by_message_id[f"<{normalized}>"] = message_id
        self._bg(self._persist_thread(thread))
        self._bg(self._persist_index(message_id, message_id))

    @staticmethod
    def _normalize_msgid(raw: str) -> str:
        return raw.strip().strip("<>").strip()

    def find_thread_by_reply(self, in_reply_to: str, references: str = "") -> EmailThread | None:
        candidates = [in_reply_to] + references.split()
        for raw in candidates:
            for lookup in [raw.strip(), self._normalize_msgid(raw), f"<{self._normalize_msgid(raw)}>"]:
                origin = self._by_message_id.get(lookup)
                if origin and origin in self._threads:
                    return self._threads[origin]
        return None

    def add_reply(self, thread: EmailThread, body: str) -> None:
        thread.has_reply = True
        thread.conversation.append({"role": "manufacturer", "body": body, "sent_at": datetime.utcnow().isoformat()})
        self._bg(self._update_thread(thread))

    def add_our_reply(self, thread: EmailThread, message_id: str, body: str) -> None:
        now = datetime.utcnow().isoformat()
        thread.conversation.append({"role": "us", "body": body, "sent_at": now})
        thread.last_message_id = message_id
        thread.last_sent_at = now
        thread.auto_reply_count += 1
        self._by_message_id[message_id] = thread.message_id
        self._bg(self._update_thread(thread))
        self._bg(self._persist_index(message_id, thread.message_id))

    def increment_followup(self, thread: EmailThread) -> None:
        """팔로업 카운트 증가 + DB 저장"""
        thread.follow_up_count += 1
        self._bg(self._update_thread(thread))

    def can_auto_reply(self, thread: EmailThread) -> bool:
        # auto_reply_count가 max_auto_replies 미만이면 계속 자동 답변
        return thread.auto_reply_count < thread.max_auto_replies

    def can_follow_up(self, thread: EmailThread) -> bool:
        return not thread.has_reply and thread.follow_up_count < 2

    def needs_followup(self, thread: EmailThread, hours: int = 24) -> bool:
        """마지막 발송 후 hours 시간 경과 여부"""
        if not thread.last_sent_at or thread.has_reply:
            return False
        try:
            last = datetime.fromisoformat(thread.last_sent_at)
            elapsed = (datetime.utcnow() - last).total_seconds() / 3600
            return elapsed >= hours
        except Exception:
            return False

    def set_escalated(self, thread: EmailThread, questions: list[str], missing: list[str]) -> None:
        thread.escalated_questions = questions
        thread.missing_items = missing
        self._bg(self._update_thread(thread))

    def find_by_plan(self, plan_id: str) -> list[EmailThread]:
        return [t for t in self._threads.values() if t.plan_id == plan_id]

    def all_threads(self) -> list[EmailThread]:
        return list(self._threads.values())

    def _bg(self, coro) -> None:
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
            max_auto_replies=row.get("max_auto_replies", 999),
            follow_up_count=row.get("follow_up_count", 0),
            has_reply=row.get("has_reply", False),
            last_sent_at=row.get("last_sent_at", ""),
            plan_id=row.get("plan_id", ""),
            manufacturer_id=row.get("manufacturer_id", ""),
            conversation=row.get("conversation", []),
        )

    async def _persist_thread(self, thread: EmailThread) -> None:
        if not self._db:
            return
        try:
            await self._db.upsert("email_threads", {
                "message_id": thread.message_id,
                "last_message_id": thread.last_message_id,
                "to_email": thread.to_email,
                "manufacturer_name": thread.manufacturer_name,
                "ingredient": thread.ingredient,
                "subject": thread.subject,
                "country": thread.country,
                "auto_reply_count": thread.auto_reply_count,
                "max_auto_replies": thread.max_auto_replies,
                "follow_up_count": thread.follow_up_count,
                "has_reply": thread.has_reply,
                "last_sent_at": thread.last_sent_at,
                "plan_id": thread.plan_id,
                "manufacturer_id": thread.manufacturer_id,
                "conversation": thread.conversation,
            })
        except Exception as exc:
            logger.warning("thread_persist_failed", error=str(exc))

    async def _update_thread(self, thread: EmailThread) -> None:
        if not self._db:
            return
        try:
            await self._db.update("email_threads", {
                "conversation": thread.conversation,
                "last_message_id": thread.last_message_id,
                "last_sent_at": thread.last_sent_at,
                "auto_reply_count": thread.auto_reply_count,
                "follow_up_count": thread.follow_up_count,
                "has_reply": thread.has_reply,
            }, {"message_id": thread.message_id})
        except Exception as exc:
            logger.warning("thread_update_failed", error=str(exc))

    async def _persist_index(self, any_msg_id: str, original_msg_id: str) -> None:
        if not self._db:
            return
        try:
            await self._db.upsert("thread_message_index", {
                "any_message_id": any_msg_id,
                "original_message_id": original_msg_id,
            })
        except Exception as exc:
            logger.warning("thread_index_persist_failed", error=str(exc))


thread_store = ThreadStore()
