# TASFUL Materials — Video-First Category Shell Expansion V1 — Architecture Audit

**Branch:** `cursor/materials-video-first-category-cleanup-6acc` (baseline ~`9b81e34`)  
**Date:** 2026-09-14  
**Canonical visual / UX baseline:** `/materials/list.html?category=image` (`materials-image-list.js` Option 4 / `mat-img-*` layout)

## 1. List router (`/materials/list`)

| Piece | Path | Role |
|-------|------|------|
| HTML shell | `materials/list.html` | Single list page: classic mount `[data-materials-list-classic]`, per-category specialty mounts (`[data-materials-list-{id}]`), script chain ending in `materials-list-page.js`. |
| Router / orchestrator | `materials/materials-list-page.js` | Reads `?category=` via `readListParams()` + `TasuMaterialsData.LIST_VALID_QUERY_IDS`. Dispatches to specialty `*.mount()` for Option 4 categories **or** classic grid for `すべて` / `tool` / **empty VF ids** (`VIDEO_FIRST_EMPTY_CATEGORY_IDS`). |
| URL SSOT (chips / valid ids) | `materials/materials-data.js` | `LIST_CATEGORY_CHIPS`, `LIST_PRIMARY_CATEGORY_IDS`, `LIST_VALID_QUERY_IDS`, `VIDEO_FIRST_EMPTY_CATEGORY_IDS`, `LIST_UI_LABELS`, inventory via `countPublishedInventoryByCategory()`. |
| Chip wiring | `materials-list-page.js` | `renderClassicChips`, `wireCategoryChips`, `setCategoryInUrl` (per-category query-key cleanup). |

**Shareable:** param normalization, chip SSOT, pagination size, search metrics hook, mixed-grid `resolveCategoryRenderer` for classic “すべて”.  
**Image-only today:** full Option 4 layout only on `category=image` (and divergent STC shells on other specialties).

## 2. Image specialty renderer (canonical shell)

| Piece | Path | Role |
|-------|------|------|
| List UI | `materials/materials-image-list.js` | `renderShell()` — TOP back, H1/lead, search/sort, VF chips, filters, grid, pager, promo, right sidebar (active filters, `TasuMaterialsListSidebar`, popular tags, favorites). |
| Styles | `materials/materials-image-list.css` | `mat-img-*` layout (used as VF shell skin). |
| Cards | `materials-image-list.js` | `renderCard` / `wireCard` — image preview, download/favorite contract. |
| Filters | `materials-image-list.js` + `materials-genre-filter-ssot.js` | Genre / use_case / people / orientation / color / style / format from **index fields only**. |
| Sidebar nav | `materials/materials-list-sidebar.js` | `LIST_SIDEBAR_CATEGORIES` + honest inventory counts. |
| TOP back | `materials/materials-list-top-back.js` | Shared back link snippet. |

**Shareable (target COMMON_CATEGORY_SHELL):** shell DOM structure, chips, sidebar blocks, pagination, empty copy pattern, search/sort URL contract.  
**Image-specific:** thumb resolver, orientation helpers, image genre payload keys, promo copy.

## 3. Other specialty renderers (pre-unification)

Each legacy Option 4 module owns its own shell + URL state + filters (not `mat-img-*` baseline):

| Query `category` | Module | Mount node | Notes |
|------------------|--------|------------|-------|
| `sfx` | `materials-sfx-list.js` | `[data-materials-list-sfx]` | Audio preview, tailwind-ish shell |
| `bgm` | `materials-bgm-list.js` | `[data-materials-list-bgm]` | Shared audio element |
| `illustration` | `materials-illustration-list.js` | `[data-materials-list-illustration]` | `mat-ill-*` cards |
| `background` | `materials-background-list.js` | `[data-materials-list-background]` | STC retransplant |
| `icon` | `materials-icon-list.js` | `[data-materials-list-icon]` | SVG/icon preview |
| `web` | `materials-web-list.js` | legacy | Out of VF primary scope |
| `code` | `materials-code-list.js` | legacy | |
| `text` | `materials-document-list.js` | legacy | `document` id in data |
| `presentation` | `materials-presentation-list.js` | legacy | |
| `template` | `materials-template-list.js` | legacy | |

**VF primary with no specialty module today:** `overlay`, `frame`, `telop`, `transition` → routed to **classic** mount via `isClassicListCategory()` + `VIDEO_FIRST_EMPTY_CATEGORY_IDS` (incomplete shell vs 写真 baseline).

## 4. Cross-cutting contracts (shareable)

| Concern | Source |
|---------|--------|
| Index / repository | `materials/generated/materials-index.generated.js` + `materials-data.js` `repository` |
| Download + favorite | `materials-download.js`, `materials-favorites.js`, `materials-download-card.js` |
| Detail navigation | `materials-card-detail-nav.js`, `detail.html?slug=` |
| Detail page | `materials/materials-detail.js` (single route; category-specific preview inside) |
| Genre / demand filters | `materials-genre-filter-ssot.js` |
| Footer categories | `materials-site-footer.js` (hides zero-inventory VF empty ids from footer links only) |
| Mobile layout hooks | `materials-list-mobile-layout.css` (`mat-list-m-chips`, `mat-list-m-filters`) |

## 5. Classification: shareable vs category-specific

| Layer | Shareable | Per-category config |
|-------|-----------|---------------------|
| Router + chips | Yes (`LIST_CATEGORY_CHIPS`) | Active chip id |
| Shell chrome (back, H1, desc, search, sort, chips, count, pager, sidebar scaffold) | Yes → **COMMON_CATEGORY_SHELL** | `title`, `lead`, `promo` |
| Filters | Engine shareable | Which fields exist in index (`filterProfile`) |
| Cards | Renderer registry | `cardVariant`: image / svg_icon / audio / motion |
| Empty state | Yes | Catalog vs filter; honest zero inventory |
| Pagination | Yes | — |

**Do not duplicate:** taxonomy SSOT (`materials-data.js` chips/primary ids). **Do not add:** DB/schema/index generator changes.

## 6. V1 implementation direction (this PR)

1. Add `materials-vf-category-config.js` — `CATEGORY_CONFIG` keyed by VF primary slug (`LIST_PRIMARY_CATEGORY_IDS`).
2. Add `materials-vf-category-list.js` — single mount `[data-materials-list-vf]`, photo shell (`mat-img-*`), config-driven copy/filters, delegates `renderCard`/`wireCard` to existing `TasuMaterials*List` exports.
3. Add `materials-vf-category-filters.js` — `filterProfile` apply/collect/render using existing metadata + genre SSOT only.
4. Update `materials-list-page.js` — route all `LIST_PRIMARY_CATEGORY_IDS` through VF shell; legacy categories unchanged.
5. Empty VF categories (`overlay`, `frame`, `telop`, `transition`) — full shell + catalog empty (no legacy filler cards).

## 7. Risk / regression notes

- Audio lists must call `stopAudio` when leaving `bgm`/`sfx`.
- Specialty `hide()` paths must not resurrect classic mount when VF is active.
- `setCategoryInUrl` must preserve legitimate filter keys per VF profile when switching chips.
- Legacy direct URLs (`?category=template`, etc.) must keep working.
