"""
Supabase REST API 경량 클라이언트 (supabase 패키지 없이 httpx 직접 사용)
"""
import httpx
from .config import get_settings


class SupabaseClient:
    def __init__(self, url: str, key: str):
        self.base_url = f"{url}/rest/v1"
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }

    async def select(self, table: str, filters: dict | None = None) -> list[dict]:
        params = {}
        if filters:
            for k, v in filters.items():
                params[k] = f"eq.{v}"
        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"{self.base_url}/{table}",
                headers={**self.headers, "Prefer": "return=representation"},
                params=params,
            )
            res.raise_for_status()
            return res.json()

    async def upsert(self, table: str, data: dict) -> None:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"{self.base_url}/{table}",
                headers={**self.headers, "Prefer": "resolution=merge-duplicates"},
                json=data,
            )
            res.raise_for_status()

    async def update(self, table: str, data: dict, filters: dict) -> None:
        params = {k: f"eq.{v}" for k, v in filters.items()}
        async with httpx.AsyncClient() as client:
            res = await client.patch(
                f"{self.base_url}/{table}",
                headers=self.headers,
                params=params,
                json=data,
            )
            res.raise_for_status()


_client: SupabaseClient | None = None


def get_supabase() -> SupabaseClient | None:
    global _client
    if _client is not None:
        return _client
    settings = get_settings()
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        return None
    _client = SupabaseClient(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    return _client
