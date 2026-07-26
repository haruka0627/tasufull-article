# Platform AI Page Generation — Phase 2-E Release Verification

**Date:** 2026-07-26  
**Verdict:** `RELEASE READY WITH FOLLOW-UP`  
**Git HEAD (verification):** `57952cd`  
**Baseline (Phase 2-D0 foundation):** `9d679e6`  
**Scope:** Platform product / skill / job / worker only  
**Out of scope:** Builder · Business Directory · booking · join · Production Deploy · Push

---

## Summary

| Gate | Result |
| --- | --- |
| Phase 1 engine | **252/252 PASS** (FAQ nested-lock tests added after Phase 2-D P1 fix; was 248) |
| Phase 2-A Platform integration | **63/63 PASS** (Gemini model assert added; was 61) |
| Phase 2-D Staging E2E (re-run in 2-E) | **VERDICT PASS · exit 0** |
| Production build config | **PASS** (`ddojquacsyqesrjhcvmn` in dist chat config) |
| Staging contamination in page-gen runtime | **PASS** (no Staging ID in page-gen HTML/JS/API paths) |
| Secrets in page-gen artifacts | **PASS** (no committed keys; fixture password only in gitignored `_tmp`) |
| P0 / P1 open | **None** |

```text
Platform AI Page Generation

Phase 1: PASS
Phase 2-A: PASS
Phase 2-D: PASS
Release verification: PASS (with follow-up)

Verdict: RELEASE READY WITH FOLLOW-UP
```

---

## Phase 2-D evidence (reconfirmed in 2-E)

| Field | Value |
| --- | --- |
| Script | `scripts/_tmp-phase2d-staging-e2e.mjs` |
| Command | `node scripts/_tmp-phase2d-staging-e2e.mjs` |
| Exit | `0` |
| Finished (2-E re-run) | `2026-07-26T07:18:03.708Z` |
| Staging project | `ahlxuyvhzqdqaojiywmu` |
| Production host detected | `false` |
| Stripe charge | `false` |
| Local report (gitignored) | `reports/_tmp-page-gen-phase2d-e2e-report.json` |
| Fixtures meta (gitignored) | `reports/_tmp-page-gen-e2e-fixtures.json` |
| Cleanup | `node scripts/_tmp-phase2d-staging-e2e.mjs --cleanup-listings` → listings deleted |

### Types (2-E re-run)

| Type | Generate | Edit retain | Save | Publish | Detail CTA |
| --- | --- | --- | --- | --- | --- |
| product | PASS | PASS | PASS | PASS | `tasful_purchase` |
| skill | PASS | PASS | PASS | PASS | `tasful_request` |
| job | PASS | PASS | PASS | PASS | `tasful_apply` |
| worker | PASS | PASS | PASS | PASS | `talk_start` |

Listing IDs from the 2-E re-run were cleaned up after verification (do not reuse).

### Script audit (anti false-positive)

- Runs all four listing types against Staging Auth + listings + local Functions.
- Requires paid entitlement **200**, calls real `/api/page-gen-draft` (Gemini), saves `form_data.page_doc`, reloads, compares retention, publish, detail hooks, CTA mapping.
- Refuses Production URL (`ddojquacsyqesrjhcvmn`); exits non-zero on Production browser config or non-PASS verdict.
- Not mock-only; draft failure fails the type / verdict.

---

## Config matrix

| Surface | Expected | Observed in 2-E |
| --- | --- | --- |
| `npm run build:pages` → dist chat config | Production `ddoj…` | **PASS** |
| Root `chat-supabase-config.js` | Production | **PASS** (unchanged) |
| `npm run dev` → dist chat config | Staging `ahlx…` via `ensure-pages-dist` | **PASS** |
| Browser anon only | No service_role value | **PASS** |
| Query-param env switch | Not supported | Confirmed absent in page-gen paths |

**Do not commit** `deploy/cloudflare/dist/chat-supabase-config.js` while it holds Staging inject.

Note: Staging project ID still appears in some **docs / Builder staging notes** under dist (pre-existing documentation copies). Page-gen runtime assets and chat config did not contain Staging after Production build.

---

## DB / SQL requirements (Production Deploy checklist — not executed here)

