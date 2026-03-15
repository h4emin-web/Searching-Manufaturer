"""
규제 요건 데이터베이스 - 의약품 소싱 시 인터랙티브 체크리스트 제공
사용자가 '의약용'을 선택하면 Step-by-step Form으로 자동 노출
"""
from dataclasses import dataclass, field
from enum import Enum


class UseCase(str, Enum):
    PHARMACEUTICAL = "pharmaceutical"
    COSMETIC = "cosmetic"
    FOOD = "food"


class RequirementLevel(str, Enum):
    MANDATORY = "mandatory"       # 반드시 필요
    RECOMMENDED = "recommended"   # 권장
    OPTIONAL = "optional"         # 선택


@dataclass
class RegulatoryRequirement:
    id: str
    name_ko: str
    name_en: str
    description_ko: str
    description_en: str
    level: RequirementLevel
    applicable_use_cases: list[UseCase]
    sub_requirements: list["RegulatoryRequirement"] = field(default_factory=list)
    reference_url: str = ""
    tooltip_ko: str = ""
    tooltip_en: str = ""


# ============================================================
# 전체 규제 요건 정의
# ============================================================
REGULATORY_DATABASE: list[RegulatoryRequirement] = [

    # ─── WHO-GMP ─────────────────────────────────────────────
    RegulatoryRequirement(
        id="WHO-GMP",
        name_ko="WHO-GMP 인증",
        name_en="WHO Good Manufacturing Practice",
        description_ko="세계보건기구(WHO) 우수의약품 제조관리기준. 국제 입찰 및 수출용 의약품에 필수.",
        description_en="WHO Good Manufacturing Practice certificate. Required for international tenders and export-grade pharmaceuticals.",
        level=RequirementLevel.MANDATORY,
        applicable_use_cases=[UseCase.PHARMACEUTICAL],
        tooltip_ko="WHO-GMP 없는 제조소는 한국 식약처 DMF 등록이 불가합니다.",
        tooltip_en="Manufacturers without WHO-GMP cannot register DMF with MFDS Korea.",
        reference_url="https://www.who.int/medicines/areas/quality_safety/quality_assurance/production/en/",
        sub_requirements=[
            RegulatoryRequirement(
                id="WHO-GMP-AUDIT",
                name_ko="WHO-GMP 실사 보고서",
                name_en="WHO-GMP Inspection Report",
                description_ko="최근 3년 이내 실사 보고서 요청 가능 여부 확인",
                description_en="Confirm availability of inspection report within last 3 years",
                level=RequirementLevel.RECOMMENDED,
                applicable_use_cases=[UseCase.PHARMACEUTICAL],
            ),
            RegulatoryRequirement(
                id="WHO-GMP-VALIDITY",
                name_ko="인증 유효기간",
                name_en="Certificate Validity",
                description_ko="GMP 인증서 유효기간 만료 여부 확인 (통상 3년)",
                description_en="Verify certificate expiry (typically 3 years)",
                level=RequirementLevel.MANDATORY,
                applicable_use_cases=[UseCase.PHARMACEUTICAL],
            ),
        ]
    ),

    # ─── Written Confirmation (WC) ───────────────────────────
    RegulatoryRequirement(
        id="WC",
        name_ko="서면확인서 (WC)",
        name_en="Written Confirmation",
        description_ko="EU GMP 적합 여부에 대한 제조소의 서면 확인서. EU 수출용 원료에 필수.",
        description_en="Written confirmation from manufacturer of EU GMP compliance. Mandatory for APIs exported to EU.",
        level=RequirementLevel.MANDATORY,
        applicable_use_cases=[UseCase.PHARMACEUTICAL],
        tooltip_ko="EMA Directive 2011/62/EU에 따른 요건입니다.",
        reference_url="https://www.ema.europa.eu/en/human-regulatory/research-development/compliance/good-manufacturing-practice",
        sub_requirements=[
            RegulatoryRequirement(
                id="WC-EU-AUDIT",
                name_ko="EU EDQM 실사",
                name_en="EU EDQM Audit",
                description_ko="EDQM(유럽의약품품질관리국) Certificate of Suitability (CEP) 보유 여부",
                description_en="EDQM Certificate of Suitability (CEP) availability",
                level=RequirementLevel.RECOMMENDED,
                applicable_use_cases=[UseCase.PHARMACEUTICAL],
            ),
        ]
    ),

    # ─── CoPP ────────────────────────────────────────────────
    RegulatoryRequirement(
        id="COPP",
        name_ko="원산지 적합 증명서 (CoPP)",
        name_en="Certificate of Pharmaceutical Product (CoPP)",
        description_ko="WHO 기준에 따른 의약품 원산지 증명서. 수출입 허가에 활용.",
        description_en="WHO-format certificate confirming product is manufactured in compliance with standards of originating country.",
        level=RequirementLevel.MANDATORY,
        applicable_use_cases=[UseCase.PHARMACEUTICAL],
        tooltip_ko="한국 식약처 수입 허가 신청 시 제출 서류입니다.",
        sub_requirements=[
            RegulatoryRequirement(
                id="COPP-NOTARIZED",
                name_ko="공증/아포스티유",
                name_en="Notarization / Apostille",
                description_ko="현지 정부 기관 공증 또는 헤이그협약 아포스티유 필요 여부",
                description_en="Whether notarization or Apostille is required for the destination country",
                level=RequirementLevel.OPTIONAL,
                applicable_use_cases=[UseCase.PHARMACEUTICAL],
            ),
        ]
    ),

    # ─── KDMF ────────────────────────────────────────────────
    RegulatoryRequirement(
        id="KDMF",
        name_ko="한국 원료의약품 등록 (KDMF)",
        name_en="Korea Drug Master File",
        description_ko="식품의약품안전처(MFDS)에 원료의약품 등록 파일 제출. 한국 시판 완제품에 필수.",
        description_en="Drug Master File registration with Korea MFDS for APIs used in Korea-marketed finished products.",
        level=RequirementLevel.MANDATORY,
        applicable_use_cases=[UseCase.PHARMACEUTICAL],
        tooltip_ko="KDMF 미등록 원료는 완제의약품 품목허가 갱신이 불가합니다.",
        reference_url="https://www.mfds.go.kr",
        sub_requirements=[
            RegulatoryRequirement(
                id="KDMF-LOA",
                name_ko="접근 허가서 (LOA)",
                name_en="Letter of Access (LOA)",
                description_ko="제조소가 KDMF 등록 후 구매자에게 접근권한 부여하는 문서",
                description_en="Document granting buyer access to KDMF filing after manufacturer registration",
                level=RequirementLevel.MANDATORY,
                applicable_use_cases=[UseCase.PHARMACEUTICAL],
            ),
            RegulatoryRequirement(
                id="KDMF-REGISTRATION",
                name_ko="KDMF 등록 가능 여부",
                name_en="KDMF Registration Capability",
                description_ko="제조소가 직접 또는 대리인을 통해 KDMF 등록 의향 및 능력 보유 여부",
                description_en="Whether manufacturer can register KDMF directly or via Korean agent",
                level=RequirementLevel.MANDATORY,
                applicable_use_cases=[UseCase.PHARMACEUTICAL],
            ),
        ]
    ),

    # ─── ICH Q7 (API GMP) ────────────────────────────────────
    RegulatoryRequirement(
        id="ICH-Q7",
        name_ko="ICH Q7 (원료의약품 GMP)",
        name_en="ICH Q7 Active Pharmaceutical Ingredient GMP",
        description_ko="ICH Q7 가이드라인에 따른 원료의약품 제조관리기준 준수 여부",
        description_en="Compliance with ICH Q7 GMP guidelines for active pharmaceutical ingredients",
        level=RequirementLevel.RECOMMENDED,
        applicable_use_cases=[UseCase.PHARMACEUTICAL],
    ),

    # ─── ISO (화장품/식품) ─────────────────────────────────────
    RegulatoryRequirement(
        id="ISO-22716",
        name_ko="ISO 22716 (화장품 GMP)",
        name_en="ISO 22716 Cosmetic GMP",
        description_ko="국제표준화기구 화장품 우수제조관리기준",
        description_en="ISO standard for Good Manufacturing Practices in cosmetics",
        level=RequirementLevel.MANDATORY,
        applicable_use_cases=[UseCase.COSMETIC],
    ),

    RegulatoryRequirement(
        id="HACCP",
        name_ko="HACCP 인증",
        name_en="Hazard Analysis Critical Control Points",
        description_ko="식품 제조 위해요소 중요관리점 인증",
        description_en="Food safety management certification",
        level=RequirementLevel.MANDATORY,
        applicable_use_cases=[UseCase.FOOD],
    ),
]


