import asyncio
import uuid
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
import httpx
import structlog

from ..models.schemas import OutreachPlan, OutreachAttempt, Manufacturer
from ..services.priority_queue import build_outreach_plan, execute_outreach_queue
from ..services.contact_extractor import batch_crawl_contacts, _parse_contacts_from_html
from ..services.email_sender import send_outreach_email
from ..agents.outreach_email_agent import generate_initial_email

logger = structlog.get_logger()
router = APIRouter()
_plans: dict[str, OutreachPlan] = {}
_plan_manufacturers: dict[str, dict[str, Manufacturer]] = {}

# 심플 플랜 - 메모리 캐시 (Supabase 가 primary)
_simple_plans: dict[str, dict] = {}


async def _load_plan(plan_id: str) -> dict | None:
    """메모리에 없으면 Supabase에서 로드"""
    if plan_id in _simple_plans:
        return _simple_plans[plan_id]
    from ..db import get_supabase
    db = get_supabase()
    if not db:
        return None
    try:
        rows = await db.select("simple_plans", {"plan_id": plan_id})
        if rows:
            _simple_plans[plan_id] = rows[0]
            return _simple_plans[plan_id]
    except Exception as exc:
        logger.warning("plan_load_failed", plan_id=plan_id, error=str(exc))
    return None


async def _save_plan(plan_id: str) -> None:
    """메모리 플랜을 Supabase에 저장"""
    plan = _simple_plans.get(plan_id)
    if not plan:
        return
    from ..db import get_supabase
    db = get_supabase()
    if not db:
        return
    try:
        await db.upsert("simple_plans", {
            "plan_id": plan_id,
            "status": plan.get("status", "running"),
            "items": plan.get("items", []),
        })
    except Exception as exc:
        logger.warning("plan_save_failed", plan_id=plan_id, error=str(exc))


class SimpleManufacturer(BaseModel):
    id: str
    name: str
    country: str
    contact_email: Optional[str] = None
    website: Optional[str] = None


class SimpleOutreachRequest(BaseModel):
    manufacturers: list[SimpleManufacturer]
    ingredient: str
    use_case: str = "pharmaceutical"
    requirements: list[str] = []
    sourcing_notes: str = ""
    requester_name: str = ""


@router.post("/simple-start")
async def simple_start_outreach(req: SimpleOutreachRequest, background_tasks: BackgroundTasks):
    """제조소 목록으로 이메일 크롤링 + 발송 시작"""
    plan_id = str(uuid.uuid4())
    items = [
        {
            "id": m.id,
            "name": m.name,
            "country": m.country,
            "email": m.contact_email,
            "website": m.website,
            "status": "pending",  # pending/crawling/sending/sent/webform/failed
            "contact_method": None,
            "error": None,
        }
        for m in req.manufacturers
    ]
    _simple_plans[plan_id] = {"status": "running", "items": items}
    background_tasks.add_task(_save_plan, plan_id)
    background_tasks.add_task(_run_simple_outreach, plan_id, req)
    return {"plan_id": plan_id, "total": len(items)}


@router.get("/simple-plans/{plan_id}")
async def get_simple_plan(plan_id: str):
    plan = await _load_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan


@router.get("/simple-plans/{plan_id}/threads")
async def get_plan_threads(plan_id: str):
    """플랜별 이메일 스레드 대화 내용 조회"""
    plan = await _load_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    from ..services.thread_store import thread_store
    threads = thread_store.find_by_plan(plan_id)
    thread_map = {t.manufacturer_id: t for t in threads}

    result = []
    for item in plan["items"]:
        thread = thread_map.get(item["id"])
        result.append({
            "manufacturer_id": item["id"],
            "manufacturer_name": item["name"],
            "country": item.get("country", ""),
            "email": item.get("email", ""),
            "status": item.get("status", "pending"),
            "sent_at": item.get("sent_at", ""),
            "email_subject": item.get("email_subject", ""),
            "email_body": item.get("email_body", ""),
            "web_form_url": item.get("web_form_url", ""),
            "error": item.get("error", ""),
            "escalated_questions": item.get("escalated_questions", []),
            "missing_items": item.get("missing_items", []),
            "conversation": thread.conversation if thread else [],
            "has_reply": thread.has_reply if thread else False,
            "auto_reply_count": thread.auto_reply_count if thread else 0,
        })
    return result


