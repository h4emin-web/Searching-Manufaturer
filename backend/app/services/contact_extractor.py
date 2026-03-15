"""
웹사이트 연락처 자동 크롤링 서비스 - ②번 핵심 포인트
- Playwright로 제조소 웹사이트 크롤링
- WeChat (weixin://, wx icon), WhatsApp (wa.me), Email 패턴 분류
- Web Form URL 추출 (contact/inquiry 페이지)
"""
import re
import asyncio
from urllib.parse import urljoin, urlparse
from typing import TypedDict

import structlog
from bs4 import BeautifulSoup

try:
    from playwright.async_api import async_playwright, Page, Browser
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False

logger = structlog.get_logger()


# ─── 연락처 패턴 정의 ─────────────────────────────────────────
class ContactPatterns:
    # WeChat: weixin:// 프로토콜 또는 wx 아이콘 alt 텍스트
    WECHAT_URL = re.compile(r"weixin://dl/|weixin://ol/profile\?username=", re.I)
    WECHAT_ID = re.compile(
        r"(?:wechat|weixin|微信)\s*[:#：]?\s*([a-zA-Z0-9_\-]{5,30})",
        re.I,
    )
    WECHAT_ICON_ALT = re.compile(r"wechat|weixin|wx", re.I)

    # WhatsApp: wa.me URL 또는 +국가코드 포함 번호
    WHATSAPP_URL = re.compile(r"(?:https?://)?(?:api\.)?whatsapp\.com/send|wa\.me/(\d+)", re.I)
    WHATSAPP_ICON_ALT = re.compile(r"whatsapp|whats\s*app", re.I)

    # Email
    EMAIL = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", re.I)
    EMAIL_HREF = re.compile(r"^mailto:(.+)", re.I)

    # 전화번호 (국제 포맷)
    PHONE = re.compile(r"\+\d{1,3}[\s\-]?\(?\d{1,4}\)?[\s\-]?\d{3,4}[\s\-]?\d{4}", re.I)

    # 문의 페이지 경로 패턴
    CONTACT_PAGE = re.compile(
        r"(?:^|/)(?:contact|inquiry|enquiry|get-in-touch|reach-us|"
        r"联系我们|联系|お問い合わせ|문의)(?:/|$)",
        re.I,
    )


class ExtractedContacts(TypedDict):
    email: str | None
    wechat: str | None
    whatsapp: str | None
    phone: str | None
    web_form_url: str | None
    raw_data: dict  # 디버깅용 원본 데이터


# ─── 단일 페이지 파싱 ─────────────────────────────────────────
def _parse_contacts_from_html(html: str, base_url: str) -> dict:
    """BeautifulSoup으로 HTML에서 연락처 패턴 추출"""
    soup = BeautifulSoup(html, "lxml")
    found = {
        "emails": [],
        "wechat_ids": [],
        "wechat_urls": [],
        "whatsapp_numbers": [],
        "phones": [],
        "contact_page_urls": [],
    }

    # ── <a href="..."> 분석 ────────────────────────────────
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()

        # mailto:
        email_match = ContactPatterns.EMAIL_HREF.match(href)
        if email_match:
            found["emails"].append(email_match.group(1).split("?")[0])
            continue

        # weixin://
        if ContactPatterns.WECHAT_URL.search(href):
            found["wechat_urls"].append(href)
            continue

        # wa.me
        wa_match = ContactPatterns.WHATSAPP_URL.search(href)
        if wa_match:
            number = wa_match.group(1) or ""
            found["whatsapp_numbers"].append(f"+{number}" if number else href)
            continue

        # 연락처 페이지 링크
        if ContactPatterns.CONTACT_PAGE.search(href):
            full_url = urljoin(base_url, href)
            if full_url not in found["contact_page_urls"]:
                found["contact_page_urls"].append(full_url)

    # ── 이미지/아이콘 alt 텍스트로 WeChat/WhatsApp 감지 ──────
    for img in soup.find_all(["img", "i", "span"], attrs={"alt": True}):
        alt = img.get("alt", "")
        parent_href = ""
        parent = img.find_parent("a")
        if parent:
            parent_href = parent.get("href", "")

        if ContactPatterns.WECHAT_ICON_ALT.search(alt):
            # 부모 <a>에서 WeChat ID 추출 시도
            wechat_in_href = ContactPatterns.WECHAT_ID.search(parent_href)
            if wechat_in_href:
                found["wechat_ids"].append(wechat_in_href.group(1))

        if ContactPatterns.WHATSAPP_ICON_ALT.search(alt):
            wa_match = ContactPatterns.WHATSAPP_URL.search(parent_href)
            if wa_match:
                number = wa_match.group(1) or ""
                found["whatsapp_numbers"].append(f"+{number}" if number else parent_href)

    # ── 텍스트 전체에서 패턴 추출 ──────────────────────────────
    full_text = soup.get_text(" ", strip=True)

    # 이메일
    for email in ContactPatterns.EMAIL.findall(full_text):
        if email not in found["emails"] and not email.endswith((".png", ".jpg", ".gif")):
            found["emails"].append(email)

    # WeChat ID (텍스트 내)
    for wechat in ContactPatterns.WECHAT_ID.findall(full_text):
        if wechat not in found["wechat_ids"]:
            found["wechat_ids"].append(wechat)

    # 전화번호
    for phone in ContactPatterns.PHONE.findall(full_text):
        if phone not in found["phones"]:
            found["phones"].append(phone)

    return found


