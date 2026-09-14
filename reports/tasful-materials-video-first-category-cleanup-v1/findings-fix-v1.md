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

## 2. 写真 preview

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
