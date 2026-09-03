# TLV Go Live Canonical Route Migration V1

**ACTIVE_TASK:** TLV Go Live Canonical Route Migration  
**Date:** 2026-09-04  
**HEAD:** `66a08bf`  
**PRODUCTION_CHANGED:** NO  
**VERDICT:** PASS

Formal Go Live Studio (`/one-tlv-go-live`) is the canonical 配信作成 / 配信開始 page. Legacy `/live/create/` is not deleted; it is a redirect/stub only. LIVE pipeline, VRoid Hub spec, Beauty, and Japanese i18n were not changed in this task.

## Routes

| Kind | Path |
| --- | --- |
| CANONICAL | `/one-tlv-go-live` |
| LEGACY | `/live/create/` (also `/live/create` · `/live/create.html`) |

Pretty URL verified: `http://127.0.0.1:8788/one-tlv-go-live` HTTP 200 · `data-page="one-tlv-go-live"`.

## Entry points

### Found (user-facing TLV 配信を開始 / Go Live)

| Surface | Before | After |
| --- | --- | --- |
| TLV Home sidebar CTA `data-tlv-action="go-live"` | `/live/create/` via `one-tlv-route-bridge.js` | `/one-tlv-go-live` |
| TLV Home mobile FAB | same | `/one-tlv-go-live` |
| Cloned chrome `CHROME_ROUTES.create` | `/live/create/` | `/one-tlv-go-live` |
| Settings studio link | `/live/create/` | `/one-tlv-go-live` |
| Live / Shorts discovery 「配信を開始」 | `/live/create/` | `/one-tlv-go-live` |
| Game Live left nav 「配信を始める」 | `/live/create/` | `/one-tlv-go-live` |
| V0 `tlv-sidebar` / studio sidebar Go Live | Next `/create` → `/live/create` | `<a href="/one-tlv-go-live">` |
| `live-config.createBroadcastUrl()` | `/live/create/` | `/one-tlv-go-live` |

### Migrated

All of the source entry points above.

### Remaining (not new dual-studio; not user dual-dev)

- **Compiled Next chunks** under `deploy/cloudflare/dist/live/` still contain old `/live/create/` strings until the next `build-tlv-v0-react`. Clicks still land on Formal Studio because `dist/live/create/index.html` is the canonical stub.
- MUSIC creator-dashboard 「配信を開始」 (not TLV).
- Vanilla `live/tlv-videos-sidebar.js` / `studio.html` (videos surface, not Formal Studio).
- Capture script `scripts/capture-tlv-product-link-phase2-picker.mjs` still names `/live/create/` (QA capture, not a product CTA). It now follows the stub.

## Legacy redirect

- **HTML stub:** `live/go-live-canonical-redirect.html` copied to `dist/live/create/index.html` and `dist/live/create.html`.
- **Source page:** `tlv-v0-react/app/create/page.tsx` is redirect-only (`location.replace('/one-tlv-go-live'+search+hash)`). V0 studio components remain in-repo but are **not mounted**.
- **Edge rules** (`deploy/cloudflare/_redirects`): exact 302 for `/live/create`, `/live/create/`, `/live/create.html` → `/one-tlv-go-live`. **No splat** `/live/create/*`.
- Local 8788 served the **static stub (HTTP 200)** then client `location.replace` (static file wins over `_redirects`). Query `?talkDev=1` preserved.
- **Not redirected:** `/live/live-create.js` (HTTP 200 JS), `/live/create/_next/*`.

**Redirect loop:** 0 (canonical reload stays on `/one-tlv-go-live`; legacy hops once).

## Formal Studio capabilities (markup / source; pipeline not rewritten)

Present on `/one-tlv-go-live`: Normal Camera · Mic · Preview · Scene Editor script · User VRM file input · VRoid Hub panel · License Gate markup · START LIVE (`data-tlv-go-live-cta`) · LiveKit `startHost` + `compositedStream` · `stopHost` / `controlledStop` cleanup.

This task did **not** change `one-tlv-go-live-service.js`, LiveKit provider, VRoid Hub core, Beauty, or i18n dictionaries.

## QA

Command: `node scripts/test-tlv-go-live-canonical-route-migration-v1.mjs`  
**PASS** (52/52). Shots: `reports/ui-review/tlv-go-live-canonical-route-migration-v1/`.

| Check | Result |
| --- | --- |
| TLV Home → 配信を開始 | PASS → `/one-tlv-go-live` |
| Sidebar → 配信を開始 | PASS → `/one-tlv-go-live` |
| Mobile FAB 390 | PASS → `/one-tlv-go-live` |
| Direct `/one-tlv-go-live` | HTTP 200 |
| Legacy `/live/create/` | lands on canonical |
| Redirect loop | 0 |
| Broken JS/CSS 404 (excluding known Snap PoC local config) | 0 |
| Runtime page errors (excluding known Snap Camera Kit CORS/401/404) | 0 |
| Camera / Virtual Camera / User VRM / Scene / LiveKit / START-STOP | Source contract unchanged · DOM present · **no live publish in this QA** |
| VRoid Hub unit | `node scripts/test-tlv-vroid-hub-v1.mjs` **47/47 PASS** |
| Prior Real LIVE E2E | cited `reports/tlv-vroid-hub-real-live-publish-final-closeout.md` (not re-run) |

Independent Judge: `node scripts/judge-tlv-go-live-canonical-route-migration-v1.mjs` → **PASS**  
`reports/tlv-go-live-canonical-route-migration-v1.judge.json`

### Human visual (isolation)

Cursor IDE Browser was not used. Confirm in external Chrome:

- http://127.0.0.1:8788/one-tlv → 配信を開始
- http://127.0.0.1:8788/one-tlv-go-live
- http://127.0.0.1:8788/live/create/

### 8788

`node scripts/probe-pages-dev.mjs` → **ALIVE** (not restarted). Dist overlay via Copy-Item (not `build:pages`).

## Original Memo Lifecycle (AD-048)

Filename-only listing of `G:\マイドライブ\Obsidian\TASFUL\１０月までにやるもの` (vault files only · **ID　パス系 not opened**).

No memo filename matches this ACTIVE_TASK (“Go Live Canonical Route” / Formal Studio route cutover). Related TLV filenames exist (Production前 必須処理, Short/LIVE 戦略) but were **not** treated as this task’s requirement source.

- Original memo **not rewritten**
- Original memo **not deleted**
- Implementer max: no `COMPLETE_CANDIDATE` without an identified memo
- Independent Completion Audit / `DELETION_APPROVED`: **not applicable**

## Out of scope (not started)

Beauty spec · Japanese i18n · LIVE architecture · VRoid Hub spec · Production deploy · next ACTIVE_TASK.