# ─── Playwright 크롤러 ────────────────────────────────────────
async def crawl_manufacturer_contacts(
    website_url: str,
    timeout_ms: int = 15000,
) -> ExtractedContacts:
    """
    제조소 웹사이트에서 연락처 자동 추출
    1. 메인 페이지 크롤링
    2. 연락처 페이지 감지 시 추가 크롤링
    """
    if not website_url or not website_url.startswith("http"):
        return _empty_contacts()

    if not PLAYWRIGHT_AVAILABLE:
        logger.warning("playwright_not_available", url=website_url)
        return _empty_contacts()

    try:
        async with async_playwright() as p:
            browser: Browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                ignore_https_errors=True,
            )
            page: Page = await context.new_page()
            page.set_default_timeout(timeout_ms)

            all_found: dict = {
                "emails": [], "wechat_ids": [], "wechat_urls": [],
                "whatsapp_numbers": [], "phones": [], "contact_page_urls": [],
            }

            # 1단계: 메인 페이지
            await page.goto(website_url, wait_until="domcontentloaded")
            html = await page.content()
            main_found = _parse_contacts_from_html(html, website_url)
            _merge_found(all_found, main_found)

            # 2단계: 연락처 페이지 탐색 (최대 2개)
            contact_pages = main_found["contact_page_urls"][:2]
            for contact_url in contact_pages:
                try:
                    await page.goto(contact_url, wait_until="domcontentloaded")
                    contact_html = await page.content()
                    contact_found = _parse_contacts_from_html(contact_html, contact_url)
                    _merge_found(all_found, contact_found)
                except Exception as e:
                    logger.warning("contact_page_crawl_failed", url=contact_url, error=str(e))

            await browser.close()

            return _build_extracted_contacts(all_found, website_url)

    except Exception as exc:
        logger.error("crawl_failed", url=website_url, error=str(exc))
        return _empty_contacts()


def _merge_found(base: dict, new: dict) -> None:
    """두 found dict 병합 (중복 제거)"""
    for key in base:
        for val in new.get(key, []):
            if val not in base[key]:
                base[key].append(val)


def _build_extracted_contacts(found: dict, base_url: str) -> ExtractedContacts:
    """추출된 원시 데이터에서 우선순위 높은 연락처 선택"""
    # WeChat: URL > ID 순
    wechat = None
    if found["wechat_urls"]:
        wechat = found["wechat_urls"][0]
    elif found["wechat_ids"]:
        wechat = found["wechat_ids"][0]

    # WhatsApp: +국가코드 형식 우선
    whatsapp = None
    for num in found["whatsapp_numbers"]:
        if num.startswith("+"):
            whatsapp = num
            break
    if not whatsapp and found["whatsapp_numbers"]:
        whatsapp = found["whatsapp_numbers"][0]

    # 이메일: 영업/inquiry 이메일 우선
    email = None
    priority_prefixes = ("sales", "inquiry", "info", "export", "bd", "business")
    for e in found["emails"]:
        local_part = e.split("@")[0].lower()
        if any(local_part.startswith(p) for p in priority_prefixes):
            email = e
            break
    if not email and found["emails"]:
        email = found["emails"][0]

    # Web Form: contact 페이지 URL
    web_form_url = found["contact_page_urls"][0] if found["contact_page_urls"] else base_url

    return ExtractedContacts(
        email=email,
        wechat=wechat,
        whatsapp=whatsapp,
        phone=found["phones"][0] if found["phones"] else None,
        web_form_url=web_form_url,
        raw_data=found,
    )


def _empty_contacts() -> ExtractedContacts:
    return ExtractedContacts(
        email=None, wechat=None, whatsapp=None,
        phone=None, web_form_url=None, raw_data={},
    )


# ─── 배치 크롤링 (여러 제조소 동시) ──────────────────────────
async def batch_crawl_contacts(
    manufacturers: list,  # list[Manufacturer]
    max_concurrent: int = 5,
) -> dict[str, ExtractedContacts]:
    """
    여러 제조소를 동시에 크롤링 (semaphore로 동시성 제한)
    Returns: {manufacturer_id: ExtractedContacts}
    """
    semaphore = asyncio.Semaphore(max_concurrent)

    async def _crawl_with_limit(mfr) -> tuple[str, ExtractedContacts]:
        async with semaphore:
            contacts = await crawl_manufacturer_contacts(mfr.website or "")
            return mfr.id, contacts

    tasks = [_crawl_with_limit(m) for m in manufacturers if m.website]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    return {
        mfr_id: contacts
        for mfr_id, contacts in results
        if isinstance(contacts, dict)
    }
