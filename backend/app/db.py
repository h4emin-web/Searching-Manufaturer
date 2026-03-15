"""
Supabase 클라이언트 싱글톤
"""
from supabase import AsyncClient, acreate_client
from .config import get_settings

_client: AsyncClient | None = None


async def get_supabase() -> AsyncClient | None:
    """Supabase 클라이언트 반환. URL/KEY 미설정 시 None."""
    global _client
    if _client is not None:
        return _client

    settings = get_settings()
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        return None

    _client = await acreate_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    return _client
