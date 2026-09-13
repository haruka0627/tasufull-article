# TASFUL TLV — Cloudflare Staging Container unexpected live instances / cost remediation v1

**Date:** 2026-09-13  
**Branch:** `cursor/tlv-staging-container-cost-2872`  
**Ops evidence:** `ops-status.md` (incorporated; not re-guessed)

## FINAL fields

| Field | Value |
| --- | --- |
| **ROOT_CAUSE** | Staging `worker.js` already has `sleepAfter="2m"` and `onActivityExpired → destroy/stop`. Those hooks **never run** for the stuck DOs. `@cloudflare/containers` treats every proxied `fetch` / WebSocket message as activity (`renewActivityTimeout`) and `isActivityExpired()` is **false while `inflightRequests > 0`** (then it renews). Leftover LL-HLS playlist polls, hung WHIP/WS, or dummy `aaaa…` traffic keep inflight/renew going. Ops: “sleepAfter NOT clearing — stuck/activity renew.” Instances created ~2026-09-11. Adding another `sleepAfter` would not fix this. |
| **CURRENT_5_INSTANCE_ATTRIBUTION** | Ops: Staging **LIVE=7**, **5 running DO names** including dummy `aaaa…`, `max_instances=8`, `instance_type=standard-3`. Five running × (2 vCPU / 8 GiB / 16 GB) = **10 vCPU / 40 GiB / 80 GB** (matches earlier Dashboard totals). App `a03deec3-…` / `tlv-cf-llhls-ingest-staging-tlvcfllhlsingestcontainer`. |
| **STALE_INSTANCES_CONFIRMED** | **YES** (ops). Created ~2026-09-11; `sleepAfter=2m` not clearing. |
| **STAGING_CONTAINER_DELETED** | **NO** |
| **SAFE_SHUTDOWN_METHOD** | **`POST /v1/stop` + ingest JWT** → instance `destroy`/`stop`. App definition remains. Wrangler has no stop. See `OPERATOR-SCALE-TO-ZERO.md`. Optional Staging `/v1/admin-stop` behind Human GO (`TLV_CF_LLHLS_ADMIN_STOP_GO=1`). `/v1/admin-destroy` stays 404. |
| **STAGING_LIVE_INSTANCES_BEFORE** | **7** (ops) |
| **STAGING_LIVE_INSTANCES_AFTER** | **operator step documented** (`POST /v1/stop` / Human Staging deploy of fetch-guard). This agent did not call Cloudflare. |
| **PRODUCTION_LIVE** | **before=7 / after=7 (observed only, not mutated)** |
| **INSTANCE_MEMORY_CONFIGURATION** | **standard-3 · 8 GiB · 16 GB disk · 2 vCPU**; `max_instances=8` |
| **IDLE_TIMEOUT_BEFORE** | **2m already in worker.js** (not effective because of activity renew) |
| **IDLE_TIMEOUT_AFTER** | Staging still **2m**, plus **ingest-idle watchdog** and **do-not-forward idle playback**. Production **unchanged**. |
| **LIFECYCLE_FIX_IMPLEMENTED** | **YES (Staging-only fetch-guard + ingest-idle watchdog).** Production fail-closed. Not deployed from this agent. |
| **COST_GUARDRAIL** | **YES.** `NO_ACTIVE_STREAMS AND LIVE>0` past idle → FINDING. `autoDelete=false`. |
| **TLV_REGRESSION** | **NONE expected.** No `live/**` UI / Pages Function / Production Worker changes. |
| **PRODUCTION_MUTATION** | **NO** |
| **HIGH_CRITICAL_FINDINGS** | **HIGH:** Staging LIVE=7 stale / billable. **CRITICAL (observe-only):** Production LIVE=7 listed — not mutated. **HIGH:** full `worker.js` image still unpublished in git; Human must merge fetch-guard then Staging-deploy. |
| **HUMAN_GATE_REQUIRED** | **YES** — `POST /v1/stop` now; merge+Staging deploy; optional admin-stop GO. No Prod deploy. |
| **VERDICT** | **PARTIAL_REMEDIATE / COST_GUARD_READY.** Root cause corrected from “missing sleepAfter” to **activity renew / inflight**. Live counts drop only after Human `/v1/stop` or Staging apply. |
| **EVIDENCE** | `reports/tasful-tlv-cf-staging-container-cost-remediation-v1/` |