class ChatRequest(BaseModel):
    message: str


@router.post("/simple-plans/{plan_id}/chat")
async def chat_with_plan(plan_id: str, req: ChatRequest):
    """AI 어시스턴트 채팅 - 플랜 상태 기반 실시간 피드백"""
    plan = await _load_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    from ..services.thread_store import thread_store
    from ..config import get_settings

    settings = get_settings()
    if not settings.GEMINI_API_KEY:
        return {"reply": "AI 연결이 설정되지 않았습니다."}

    items = plan.get("items", [])
    threads = thread_store.find_by_plan(plan_id)
    thread_map = {t.manufacturer_id: t for t in threads}

    status_summary: dict[str, int] = {}
    for item in items:
        st = item.get("status", "pending")
        status_summary[st] = status_summary.get(st, 0) + 1

    manufacturer_lines = []
    for item in items:
        t = thread_map.get(item["id"])
        line = f"- {item['name']} ({item.get('country', '')}) [{item.get('status', 'pending')}]"
        if t and t.has_reply:
            line += " → 답장받음"
        if t and t.missing_items:
            line += f" 미수신: {', '.join(t.missing_items)}"
        manufacturer_lines.append(line)

    context = (
        "현재 소싱 진행 상황:\n"
        + "상태 요약: " + ", ".join(f"{k}: {v}건" for k, v in status_summary.items()) + "\n\n"
        + "제조원 목록:\n"
        + "\n".join(manufacturer_lines)
    )

    prompt = (
        "당신은 제약원료 소싱 전문가 AI 어시스턴트입니다.\n"
        "현재 아웃리치 캠페인 상황을 분석하고 사용자의 질문이나 요청에 답변하세요.\n\n"
        + context + "\n\n"
        + "사용자: " + req.message + "\n\n"
        "한국어로 간결하고 실용적으로 답변하세요. 3문장 이내로 핵심만 말하세요."
    )

    api_headers = {"Content-Type": "application/json", "X-goog-api-key": settings.GEMINI_API_KEY}
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 512},
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        for model in ["gemini-2.0-flash", "gemini-2.0-flash-lite"]:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            try:
                resp = await client.post(url, headers=api_headers, json=payload)
                if resp.is_success:
                    text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                    return {"reply": text.strip()}
            except Exception:
                continue

    return {"reply": "AI 응답 생성 실패. 잠시 후 다시 시도해주세요."}


class TranslateRequest(BaseModel):
    text: str
    target: str = "Korean"


@router.post("/translate")
async def translate_text(req: TranslateRequest):
    import httpx
    from ..config import get_settings
    settings = get_settings()
    if not settings.GEMINI_API_KEY or not req.text.strip():
        return {"translated": ""}
    instruction = "Return only the translated text, no explanation."
    target_lang = req.target
    prompt = "Translate to " + target_lang + ". Return only the translated text. Text: " + req.text[:3000]
    api_headers = {"Content-Type": "application/json", "X-goog-api-key": settings.GEMINI_API_KEY}
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 2048}
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        for model in ["gemini-2.0-flash", "gemini-2.0-flash-lite"]:
            base = "https://generativelanguage.googleapis.com/v1beta/models/"
            url = base + model + ":generateContent"
            try:
                resp = await client.post(url, headers=api_headers, json=payload)
                if resp.is_success:
                    result = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                    return {"translated": result.strip()}
            except Exception:
                continue
    return {"translated": ""}


