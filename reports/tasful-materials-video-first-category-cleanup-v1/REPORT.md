# TASFUL Materials Video-First Category Cleanup V1

**READY_FOR_PRODUCTION = NO**  
**HUMAN_VISUAL_GATE = STOP**  
**PRODUCTION_CHANGED = NO**  
**DATA_DELETED = NO**

## What this is

Category / UI / search **classification only**. Primary chips move from general-purpose toward video-production materials. Legacy categories stay internally valid and URL-compatible.

## Investigation

Hypothesis: *categories live in a JS constant driving chips + filter; presentation filters gated on `category===presentation`.*

| Check | Result |
| --- | --- |
| JS constant on `cf-pages-deploy` | **Missing** — Materials UI/SSOT was not in this GitHub checkout |
| Docs | `docs/TODO.md` still says Materials Phase 0 / Phase 1 forbidden |
| Staging DB | Telemetry tables exist (`materials_search_*`, `materials_download_*`) |
| Production DB | **No** materials tables |
| Catalog / asset table | **Not found** — do not invent assets |
| `image` → `photo` | **UNKNOWN** — Staging `image` is mixed (自然 / automation / river). **Not remapped** |
| Transparency metadata | **Not found** → attribute filter **DEFERRED** |
| `presentation` | Real Staging `category_id`; hide from primary; keep URL + presentation-only filters |

Observed Staging category slugs: `template`, `sfx`, `code`, `web`, `image`, `bgm`, `presentation`, `icon`, `background`, `document`, `illustration`.

## Implementation

SSOT now exists and drives chips + repository filter:

| File | Role |
| --- | --- |
| `materials/materials-categories.js` | Primary / legacy / finding labels vs internal ids |
| `materials/materials-repository.js` | Keyword + chip filter against injected catalog only |
| `materials/materials-ui.js` | Chip / filter / empty-state wiring + URL compat |
| `materials/index.html` | Classification browse surface (no fake assets) |
| `wrangler.toml` | `pages_build_output_dir = deploy/cloudflare/dist` |

### Primary chips (display order)

1 すべて 2 BGM 3 効果音/SFX 4 写真 5 イラスト 6 背景 7 アイコン 8 オーバーレイ 9 フレーム・装飾 10 テロップ素材 11 トランジション

### Hidden from primary (legacy / URL-compat)

テンプレート=`template` · Web素材=`web` · コード=`code` · 文例・文章テンプレート=`document` · ツール=`tool` · プレゼン=`presentation` · 画像素材=`image` (UNKNOWN, not 写真)

`?category=template` / `presentation` / `image` still filter. Presentation-only filters (スライドサイズ / テーマ) show **only** when category is `presentation`. カラー / 形式 stay for image-family categories.

### Explicit non-actions

- No Production writes / deploys / merges
- No physical DELETE of assets or telemetry
- No fake/demo catalog as truth
- No invented transparency metadata
- No 用途-tag schema
- No download / ads / billing / permission / storage / BGM·SFX pipeline changes
- No Materials chrome redesign beyond chip + filter + empty state

Empty new categories (写真 / オーバーレイ / フレーム・装飾 / テロップ素材 / トランジション, and others with no catalog rows) render a **real empty state** and **0 件**.

If a local catalog already exists, inject it as `window.TasuMaterialsCatalog` or `window.TasuMaterialsGetCatalog`. This PR does not fabricate one.

## Tests

```bash
node scripts/test-materials-video-first-categories.mjs
```

**PASS** (see `test-results.txt`).

## Human Visual Gate (required)

Browser automation is isolated. Visual QA is human-only.

With local `npm run dev` already serving dist (do **not** restart 8788 from this agent):

- http://127.0.0.1:8788/materials/
- http://127.0.0.1:8788/materials/?category=bgm
- http://127.0.0.1:8788/materials/?category=photo
- http://127.0.0.1:8788/materials/?category=overlay
- http://127.0.0.1:8788/materials/?category=presentation
- http://127.0.0.1:8788/materials/?category=template
- http://127.0.0.1:8788/materials/?category=image
- http://127.0.0.1:8788/materials/?q=impact

Confirm: primary chips only; legacy URLs still resolve; empty categories show 0; no fake counts; プレゼン filters only on presentation.

**STOP here. Do not merge.**