| Item | Status |
| --- | --- |
| Persist path | `listings.form_data.page_doc` (JSONB) — **no new column** |
| Entitlement SSOT | `public.gen_ai_subscriptions` · feature `ai_page_gen_paid` |
| Paid plans | `basic_300`, `pro_980` |
| RLS | Table deny-all for anon; Functions use service_role (existing GenAI pattern) |
| SQL apply | **No new Migration for page-gen.** Confirm Production already has `gen_ai_subscriptions` + `subscription_status` / period columns (existing GenAI Stripe path). Apply `supabase/gen_ai_subscriptions*.sql` only if drift found. |
| Staging | Table applied in Phase 2-D0; fixtures valid |

---

## Entitlement / UI mapping

| Code | HTTP | UI |
| --- | --- | --- |
| (paid ok) | 200 | Generate enabled |
| `auth_required` | 401 | ログイン案内 |
| `paid_entitlement_required` | 402 | 有料プラン案内 |
| `user_mismatch` | 403 | 一般エラー |
| `entitlement_unavailable` | 503 | 一時的な確認失敗（無料扱いしない） |

Client `isPaid` / `plan` / `entitled` are ignored server-side.

---

## Deploy order (when releasing — not done in 2-E)

1. Production DB confirm (`gen_ai_subscriptions` columns / RLS).
2. Secrets: `GEMINI_API_KEY`, Supabase URL/anon/service_role for Functions (same GenAI stack).
3. `npm run build:pages` with Production `TASFUL_SUPABASE_*` (or root Production config).
4. Scan dist chat config for `ahlxuyvhzqdqaojiywmu` / fixture markers.
5. **Deploy Functions first** (or together with Pages): new UI calling missing `/api/page-gen-*` fails closed for AI only; normal post still works.
6. Deploy Pages.
7. Smoke: unauth 401 · free 402 · paid 200 · one listing generate/save/detail/CTA (stop before real charge).
8. Monitor entitlement/draft status codes.

**Backward compatibility**

| Combo | Behavior |
| --- | --- |
| Old Pages + new Functions | Extra unused APIs — safe |
| New Pages + old Functions | AI generate fails; normal listing CRUD intact — fail closed |

---

## Rollback

- **Pages:** previous Deploy — removes AI panel scripts / merge hooks.
- **Functions:** previous Deploy — entitlement/draft stop; UI shows error, not free access.
- **DB:** no schema rollback required; orphan `form_data.page_doc` ignored by legacy detail path.
- **Entitlement:** fail closed (402/503); never open AI to free users on error.

---

## Monitoring (post-release)

Track counts/rates only (no JWT, no draft body dumps):

- entitlement 200/401/402/403/503
- draft success / `generation_failed` / validation errors
- latency, save errors, PageDoc parse errors
- CTA resolve errors, external CTA rejection
- listing_type usage, form_data size outliers

---

## Follow-up (non-blocking)

| ID | Severity | Item |
| --- | --- | --- |
| F1 | P3 | `/post` に「下書きを生成して反映」と「AIでページを作成」が並立 — 役割説明の明確化（データ破壊なし） |
| F2 | Ops | Production `gen_ai_subscriptions` 列の手動確認を Deploy 直前チェックリストに残す |
| F3 | Test hygiene | `_tmp-phase2d-staging-e2e.mjs` を正式 `scripts/test-…` へ昇格（任意） |

---

## Explicit non-goals (must not appear as available)

booking · join · Builder · Business Directory · mailto/tel/LINE/external URL CTAs · arbitrary URL CTAs

---

## Residual fixtures (kept for Staging re-runs)

| Item | Policy |
| --- | --- |
| Staging paid/free Auth users + paid `gen_ai_subscriptions` row | Keep until Phase 2-E+ ops cleanup |
| Purpose | `platform_page_gen_e2e` |
| Cleanup | `node scripts/setup-staging-page-gen-e2e-fixtures.mjs --cleanup` |
| Listings from E2E | Deleted via `--cleanup-listings` |
| Password / tokens | Only in gitignored `reports/_tmp-page-gen-e2e-fixtures.json` — **never commit** |

---

## Commits included since Phase 2-D0

| SHA | Summary |
| --- | --- |
| `9d679e6` | Staging-safe E2E foundation |
| `fc758bc` | Gemini model `gemini-2.5-flash` for draft API |
| `57952cd` | Nested FAQ edit retention on regenerate |

---

*No Production Deploy and no Push were performed in Phase 2-E.*
