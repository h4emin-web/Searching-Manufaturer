"""
제조소 중복 제거 서비스 - ①번 핵심 포인트
- Phase 1: 정규화된 이름 기반 정확 매칭
- Phase 2: RapidFuzz Similarity Score (token_sort_ratio) > threshold
- Phase 3: 여러 LLM 결과에서 서로 다른 정보(이메일, 인증정보 등) 병합(Merge)
"""
import re
import uuid
from dataclasses import dataclass, field
from typing import NamedTuple

from rapidfuzz import fuzz, process
import structlog

from ..models.schemas import RawManufacturer, Manufacturer, LLMProvider
from ..config import get_settings

logger = structlog.get_logger()
settings = get_settings()


# ─── 정규화 유틸 ──────────────────────────────────────────────
# 제거할 법인격 표현 (영/중/한)
LEGAL_SUFFIXES = re.compile(
    r"\b(co\.?,?\s*ltd\.?|inc\.?|corp\.?|llc\.?|gmbh|s\.a\.?|pvt\.?|"
    r"pharmaceutical[s]?|pharma|chemical[s]?|chem|group|holding[s]?|"
    r"有限公司|股份有限公司|制药|化工|集团|주식회사|㈜)\b",
    re.IGNORECASE,
)

def normalize_name(name: str) -> str:
    """제조소명 정규화: 소문자, 법인격 제거, 특수문자 제거"""
    n = name.lower().strip()
    n = LEGAL_SUFFIXES.sub("", n)
    n = re.sub(r"[^\w\s]", " ", n)  # 특수문자 → 공백
    n = re.sub(r"\s+", " ", n).strip()
    return n


# ─── 유사도 계산 ──────────────────────────────────────────────
class SimilarityResult(NamedTuple):
    score: float            # 0.0 ~ 1.0
    method: str             # "exact", "token_sort", "partial", "country_boost"
    is_match: bool


def compute_similarity(name_a: str, name_b: str, country_a: str = "", country_b: str = "") -> SimilarityResult:
    """
    복합 유사도 계산:
    1. token_sort_ratio: 단어 순서 무관 유사도 (주된 지표)
    2. partial_ratio: 하나가 다른 이름의 부분집합인 경우
    3. 같은 국가면 +5% 부스트
    """
    norm_a = normalize_name(name_a)
    norm_b = normalize_name(name_b)

    # 정확 매칭
    if norm_a == norm_b:
        return SimilarityResult(1.0, "exact", True)

    # RapidFuzz token_sort_ratio (단어 순서 무관)
    token_score = fuzz.token_sort_ratio(norm_a, norm_b) / 100.0

    # partial_ratio (한쪽이 약어인 경우)
    partial_score = fuzz.partial_ratio(norm_a, norm_b) / 100.0

    # 최대값 선택
    base_score = max(token_score, partial_score)
    method = "token_sort" if token_score >= partial_score else "partial"

    # 국가 일치 부스트 (+0.05)
    country_boost = 0.05 if (
        country_a and country_b and
        country_a.lower().strip() == country_b.lower().strip()
    ) else 0.0

    final_score = min(1.0, base_score + country_boost)
    if country_boost > 0:
        method = f"{method}+country_boost"

    threshold = settings.DEDUP_SIMILARITY_THRESHOLD
    return SimilarityResult(final_score, method, final_score >= threshold)


# ─── 정보 병합 로직 ───────────────────────────────────────────
def merge_manufacturers(existing: Manufacturer, new_raw: RawManufacturer) -> Manufacturer:
    """
    기존 제조소에 새 LLM 결과를 병합:
    - 연락처: null이면 새 값으로 채움 (A모델=이메일, B모델=WeChat → 둘 다 보존)
    - 인증정보: 합집합
    - confidence_score: 가중 평균 (소스가 많을수록 높아짐)
    - source_llms: 추가
    """
    updated = existing.model_copy(deep=True)

    # 연락처 병합 (null-fill 전략)
    if not updated.contact_email and new_raw.contact_email:
        updated.contact_email = new_raw.contact_email
    if not updated.contact_wechat and new_raw.contact_wechat:
        updated.contact_wechat = new_raw.contact_wechat
    if not updated.contact_whatsapp and new_raw.contact_whatsapp:
        updated.contact_whatsapp = new_raw.contact_whatsapp
    if not updated.website and new_raw.website:
        updated.website = new_raw.website
        updated.web_form_url = new_raw.website   # 초기 web_form은 website로
    if not updated.city and new_raw.city:
        updated.city = new_raw.city
    if not updated.country_code and new_raw.country_code:
        updated.country_code = new_raw.country_code

    # 인증 합집합
    existing_certs = set(updated.certifications)
    new_certs = set(new_raw.certifications)
    updated.certifications = sorted(existing_certs | new_certs)

    # confidence_score 가중 평균
    n = len(updated.source_llms)
    updated.confidence_score = (updated.confidence_score * n + new_raw.confidence_score) / (n + 1)

    # source_llms 추가 (중복 제거)
    if new_raw.source_llm not in updated.source_llms:
        updated.source_llms.append(new_raw.source_llm)

    return updated


