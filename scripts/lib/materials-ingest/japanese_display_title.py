"""Materials user-facing Japanese display title (generator-side SSOT)."""

from __future__ import annotations

import re

CJK_RE = re.compile(r"[\u3040-\u30ff\u4e00-\u9fff]")
ASCII_RE = re.compile(r"^[\x20-\x7e]+$")

TYPE_LABELS = {
    "sfx": "効果音",
    "bgm": "BGM",
    "image": "画像",
    "illustration": "イラスト",
    "background": "背景",
    "icon": "アイコン",
    "template": "テンプレート",
    "presentation": "プレゼンテーション",
    "web-material": "Web素材",
    "web": "Web素材",
    "code-material": "コード",
    "code": "コード",
}

PRESERVE_TERMS = {
    "html": "HTML",
    "css": "CSS",
    "js": "JavaScript",
    "javascript": "JavaScript",
    "ts": "TypeScript",
    "typescript": "TypeScript",
    "python": "Python",
    "py": "Python",
    "sql": "SQL",
    "react": "React",
    "web": "Web",
    "ui": "UI",
    "api": "API",
    "bgm": "BGM",
    "sfx": "SFX",
    "faq": "FAQ",
    "hero": "Hero",
    "saas": "SaaS",
    "csv": "CSV",
    "json": "JSON",
    "sns": "SNS",
    "youtube": "YouTube",
    "vlog": "Vlog",
    "ai": "AI",
}

SKIP_SLUG = {
    "free", "v1", "v2", "v3", "smoke", "live", "e2e", "test",
    "tpl", "pres", "illust", "output", "generic", "basic", "clean",
}

SKIP_TOPS = {
    "画像素材", "効果音・sfx", "効果音", "sfx", "bgm", "web素材",
    "コード", "テンプレート", "プレゼン", "アイコン", "イラスト", "素材",
}


def looks_japanese(text: str | None) -> bool:
    return bool(CJK_RE.search(str(text or "")))


def is_english_display_title(text: str | None) -> bool:
    s = str(text or "").strip()
    if not s:
        return True
    if looks_japanese(s):
        return False
    return bool(ASCII_RE.match(s))


def type_label(asset_type: str | None) -> str:
    return TYPE_LABELS.get(str(asset_type or "").lower(), "素材")


def _shorten_ja(text: str, max_len: int = 32) -> str:
    s = " ".join(str(text or "").split()).strip()
    s = re.sub(r"（[^）]*live e2e[^）]*）", "", s, flags=re.I)
    s = s.split("。")[0].split("．")[0].strip()
    s = re.split(r",\s*(?:no people|isolated|wide |clean |empty )", s, flags=re.I)[0].strip()
    if len(s) <= max_len:
        return s
    return s[:max_len].rstrip("、, ")


def _slug_tokens(slug: str | None) -> list[str]:
    raw = re.sub(r"-20\d{6}(?:-\d{3})?$", "", str(slug or "").lower())
    raw = re.sub(r"-q\d{2}(?:-20\d{6})?", "", raw)
    raw = re.sub(r"-\d{3}$", "", raw)
    out = []
    for t in re.split(r"[-_]+", raw):
        t = t.strip()
        if not t or t in SKIP_SLUG or re.fullmatch(r"\d{3,8}", t):
            continue
        if t.startswith("q") and t[1:].isdigit():
            continue
        out.append(t)
    return out


def resolve_japanese_display_title(
    *,
    title: str | None = None,
    prompt: str | None = None,
    description: str | None = None,
    category_path: list | None = None,
    category: str | None = None,
    subcategory: str | None = None,
    asset_type: str | None = None,
    slug: str | None = None,
    language_label: str | None = None,
) -> str:
    at = str(asset_type or "").lower()
    if at == "web":
        at = "web-material"
    if at == "code":
        at = "code-material"

    existing = str(title or "").strip()
    if existing and looks_japanese(existing) and not is_english_display_title(existing):
        return _shorten_ja(existing, 36)

    for src in (prompt, description):
        s = str(src or "").strip()
        if s and looks_japanese(s) and not re.match(
            r"^(image|illustration|icon|background|sfx|bgm|template|presentation|web-material|code-material)\s*/",
            s,
            flags=re.I,
        ):
            return _shorten_ja(s)

    parts: list[str] = []
    lang = str(language_label or "").strip()
    if lang:
        parts.append(PRESERVE_TERMS.get(lang.lower(), lang if looks_japanese(lang) else lang))

    segs = []
    for raw in [*(category_path or []), category, subcategory]:
        s = str(raw or "").strip()
        if not s or s.lower() in SKIP_TOPS or s in {"シンプル", "標準", "一般", "素材"}:
            continue
        if looks_japanese(s) or s in PRESERVE_TERMS.values():
            if s not in segs:
                segs.append(s)
    tokens = _slug_tokens(slug)
    for t in tokens:
        mapped = PRESERVE_TERMS.get(t)
        if mapped and mapped not in parts:
            parts.append(mapped)

    if segs:
        parts.extend(segs)
    elif tokens:
        # last-resort: keep preserved tokens only; type label fills the rest
        pass

    subject = "の".join([p for p in parts if p]).replace("のの", "の").strip("の")
    label = type_label(at)
    if not subject:
        return label
    if label in subject or (at == "sfx" and subject.endswith("音")):
        return subject
    if at == "sfx":
        if re.search(r"(通知|テロップ|ポップ|ウーシュ)", subject):
            return f"{subject}音"
        return f"{subject}効果音"
    if at == "bgm":
        return subject if subject.endswith("BGM") else f"{subject}BGM"
    if at == "background":
        return subject if subject.endswith("背景") else f"{subject}背景"
    if at in {"web-material", "web"}:
        return subject if re.search(r"(セクション|アコーディオン|ダッシュボード)", subject) else f"{subject}セクション"
    if at in {"code-material", "code"}:
        return subject if re.search(r"(スニペット|コード)", subject) else f"{subject}スニペット"
    if at == "template":
        return subject if "テンプレート" in subject else f"{subject}テンプレート"
    if at == "presentation":
        return subject if re.search(r"(スライド|資料|ピッチ)", subject) else f"{subject}スライド"
    if at == "icon":
        return subject if "アイコン" in subject else f"{subject}のアイコン"
    if at == "illustration":
        return subject if "イラスト" in subject else f"{subject}のイラスト"
    if at == "image":
        return subject if "画像" in subject else f"{subject}の画像"
    return f"{subject}{label}"
