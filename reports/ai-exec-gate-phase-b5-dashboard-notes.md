# AI Execution Gate — Phase B5 dashboard notes

**Date:** 2026-07-28  
**HEAD base:** `49f81cd` (B4)  
**Status:** Final review hardened · selective commit when PASS

## Authoritative name

**Dashboard 読取表示**

| Source | Citation |
| --- | --- |
| PLAN | §15 Dashboard 表示（B5）— 実行状態 · 未対応件数 · sanitized 要約 · 汎用メッセージ · 冪等再利用 |
| TICKETS | B5 — get API のサニタイズ結果のみ表示 · 承認/送信なし |
| FREEZE | §13 Dashboard 契約（Phase B は最小読取）· §6.3 例は actor 例であり page-load execute 指示ではない |

## Dashboard load flow（確定）

```text
ops session
  → POST /api/ai-exec-gate/create  (idempotent day resolve)
  → GET  /api/ai-exec-gate/:id
  → textContent render
```

**Page-load auto-execute: NO** — PLAN §15 / TICKETS B5 に明示なし。初版実装の auto-execute は final review で除去。

再読込: 既知 `execution_id` がある場合は **GET のみ**（execute しない · failed 再実行なし）。

## Daily idempotency

```text
phase-b-daily-ops-report-{JST-YYYY-MM-DD}-{userIdSanitized}
```

- length 8–200 · JST day · per-actor · fixed create body defaults (action/service/caps/ports server-side)
- reload / multi-click: single-flight · same key → same execution

## GET sanitization

Returned `result`: `summary` · `pending_total` · `provider_called` · `recorded_api_cost` · `output_type` · `completed_at` · `error_code`  
Omitted: raw metrics bag · payload_hash · idempotency_key · secrets · hard cap · stacks · env snapshots  
Events: allowlisted fields only · max 40

## Frontend security

- Session via `TasuSupabaseClient.getSession` only · Bearer header · never DOM/URL/console/report
- DOM: `textContent` / `createElement` · no `innerHTML` of server strings
- XSS fixtures render as text
- No `/execute` · no provider domains · no DeepSeek

## UI states

`loading` · `queued` · `running` · `succeeded` · `blocked` · `failed` · `unauthorized` · `unavailable` · `idle`

## Tests / E2E

```bash
node scripts/test-ai-exec-gate-phase-b1-constants.mjs
… through b5 …
```

HTTP (`http://127.0.0.1:8788`):

| Asset | Status |
| --- | --- |
| `/admin-operations-dashboard.html` | 200 |
| `/admin-ai-exec-gate-client.js` | 200 |
| `/admin-operations-dashboard.css` | 200 |
| create no-auth | 401 |
| execute OPTIONS | 204 |

Playwright unauthenticated (1280×768 · 390×844):

- Panel visible · no horizontal overflow · auth generic message
- **No** `/api/ai-exec-gate/execute` from B5 client
- Console: pre-existing secretary `gemini-chat` CORS noise on dashboard (unrelated to Gate panel); Gate panel itself shows no token/secret
- Ops authenticated full path: **not minted** — limited; mock + local DB cover create/get

Viewport matrix with ops login deferred to B6 if needed.
## B4 / B6

- B4 residual orphan: unchanged
- B6: suite / Staging evidence deferred

## Known risks (non-blocking)

- Without prior B4 execute, panel shows queued（未実行）— by design
- Viewport matrix with ops login deferred if no safe token