# ─── 메인 중복 제거 엔진 ──────────────────────────────────────
@dataclass
class DeduplicationResult:
    manufacturers: list[Manufacturer]
    total_raw: int
    total_deduplicated: int
    merge_log: list[dict] = field(default_factory=list)  # 병합 기록 (디버깅용)

    @property
    def dedup_ratio(self) -> float:
        if self.total_raw == 0:
            return 0.0
        return 1.0 - (self.total_deduplicated / self.total_raw)


def deduplicate_manufacturers(
    llm_results: dict[LLMProvider, list[RawManufacturer]],
    similarity_threshold: float | None = None,
) -> DeduplicationResult:
    """
    Multi-LLM 결과에서 중복 제거 + 정보 병합

    알고리즘:
    1. 모든 결과를 단일 목록으로 평탄화
    2. 정규화된 이름으로 인덱스 구축
    3. 각 항목에 대해 기존 항목과 유사도 계산
    4. threshold 이상이면 병합, 미만이면 새 항목으로 추가
    5. 결과를 confidence_score 내림차순 정렬
    """
    threshold = similarity_threshold or settings.DEDUP_SIMILARITY_THRESHOLD
    merge_log = []

    # 평탄화 (모든 LLM 결과 합치기)
    all_raw: list[RawManufacturer] = []
    for provider, results in llm_results.items():
        all_raw.extend(results)

    total_raw = len(all_raw)
    logger.info("dedup_start", total_raw=total_raw, threshold=threshold)

    # 정규화 이름 → Manufacturer 맵
    canonical_map: dict[str, Manufacturer] = {}  # key: normalized_name

    for raw in all_raw:
        norm = normalize_name(raw.name)
        matched_key: str | None = None
        best_score = 0.0

        # 기존 항목들과 유사도 비교
        for existing_norm in canonical_map:
            sim = compute_similarity(
                norm, existing_norm,
                country_a=raw.country,
                country_b=canonical_map[existing_norm].country,
            )
            if sim.is_match and sim.score > best_score:
                best_score = sim.score
                matched_key = existing_norm

        if matched_key:
            # 병합
            before_sources = list(canonical_map[matched_key].source_llms)
            canonical_map[matched_key] = merge_manufacturers(
                canonical_map[matched_key], raw
            )
            merge_log.append({
                "action": "merged",
                "target": matched_key,
                "source_name": raw.name,
                "source_llm": raw.source_llm.value,
                "similarity_score": round(best_score, 3),
                "sources_before": [p.value for p in before_sources],
                "sources_after": [p.value for p in canonical_map[matched_key].source_llms],
            })
        else:
            # 신규 항목
            new_mfr = Manufacturer(
                id=str(uuid.uuid4()),
                name=raw.name,
                canonical_name=norm,
                country=raw.country,
                country_code=raw.country_code,
                city=raw.city,
                contact_email=raw.contact_email,
                contact_wechat=raw.contact_wechat,
                contact_whatsapp=raw.contact_whatsapp,
                website=raw.website,
                web_form_url=raw.website,
                certifications=raw.certifications,
                source_llms=[raw.source_llm],
                confidence_score=raw.confidence_score,
                merge_similarity_score=None,
            )
            canonical_map[norm] = new_mfr
            merge_log.append({
                "action": "new",
                "name": raw.name,
                "normalized": norm,
                "source_llm": raw.source_llm.value,
            })

    # confidence_score 내림차순 정렬
    manufacturers = sorted(
        canonical_map.values(),
        key=lambda m: (len(m.source_llms), m.confidence_score),
        reverse=True,
    )

    logger.info(
        "dedup_complete",
        total_raw=total_raw,
        total_deduplicated=len(manufacturers),
        merged_count=sum(1 for log in merge_log if log["action"] == "merged"),
    )

    return DeduplicationResult(
        manufacturers=list(manufacturers),
        total_raw=total_raw,
        total_deduplicated=len(manufacturers),
        merge_log=merge_log,
    )