## 1. What creates each instance

Worker `tlv-cf-llhls-ingest-staging`, class `TlvCfLlhlsIngestContainer`,
`getContainer(env.BINDING, streamId).fetch(request)`. Each stream id is one
DO / Container. Ops listed 5 running names including dummy `aaaa…`.

Wrangler (ops / this PR path):

`deploy/cloudflare/workers/tlv-cf-llhls-ingest/wrangler.toml`

`max_instances=8`, `instance_type=standard-3`.

## 2. Why sleepAfter / onActivityExpired fails

Ops already set both. Platform source (`@cloudflare/containers` `container.ts`):

- Proxied fetch increments `inflightRequests` and calls `renewActivityTimeout()`.
- Each WebSocket message renews again.
- `isActivityExpired()`: if `inflightRequests > 0`, **renew and return false**.

So `onActivityExpired → destroy/stop` is never reached while leftover HLS,
hung ingest, or dummy traffic exists. That matches ops “stuck/activity renew”
and ~2-day-old instances.

Discarded: missing `sleepAfter`, `min_instances`, Delete Container as shutdown.

## 3. Lifecycle fix (Staging-only)

`deploy/cloudflare/workers/tlv-cf-llhls-ingest/src/idle-lifecycle.mjs`
+ `src/fetch-guard.mjs`:

| Path | Staging | Production |
| --- | --- | --- |
| Idle playback / dummy forward to `Container.fetch` | **no** (410) | unchanged (forward) |
| Ingest-idle watchdog (2m, ignores inflight) | **stop/destroy** | skip |
| `POST /v1/stop` + ingest JWT | SAFE_SHUTDOWN | refused |
| `POST /v1/admin-stop` | 404 unless Human GO=`1` | 404 |
| `/v1/admin-destroy` | **404** | 404 |
| `sleepAfter` field | leave **2m** | unchanged |

Do not `wrangler deploy` this directory as a standalone Worker (no image).

## 4. Cost guardrail

`NO_ACTIVE_STREAMS AND LIVE>0` past idle → FINDING. Never auto-delete.
Production LIVE=7 is CRITICAL observe-only.

## 5. Verification

See `VERIFICATION.md`. This agent (no Cloudflare mutation):

- `node scripts/test-tlv-cf-llhls-ingest-idle-lifecycle.mjs` → **49/49 PASS**
- Staging fixture → FINDING live=7 / streams=0 / HIGH / `autoDelete=false`
- Production fixture → FINDING live=7 CRITICAL observe-only / `productionMutation=NO`

## 6. Human gate

1. `POST /v1/stop` + ingest JWT for each stale Staging DO (incl. `aaaa…`).
2. Merge fetch-guard into unpublished Staging `worker.js`.
3. Deploy **Staging only**.
4. Confirm Staging live drops. Production stays as observed (do not touch).
5. Do not delete the Container application.

## Evidence index

| File | Contents |
| --- | --- |
| `ops-status.md` | Operator-collected wrangler + LIVE counts |
| `evidence/discarded-hypotheses.json` | Rejected guesses |
| `evidence/instance-type-correlation.json` | standard-3 math |
| `evidence/cloudflare-docs-notes.md` | Platform renew / inflight |
| `evidence/guardrail-fixture-stale-staging.json` | live=7 / 0 streams |
| `evidence/guardrail-fixture-production-observe.json` | Prod live=7 observe |
| `evidence/guardrail-run.json` | CLI (generated) |
| `evidence/lifecycle-test-run.json` | Unit tests (generated) |
