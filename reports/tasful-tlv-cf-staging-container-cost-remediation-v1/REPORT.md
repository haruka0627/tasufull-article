# TASFUL TLV — Cloudflare Staging Container unexpected live instances / cost remediation v1

**Date:** 2026-09-13  
**Branch:** `cursor/tlv-staging-container-cost-2872`  
**SSOT:** `deploy/cloudflare/workers/tlv-cf-llhls-ingest/worker.js`  
**Ops:** `ops-status.md`

## FINAL fields

| Field | Value |
| --- | --- |
| **ROOT_CAUSE** | `worker.js` already has `sleepAfter="2m"` and `onActivityExpired → destroy/stop`. Those hooks **do not run** while `@cloudflare/containers` renews on every proxied fetch/WS (`inflightRequests > 0` ⇒ `isActivityExpired()` false) **and/or occupancy keep-alive / unreleased occupancy** (including dummy `aaaa…`) keeps hitting the DO. Ops: created ~2026-09-11, sleepAfter NOT clearing. Not “source absent”. Not a missing timeout field. |
| **CURRENT_5_INSTANCE_ATTRIBUTION** | Ops Staging **LIVE=7**, **5 running DO names** incl. dummy `aaaa…`, `max_instances=8`, `standard-3`. 5 × 8 GiB = 40 GiB (earlier Dashboard memory). App `a03deec3-…`. |
| **STALE_INSTANCES_CONFIRMED** | **YES** (ops) |
| **STAGING_CONTAINER_DELETED** | **NO** |
| **SAFE_SHUTDOWN_METHOD** | **`POST /v1/stop` + ingest JWT** in `worker.js`. Optional Staging `/v1/admin-stop` behind Human GO. `/v1/admin-destroy` = 404. |
| **STAGING_LIVE_INSTANCES_BEFORE** | **7** (ops) |
| **STAGING_LIVE_INSTANCES_AFTER** | **operator step documented** (Human Staging `wrangler deploy` of this directory + `/v1/stop` as needed) |
| **PRODUCTION_LIVE** | **7 / 7 observed only — not mutated** |
| **INSTANCE_MEMORY_CONFIGURATION** | **standard-3 · 8 GiB · 16 GB · 2 vCPU · max_instances=8** |
| **IDLE_TIMEOUT_BEFORE** | **2m already in worker.js** (ineffective due to renew/occupancy) |
| **IDLE_TIMEOUT_AFTER** | Staging **2m** + **no-forward idle playback/occupancy ping** + **occupancy-release** + **ingest-idle watchdog**. Production **unchanged**. |
| **LIFECYCLE_FIX_IMPLEMENTED** | **YES in SSOT `worker.js` / `occupancy-release.mjs` (Staging-only).** This agent did not deploy. |
| **COST_GUARDRAIL** | **YES.** FINDING when LIVE>0 and no active streams past idle. `autoDelete=false`. |
| **TLV_REGRESSION** | **NONE expected** |
| **PRODUCTION_MUTATION** | **NO** (`wrangler.production.toml` must not be deployed) |
| **HIGH_CRITICAL_FINDINGS** | **HIGH** Staging LIVE=7 stale. **CRITICAL observe-only** Production LIVE=7. |
| **HUMAN_GATE_REQUIRED** | **YES** — Staging deploy of this directory; `/v1/stop` for current LIVE DOs. No Prod deploy. |
| **VERDICT** | **PARTIAL_REMEDIATE / COST_GUARD_READY** |
| **EVIDENCE** | `reports/tasful-tlv-cf-staging-container-cost-remediation-v1/` |

## 1. SSOT

Canonical Worker source **is in this repo**:

- `deploy/cloudflare/workers/tlv-cf-llhls-ingest/worker.js`
- `deploy/cloudflare/workers/tlv-cf-llhls-ingest/wrangler.toml`
- `deploy/cloudflare/workers/tlv-cf-llhls-ingest/occupancy-release.mjs`
- `deploy/cloudflare/workers/tlv-cf-llhls-ingest/wrangler.production.toml` (observe only)

`workers/tlv-cf-llhls-ingest/` is superseded (`MIGRATION.md`).

## 2. Why sleepAfter=2m left 5 running since ~2026-09-11

1. **Activity renew (primary, platform):** `Container.fetch` increments inflight and renews; WS messages renew; `isActivityExpired()` returns false while inflight > 0.
2. **Occupancy keep-alive:** health/occupancy/ping that is forwarded to the DO is another renew. Dummy `aaaa…` is a held slot that never released.
3. **Not** missing `sleepAfter` / missing `onActivityExpired` / `min_instances`.

## 3. Fix in that code path (Staging-only)

`worker.js` (`TLV_CF_LLHLS_ENV=staging` only):

- Do not `super.fetch` idle playback, occupancy keep-alive, or dummy GET
- `releaseOccupancyIfIdle` then ingest-idle watchdog `destroy`/`stop`
- `POST /v1/stop` still SAFE_SHUTDOWN
- `/v1/admin-destroy` 404; `/v1/admin-stop` 404 unless Human GO

Production env in the same file is fail-closed (forwards, no watchdog stop).

## 4. Cost guardrail

Unchanged FINDING detector. Never deletes the app.

## 5. Verification

- `node scripts/test-tlv-cf-llhls-ingest-idle-lifecycle.mjs` → **64/64 PASS**
- Human: Staging `wrangler deploy` from this directory only; then `/v1/stop` remaining LIVE DOs if needed

## 6. Human gate

1. `POST /v1/stop` + ingest JWT for each stale Staging DO (incl. `aaaa…`).
2. `wrangler deploy` **Staging `wrangler.toml` only**.
3. Do not deploy `wrangler.production.toml`.
4. Do not Delete Container.
