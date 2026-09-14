# Human Visual Findings Fix V1

Branch: `cursor/materials-video-first-category-cleanup-6acc`  
PR: #30 (do not merge)  
Gate: Human Visual still STOP

## 1. すべて / ALL discovery

**Finding:** Normal `list.html` すべて showed the full public index, including legacy `template` / `web` / `code` / `document` / `tool` / `presentation`.

**Fix (no delete, no reclassify):**

- `TasuMaterialsData.filterPrimaryDiscoveryItems` keeps only  
  `bgm, sfx, image, illustration, background, icon, overlay, frame, telop, transition`
- `materials-list-page.js` `fetchListItems` applies that filter when `category` is empty (すべて), including すべて + search
- Direct legacy URLs (`?category=template`, `web`, `code`, `text`, `tool`, `presentation`) still fetch that category only
- Public index records unchanged (2151). Empty video-first ids stay true empty

BGM / SFX specialty mounts are unchanged (they do not use this すべて path).

## 2. 写真 preview (updated — CF verified root cause)

Verified on `https://4c79d360.tasufull-article.pages.dev`:

1. Index `preview_url` / `download_url` = `/materials/generated/downloads/image/*.png`
2. Those URLs return **HTTP 200 `content-type: text/html` (~72KB)** — Pages fallthrough to `dist/index.html` (platform TOP), **not image bytes**. Same for `/materials/generated/previews/image/*.png` on this slim deploy.
3. `materials-download-card.js` rendered `materials-card__thumb--photo-wall` + SVG icon only — it did **not** bind `preview_url` to `<img>`. Classic `materials-page.js` already had `resolveThumbSrc` + `<img class="card-image">`.

This slim branch has **no** `materials/generated/downloads/` binaries (~1.8GB, excluded) and **no** `materials/generated/previews/image/` thumbs. Existing served image-like files are only QA SVGs under `/materials/images/previews/` (not the 260 public slugs). Do not invent replacement art.

**Fix:**

- A) Download card (list / grid / ranking) now binds `preview_url` (and thumbnail fields) to `<img class="materials-card__thumb-img">`. CSS `thumbnail_style` + SVG icon stay as fallback when the URL is empty or the img errors.
- Image specialty list already binds `preview_url`; it prefers `/materials/images/previews/` and `/materials/generated/previews/` when those paths are present.
- B) `_redirects`: missing `/materials/generated/downloads/*` → `/404.html` **404**. **Do not** splat-404 `/materials/generated/previews/*` — HEAD now has 260 committed `previews/image/*.jpg` plus template SVGs. `404.html` is required as the downloads-404 destination (Pages failed on `5a25edf` when `_redirects` pointed at a missing `/404.html` and/or 404'd the new thumbs).
- `_headers`: `/materials/generated/downloads/image/*` and `/previews/image/*` send `Content-Type: image/png` + `nosniff` so a leftover HTML 200 cannot be sniffed as a photo.
- **CF must include preview/download PNG bytes in Pages output for Human Visual photo PASS.** This branch does not add fake thumbs. When those files exist on a fuller tree, cards show them.

## 2b. Earlier photo-wall note

**Investigation (data vs screenshot):**

| Check | Result |
|---|---|
| Public `image` count | 260 (unchanged) |
| `preview_url` | present on all 260 |
| `preview_url === download_url` | yes — `/materials/generated/downloads/image/{slug}.png` |
| Slim tree / this PR | `materials/generated/downloads/` **does not exist** (parent `5ca5bb7` is slim, no binaries) |
| GitHub default | same path is not a repo file |
| Existing served previews | only QA slugs under `/materials/images/previews/*.svg` (`PREVIEW_IMAGE_SAMPLES`) |
| CORS | same-origin path; not a CORS issue |
| CF HEAD from this agent | `pages.dev` is outside egress allowlist (SSL_ERROR_SYSCALL). Human Visual remains the CF / local check |

`resolveThumbSrc` already used `download_url` (same 404 PNG). Missing `preview_url` in the candidate list was a contract gap vs detail/page, but it was **not** the blank-card cause. Blank cards are broken `<img>` to binaries that this slim Pages deploy does not ship.

**Fix (restore existing binding only; no fake images; no storage/RLS/auth):**

- Include `preview_url` / `image_url` in image-list `resolveThumbSrc`
- Prefer existing `/materials/images/previews/` when that path is present (QA / sample slugs)
- Keep the index `preview_url` as `<img src>` so a fuller tree that has the PNGs still shows real photos
- Always paint the existing `thumbnail_style` layer (`photo-wall` for all 260 public image rows)
- `onerror` hides the broken img so CF/slim is not a blank/broken icon

No replacement PNGs, no invented `/previews/{slug}.svg`, no index rewrite.

**Human Visual:** On a checkout/deploy that has `generated/downloads/image/*.png`, cards should show those photos. On this slim CF preview, cards must not be blank; they show the existing `photo-wall` style until binaries exist in that tree.

## 3. Footer / category navigation

**Finding:** Footer `slice(0,6)` came from the old 12-id `fetchCategories()` list, so **Web素材** appeared in normal Materials footer.

**Fix:**

- `fetchCategories()` returns video-first primary minus empty overlay/frame/telop/transition  
  → `bgm, sfx, image, illustration, background, icon`
- Footer `primaryFooterCategories()` uses `LIST_SIDEBAR_CATEGORIES` with the same filter
- Labels stay the sidebar map (`image` → 写真)
- Legacy routes remain valid; they are just not primary nav entries

TOP header / category cards use the same `fetchCategories()` list (no Web素材 / template / code / document / tool / presentation).

## 4. Regression

- No material deleted; no mass reclassification
- Production unchanged; `wrangler.toml` kept (`pages_build_output_dir = deploy/cloudflare/dist`)
- Empty overlay / frame / telop / transition stay catalog-empty
- BGM / SFX specialty search / sort unchanged
