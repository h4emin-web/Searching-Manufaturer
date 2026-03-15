from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import structlog

from .config import get_settings
from .routers import sessions, sourcing, outreach, regulatory, dashboard, debug, users
from .services.email_receiver import start_polling
from .services.reply_handler import handle_reply
from .services.followup_scheduler import run_followup_scheduler

logger = structlog.get_logger()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("startup", app=settings.APP_NAME)

    # Supabase 초기화 + 기존 스레드 로드
    from .db import get_supabase
    from .services.thread_store import thread_store
    db = get_supabase()
    if db:
        thread_store.set_db(db)
        await thread_store.load_from_db()
        logger.info("supabase_connected")
    else:
        logger.warning("supabase_not_configured_using_memory")

    poller_task = asyncio.create_task(start_polling(handle_reply))
    followup_task = asyncio.create_task(run_followup_scheduler())
    yield
    poller_task.cancel()
    followup_task.cancel()
    logger.info("shutdown")


app = FastAPI(
    title="Pharma Sourcing Agent API",
    description="AI 기반 의약품 원료 소싱 자동화 시스템",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(sessions.router,   prefix=f"{settings.API_PREFIX}/sessions",   tags=["Sessions"])
app.include_router(regulatory.router, prefix=f"{settings.API_PREFIX}/regulatory",  tags=["Regulatory"])
app.include_router(sourcing.router,   prefix=f"{settings.API_PREFIX}/sourcing",    tags=["Sourcing"])
app.include_router(outreach.router,   prefix=f"{settings.API_PREFIX}/outreach",    tags=["Outreach"])
app.include_router(dashboard.router,  prefix=f"{settings.API_PREFIX}/dashboard",   tags=["Dashboard"])
app.include_router(debug.router,      prefix=f"{settings.API_PREFIX}/debug",       tags=["Debug"])
app.include_router(users.router,      prefix=f"{settings.API_PREFIX}/users",       tags=["Users"])


@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME}
