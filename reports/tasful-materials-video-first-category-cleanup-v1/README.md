# TASFUL Materials Video-First Category Cleanup V1

Branch: `cursor/materials-video-first-category-cleanup-6acc`  
Base: `cursor/materials-video-first-category` (`5ca5bb7`)  
Canonical route: `/materials/list.html`

## Scope

Minimal **chip / filter / URL** wiring only.

- No Production cutover
- No asset DELETE
- No pipeline / download / billing / auth / RLS changes
- No bulk reclassify of mixed `image` inventory
- No invented overlay / frame / telop / transition stock

## Discovery (this branch)

Public index (`materials/generated/materials-index.json`): **2151** items.

| category_id | count |
|---|---|
| illustration | 1082 |
| icon | 633 |
| image | 260 |
| background | 66 |
| sfx | 42 |
| template | 33 |
| web | 12 |
| code | 12 |
| presentation | 8 |
| document | 3 |

Missing from public index: `bgm`, `tool`, `overlay`, `frame`, `telop`, `transition`.

Transparency fields (`meta_transparent` / `image_transparent` / `transparent` / `has_alpha`): **0 hits**.  
→ **透過 filter = DEFERRED**. Do not add an attribute filter without metadata.

`image` titles are mixed (example: `自動化の画像`, genre `technology`).  
→ Display label **写真** is a label map only. `CATEGORIES.name` stays `画像素材`. `category_id` stays `image`.

## SSOT

| Surface | File | Change |
|---|---|---|
| Catalog ids | `materials/materials-data.js` `CATEGORIES` | Keep old 12. Append empty video-first ids: overlay, frame, telop, transition |
| Primary chips | `LIST_CATEGORY_CHIPS` | すべて, BGM, 効果音/SFX, 写真, イラスト, 背景, アイコン, オーバーレイ, フレーム・装飾, テロップ素材, トランジション |
| Legacy keep | `LIST_LEGACY_QUERY_IDS` | template, web, code, text, tool, presentation — hidden from chips, URL still valid |
| List page | `materials/materials-list-page.js` `VALID` via `LIST_VALID_QUERY_IDS` | New + legacy query ids |
| Static chips | `materials/list.html` | Same primary order |
| Sidebar | `LIST_SIDEBAR_CATEGORIES` | Primary only (legacy hidden) |
| Genre contract | `scripts/lib/materials-list-genre-filter-contract.mjs` | presentation layout: ジャンル / デザイン / カラー / 形式 |
| Presentation UI | `materials/materials-presentation-list.js` | Removed スライド種類 / 業種. Kept カラー / 形式 |

`wrangler.toml` is **absent** on this tree. `pages_build_output_dir` was not created or removed.

## Empty categories

`overlay` / `frame` / `telop` / `transition` use the classic list mount (no specialty renderer, no fake cards).

Catalog-empty copy:

- title: `{label}の公開素材はまだありません。`
- text: `在庫は0件です。仮の素材は表示しません。`
- `data-materials-empty="catalog"`

Filter-empty copy stays `該当する素材がありません。`

Search / sort on those URLs keeps `?category=` (classic mount).

## 透過

Deferred. Public index has no transparency metadata. Classic filters remain 用途 / 形式 / スタイル / カラー.

## Human Visual Gate (do not merge)

Visual QA is human-only. Open local Chrome (do not use in-agent Browser Automation):

1. http://127.0.0.1:8788/materials/list.html — primary chips only; no template/web/code/text/tool/presentation
2. http://127.0.0.1:8788/materials/list.html?category=image — chip label 写真; inventory is existing image stock (not reclassified)
3. http://127.0.0.1:8788/materials/list.html?category=overlay — real empty state, no fake cards
4. http://127.0.0.1:8788/materials/list.html?category=frame
5. http://127.0.0.1:8788/materials/list.html?category=telop
6. http://127.0.0.1:8788/materials/list.html?category=transition
7. http://127.0.0.1:8788/materials/list.html?category=template — legacy URL still mounts specialty list
8. http://127.0.0.1:8788/materials/list.html?category=presentation — no スライド種類 / 業種; カラー / 形式 remain

**STOP** after this PR. Do not merge until Human Visual Gate passes.

## Test

```bash
node scripts/test-tasful-materials-video-first-category-cleanup-v1.mjs
```

Results: `reports/tasful-materials-video-first-category-cleanup-v1/test-results.json`
