# FINDINGS_FIX_FINAL_RETURN — TASFUL Materials Video-First PHOTO_PREVIEW Fix V2

**Mode:** Hosted CF preview Browser QA. No merge. No Production / Staging writes.  
**Run (JST):** 2026-09-15 00:00–00:05 JST  
**HEAD:** `46cb8a787fac848a34faea63ecd78aaee083ad09`  
**Branch:** `cursor/materials-video-first-category-cleanup-6acc`  
**PR:** https://github.com/haruka0627/tasufull-article/pull/30 (draft — **DO NOT MERGE**)

## VERDICT

**PASS_WITH_FINDINGS**

写真 card thumbs show **real visible photograph pixels** on CF preview (not pink-only CSS wall). Other gates (legacy hidden from すべて, SFX items, empty overlay/transition chips present) remain OK on sampled viewports.

Human Visual Gate: **STOP for human confirmation**. Do not merge. Do not Production.

## PREVIEW_URL

`https://410b34df.tasufull-article.pages.dev`

- CF Pages deploy for HEAD `46cb8a7` — **success**
- Branch alias: `https://cursor-materials-video-first-n95j.tasufull-article.pages.dev`
- Prior FAIL preview (do not use): `https://b21e0b18.tasufull-article.pages.dev`

## HEAD / COMMITS

- `2230118` ship 200 real preview JPGs + stage `_redirects` required + client prefer-previews
- `5a25edf` cover remaining 60 SNS preview JPGs (260 total) + `materials-image-list.js` prefer-previews
- `46cb8a7` add `404.html`; downloads-only splat-404 (do not splat-404 committed `previews/*`)

## PHOTO_PREVIEW

**PASS**

### Magic-byte proof

| URL | HTTP | Content-Type | Size | Magic |
|-----|------|--------------|------|-------|
| `/materials/generated/previews/image/sns-biz-q09-20260816-001.jpg` | 200 | image/jpeg | 8649 | `FF D8 FF` JPEG |
| `/` homepage | 200 | text/html | 72267 | `<!DOCTYPE` |
| `/materials/generated/downloads/image/nope.png` (missing) | **404** | text/html | 470 | 404.html (honest) |

Index `preview_url` sample: `/materials/generated/previews/image/sns-biz-q09-20260816-001.jpg`

### Browser QA (viewports 1440 / 768 / 412 / 390)

- すべて: legacy chips still hidden (PASS regression)
- SFX: items render (PASS regression)
- 写真 p1 + p2: real photo thumbs visible
  - 1440: **12/12** `img.mat-img-card__img` naturalWidth=320, src under `/materials/generated/previews/image/*.jpg`
  - 768: 10–12/12 after load (lazy)
  - 412/390 after scroll: **12/12** real previews (`photo-p1-*-scrolled.png`)

Screenshots: `reports/tasful-materials-video-first-category-cleanup-v1/screenshots/findings-fix-v2/`

- `photo-p1-1440.png`, `photo-p2-1440.png`
- `photo-p1-768.png`, `photo-p2-768.png`
- `photo-p1-412-scrolled.png`, `photo-p1-390-scrolled.png`
- plus `all-*`, `sfx-*`

### What shipped (bytes)

- **260** real preview JPGs under `materials/generated/previews/image/` (~**3.88 MB** total)
- Resized from local real downloads (max edge 320, JPEG q≈70). **No fake/gradient placeholders.**
- Full 1.8GB `downloads/` tree **not** committed (still gitignored)

## `_redirects` in dist

**YES** (copied by `copyCfMeta`; `_redirects` is required in stage)

Current rule (after `46cb8a7`):

- `/materials/generated/downloads/* → /404.html 404` (prevents SPA HTML-200 for missing downloads)
- **No** splat-404 on `/materials/generated/previews/*` (would break committed thumbs / missing 404.html target previously)

## Other gates (regression sample)

| Gate | Result |
|------|--------|
| LEGACY_HIDDEN_FROM_ALL | PASS (chips unchanged) |
| SFX items | PASS |
| empty overlay / transition chips present | OK (chips list includes オーバーレイ / トランジション) |
| PHOTO_PREVIEW | **PASS** |

## FINDINGS (non-blocking)

1. Mobile fullPage screenshots without scroll can under-count lazy `<img loading=lazy>` (pink CSS shows until scrolled). After scroll: 12/12 real.
2. Forced `Content-Type: image/png` removed from `_headers` for generated image paths (was lying over SPA HTML).
3. Specialty list path is `materials-image-list.js` (`mat-img-card__img`), not only `materials-download-card.js`.

## STOP

**STOP for Human Visual Gate.** PR #30 remains draft. **Do not merge. Do not Production.**