async def _crawl_email_httpx(website: str) -> tuple[str | None, str | None]:
    """httpx로 웹사이트에서 이메일 + 웹폼 URL 추출 (Playwright 없이)"""
    if not website or not website.startswith("http"):
        return None, None
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            headers = {"User-Agent": "Mozilla/5.0 (compatible; PharmaBot/1.0)"}
            resp = await client.get(website, headers=headers)
            if not resp.is_success:
                return None, None
            found = _parse_contacts_from_html(resp.text, website)
            email = found["emails"][0] if found["emails"] else None
            web_form = found["contact_page_urls"][0] if found["contact_page_urls"] else website
            # contact 페이지가 있으면 추가 크롤링
            if found["contact_page_urls"] and not email:
                try:
                    c_resp = await client.get(found["contact_page_urls"][0], headers=headers)
                    if c_resp.is_success:
                        c_found = _parse_contacts_from_html(c_resp.text, found["contact_page_urls"][0])
                        if c_found["emails"]:
                            email = c_found["emails"][0]
                except Exception:
                    pass
            return email, web_form
    except Exception as e:
        logger.warning("httpx_crawl_failed", url=website, error=str(e))
        return None, None


async def _process_one_manufacturer(plan_id: str, idx: int, item: dict, req: SimpleOutreachRequest):
    """단일 제조소 처리: 이메일 찾기 → 발송 or 웹폼"""
    items = _simple_plans[plan_id]["items"]

    # 1. 이메일 크롤링 (이미 없는 경우)
    email = item["email"]
    web_form = None
    if not email and item["website"]:
        items[idx]["status"] = "crawling"
        email, web_form = await _crawl_email_httpx(item["website"])
        if email:
            items[idx]["email"] = email

    # 2. 이메일 발송 or 웹폼 안내
    if email:
        items[idx]["status"] = "sending"
        subject, body = await generate_initial_email(
            manufacturer_name=item["name"],
            manufacturer_country=item["country"],
            ingredient=req.ingredient,
            use_case=req.use_case,
            requirements=req.requirements,
            sourcing_notes=req.sourcing_notes,
            requester_name=req.requester_name,
        )
        # sourcing_notes에서 End User 공개 여부 파싱
        notes = req.sourcing_notes or ""
        end_user_disclosable = "불가능" not in notes
        end_user_name = ""
        for line in notes.splitlines():
            if "[End User 공개]" in line and "불가능" not in line:
                end_user_name = line.split("]")[-1].strip()

        success, error, _ = await send_outreach_email(
            to_email=email,
            manufacturer_name=item["name"],
            subject=subject,
            body_en=body,
            ingredient=req.ingredient,
            country=item["country"],
            plan_id=plan_id,
            manufacturer_id=item["id"],
            end_user_disclosable=end_user_disclosable,
            end_user_name=end_user_name,
        )
        if success:
            from datetime import datetime
            items[idx]["status"] = "sent"
            items[idx]["contact_method"] = "email"
            items[idx]["email_subject"] = subject
            items[idx]["email_body"] = body
            items[idx]["sent_at"] = datetime.utcnow().isoformat()
            logger.info("outreach_sent", manufacturer=item["name"], email=email)
        else:
            items[idx]["status"] = "failed"
            items[idx]["error"] = error
    else:
        # 이메일 없음 → 웹폼 안내
        items[idx]["status"] = "webform"
        items[idx]["contact_method"] = "webform"
        items[idx]["web_form_url"] = web_form or item["website"]
        logger.info("outreach_webform", manufacturer=item["name"], url=web_form)
    await _save_plan(plan_id)


