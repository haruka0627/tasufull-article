# ROOT_CAUSE — Legacy Route Navigation Consistency (presentation / legacy URLs)

## Symptom (Human Visual Gate)

On `/materials/list?category=presentation`, primary discovery UI showed **legacy** category chips / sidebar labels:

`テンプレート` / `Web素材` / `コード` / `文例・文章テンプレート` / `ツール` / `プレゼン`

instead of the Video-First canonical set.

## Renderer for `category=presentation`

| Layer | Module | Role |
|--------|--------|------|
| Router | `materials/materials-list-page.js` | `refreshListPage()` → `params.category === "presentation"` → `TasuMaterialsPresentationList.mount()` |
| Specialty UI | `materials/materials-presentation-list.js` | Option 4 shell; hides `[data-materials-list-classic]` |
| Classic fallback | `[data-materials-list-classic]` in `materials/list.html` | Used for すべて / tool / empty VF categories only |

## Sources of primary navigation (chips + right sidebar)

| Surface | SSOT | Consumer |
|---------|------|----------|
| Top category chips | `TasuMaterialsData.LIST_CATEGORY_CHIPS` in `materials/materials-data.js` | Classic list (`renderClassicChips`), all specialty `*-list.js` shells including presentation |
| Right sidebar category list | `TasuMaterialsData.LIST_SIDEBAR_CATEGORIES` (derived from `LIST_PRIMARY_CATEGORY_IDS`) | `materials/materials-list-sidebar.js` → `renderNav()`; presentation aside 「カテゴリ」 |
| Footer category links | `primaryFooterCategories()` in `materials/materials-site-footer.js` | `LIST_SIDEBAR_CATEGORIES` (non-empty VF ids only) |
| Mobile category UI (TOP / mypage) | `repository.fetchCategories()` | Video-first subset in `materials-data.js` |

## Root cause (code)

1. **Pre–Video-First SSOT** (`materials-data.js` before `a94c358`): `LIST_CATEGORY_CHIPS` and `LIST_SIDEBAR_CATEGORIES` were built from the full legacy `CATEGORIES` order (template → … → presentation). Specialty lists—including **presentation**—read chips directly from `LIST_CATEGORY_CHIPS` and had **no separate override**, so legacy primary nav appeared on every specialty surface, including `?category=presentation`.

2. **Classic + specialty double mount (contributing)**: `materials-list-page.js` could leave `[data-materials-list-classic]` visible until async specialty `mount()` finished, briefly showing the classic header/chips alongside specialty UI on slow loads.

3. **Not the cause**: Presentation does **not** use a private hardcoded primary category array for chips; it always mapped from `LIST_CATEGORY_CHIPS`. The failure was SSOT data + possible classic shell visibility, not presentation-only chip HTML.

## Fix direction (this PR branch)

- Video-First `LIST_CATEGORY_CHIPS` / `LIST_SIDEBAR_CATEGORIES` / `LIST_PRIMARY_CATEGORY_IDS` in `materials-data.js` (already on branch `cursor/materials-video-first-category-cleanup-6acc`).
- Hide classic list mount synchronously when entering any specialty query id (including `presentation`) in `materials-list-page.js`.
- Label normalization for primary-adjacent filters: `写真` / `背景` via `LIST_UI_LABELS` and chip helpers in image/background list shells.
- Legacy **content** remains on direct `?category=presentation` (and other legacy ids); only **primary discovery** navigation is Video-First.
