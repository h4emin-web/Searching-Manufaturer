"""
규제 요건 라우터 - ③번: 의약용 선택 시 Step-by-step Form 데이터 제공
"""
from fastapi import APIRouter
from ..data.regulatory import (
    UseCase, get_requirements_for_use_case,
    get_mandatory_requirements, serialize_for_api,
)

router = APIRouter()


@router.get("/{use_case}")
async def get_regulatory_requirements(use_case: UseCase):
    """
    용도 선택 시 해당 규제 요건 목록 반환.
    의약품 선택 → WHO-GMP, WC, CoPP, KDMF 등 자동 노출.
    프론트엔드는 이 API를 호출하여 Step-by-step Form을 동적 렌더링.
    """
    requirements = get_requirements_for_use_case(use_case)
    return {
        "use_case": use_case.value,
        "total": len(requirements),
        "mandatory_count": len(get_mandatory_requirements(use_case)),
        "requirements": serialize_for_api(requirements),
    }