def get_requirements_for_use_case(use_case: UseCase) -> list[RegulatoryRequirement]:
    """선택된 용도에 맞는 규제 요건만 필터링하여 반환 (Step-by-step Form 데이터)"""
    return [
        req for req in REGULATORY_DATABASE
        if use_case in req.applicable_use_cases
    ]


def get_mandatory_requirements(use_case: UseCase) -> list[RegulatoryRequirement]:
    """필수(MANDATORY) 요건만 반환"""
    return [
        req for req in get_requirements_for_use_case(use_case)
        if req.level == RequirementLevel.MANDATORY
    ]


def serialize_for_api(reqs: list[RegulatoryRequirement]) -> list[dict]:
    """API 응답용 직렬화"""
    def _serialize(r: RegulatoryRequirement) -> dict:
        return {
            "id": r.id,
            "name_ko": r.name_ko,
            "name_en": r.name_en,
            "description_ko": r.description_ko,
            "description_en": r.description_en,
            "level": r.level.value,
            "tooltip_ko": r.tooltip_ko,
            "tooltip_en": r.tooltip_en,
            "reference_url": r.reference_url,
            "is_selected": r.level == RequirementLevel.MANDATORY,  # 기본 선택값
            "sub_requirements": [_serialize(s) for s in r.sub_requirements],
        }
    return [_serialize(r) for r in reqs]
