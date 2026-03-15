from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

from ..models.schemas import OutreachPlan, OutreachAttempt, Manufacturer
from ..services.priority_queue import build_outreach_plan, execute_outreach_queue
from ..services.contact_extractor import batch_crawl_contacts
from ..services.email_sender import send_outreach_email

router = APIRouter()
_plans: dict[str, OutreachPlan] = {}
_plan_manufacturers: dict[str, dict[str, Manufacturer]] = {}


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
    success, error = await send_outreach_email(
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
            success, _ = await send_outreach_email(
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
