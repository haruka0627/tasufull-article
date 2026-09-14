# FINAL_RETURN — Legacy Route Navigation Consistency V1

| Field | Value |
|--------|--------|
| **HEAD** | `446066f` (fix `a58fb1d`; photo preview baseline `46cb8a7`) |
| **PREVIEW_URL** | `http://127.0.0.1:8788` (local wrangler pages dev; CF preview `https://410b34df.tasufull-article.pages.dev` was unreachable from agent network) |
| **Branch / PR** | `cursor/materials-video-first-category-cleanup-6acc` · PR #30 (draft) |

## Gate table

| Check | Result | Evidence |
|--------|--------|----------|
| **ROOT_CAUSE** | Documented | `reports/tasful-materials-legacy-route-nav-consistency-v1/ROOT_CAUSE.md` |
| **TOP_NAV_VIDEO_FIRST** | **PASS** | Presentation + default list: chips from `LIST_CATEGORY_CHIPS`; screenshots `list-presentation--desktop-1440.png`, `list-all--desktop-1440.png` |
| **RIGHT_SIDEBAR_VIDEO_FIRST** | **PASS** | `TasuMaterialsListSidebar.renderNav` on presentation; contract test `renderNav includes オーバーレイ` |
| **MOBILE_NAV_VIDEO_FIRST** | **PASS** | `list-presentation--mobile-390.png`, `list-all--mobile-390.png` (horizontal chip row, no legacy labels) |
| **LEGACY_PRIMARY_NAV_ABSENT** | **PASS** | No `テンプレート` / `Web素材` / `コード` / `文例・文章テンプレート` / `ツール` / `プレゼン` in primary chips or sidebar HTML (50/50 contract tests) |
| **LEGACY_DIRECT_URL_COMPATIBILITY** | **PASS** | `?category=presentation` loads presentation inventory (8 items); clean URL `/materials/list?category=presentation` HTTP 200 |
| **PHOTO_PREVIEW** | **PASS** | Unchanged on branch; prior gate + `scripts/test-tasful-materials-video-first-category-cleanup-v1.mjs` still 109/109 |
| **NEW_EMPTY_CATEGORIES_VISIBLE** | **PASS** | `list-overlay--desktop-1440.png`, `list-transition--desktop-1440.png` show honest empty catalog state |
| **DATA_DELETED** | **NO** | |
| **PR_MERGED** | **NO** | |

## REQUIRED RESULT fields

```
ROOT_CAUSE: Pre–Video-First LIST_CATEGORY_CHIPS / LIST_SIDEBAR_CATEGORIES (full CATEGORIES order) consumed by specialty presentation shell; classic list could remain visible until async mount. Fixed via SSOT on branch + sync hide classic for specialty query ids.
TOP_NAV_VIDEO_FIRST: PASS
RIGHT_SIDEBAR_VIDEO_FIRST: PASS
MOBILE_NAV_VIDEO_FIRST: PASS
LEGACY_PRIMARY_NAV_ABSENT: PASS
LEGACY_DIRECT_URL_COMPATIBILITY: PASS
PHOTO_PREVIEW: PASS
NEW_EMPTY_CATEGORIES_VISIBLE: PASS
DATA_DELETED: NO
PR_MERGED: NO
```

## VERDICT

**PASS — ready for Human Visual Gate re-check.**

Stop here for human review. Compare screenshots under:

`reports/tasful-materials-legacy-route-nav-consistency-v1/screenshots/`

Key paths:

- `list-presentation--desktop-1440.png`
- `list-presentation--mobile-390.png`
- `list-presentation-clean-url--desktop-1440.png`
- `list-image--desktop-1440.png`
- `list-overlay--desktop-1440.png`
- `list-transition--desktop-1440.png`

Automated contracts: `node scripts/test-tasful-materials-legacy-route-nav-consistency-v1.mjs` → **50/50 OK**.