async def _run_simple_outreach(plan_id: str, req: SimpleOutreachRequest):
    """백그라운드: 동시 5개씩 처리"""
    plan = _simple_plans[plan_id]
    items = plan["items"]
    semaphore = asyncio.Semaphore(5)

    async def _with_limit(idx: int, item: dict):
        async with semaphore:
            try:
                await _process_one_manufacturer(plan_id, idx, item, req)
            except Exception as e:
                items[idx]["status"] = "failed"
                items[idx]["error"] = str(e)

    await asyncio.gather(*[_with_limit(i, item) for i, item in enumerate(items)])
    plan["status"] = "completed"
    logger.info("simple_outreach_complete", plan_id=plan_id, total=len(items))
    await _save_plan(plan_id)


class CreatePlanRequest(BaseModel):
    session_id: str
    manufacturers: list[Manufacturer]
    message_templates: dict[str, dict[str, str]]  # {ko/en/zh: {subject, body}}
    auto_crawl: bool = True


@router.post("/plans", response_model=OutreachPlan)
async def create_plan(req: CreatePlanRequest, background_tasks: BackgroundTasks):
    """아웃리치 계획 생성 (Priority Queue 기반)"""
    if req.auto_crawl:
        crawled = await batch_crawl_contacts(
            [m for m in req.manufacturers if m.website],
            max_concurrent=5,
        )
        for mfr in req.manufacturers:
            if mfr.id in crawled:
                contacts = crawled[mfr.id]
                if not mfr.contact_email and contacts.get("email"):
                    mfr.contact_email = contacts["email"]
                if contacts.get("web_form_url"):
                    mfr.web_form_url = contacts["web_form_url"]

    plan = build_outreach_plan(
        session_id=req.session_id,
        manufacturers=req.manufacturers,
        message_templates=req.message_templates,
    )
    _plans[plan.id] = plan
    _plan_manufacturers[plan.id] = {m.id: m for m in req.manufacturers}
    return plan


@router.post("/plans/{plan_id}/start")
async def start_plan(plan_id: str, background_tasks: BackgroundTasks):
    plan = _plans.get(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    plan.status = "running"
    mfr_map = _plan_manufacturers.get(plan_id, {})
    background_tasks.add_task(_execute_plan, plan_id, mfr_map)
    return {"message": "Outreach started", "plan_id": plan_id}


@router.get("/plans/{plan_id}", response_model=OutreachPlan)
async def get_plan(plan_id: str):
    plan = _plans.get(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan


# ─── 이메일 직접 테스트 엔드포인트 ────────────────────────────
class TestEmailRequest(BaseModel):
    to_email: str
    manufacturer_name: str
    subject: str
    body_en: str
    body_ko: str = ""
    body_zh: str = ""


@router.post("/test-email")
async def test_email(req: TestEmailRequest):
    """이메일 발송 직접 테스트 (실제 전송)"""
    success, error, _ = await send_outreach_email(
        to_email=req.to_email,
        manufacturer_name=req.manufacturer_name,
        subject=req.subject,
        body_en=req.body_en,
        body_ko=req.body_ko,
        body_zh=req.body_zh,
    )
    if success:
        return {"status": "sent", "to": req.to_email}
    raise HTTPException(status_code=500, detail=f"Email failed: {error}")


# ─── 실제 발송 실행 ────────────────────────────────────────────
async def _execute_plan(plan_id: str, mfr_map: dict[str, Manufacturer]):
    plan = _plans[plan_id]

    async def _dispatch(attempt: OutreachAttempt, mfr: Manufacturer) -> bool:
        from ..models.schemas import OutreachChannel
        if attempt.channel == OutreachChannel.EMAIL and mfr.contact_email:
            success, _, __ = await send_outreach_email(
                to_email=mfr.contact_email,
                manufacturer_name=mfr.name,
                subject="Pharmaceutical Ingredient Sourcing Inquiry",
                body_en=attempt.message_en,
                body_ko=attempt.message_ko,
                body_zh=attempt.message_zh,
            )
            return success
        return False

    await execute_outreach_queue(
        plan=plan,
        manufacturers_by_id=mfr_map,
        dispatch_fn=_dispatch,
    )
    _plans[plan_id] = plan
