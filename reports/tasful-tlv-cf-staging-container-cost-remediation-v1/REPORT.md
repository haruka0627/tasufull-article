# TASFUL TLV — Cloudflare Staging Container unexpected live instances / cost remediation v1

**Date:** 2026-09-13  
**Branch:** `cursor/tlv-staging-container-cost-2872`  
**Production mutation:** NO  
**Staging Container definition deleted:** NO  

## SUCCESS fields

| Field | Value |
| --- | --- |
| **ROOT_CAUSE** | Staging Worker `tlv-cf-llhls-ingest-staging` created **5 Durable Object / Container identities** (one per stream key or `getRandom` slot). After test publishers stopped, instances stayed **Running** because this repo has **no idle policy**, and Cloudflare only stops instances via `sleepAfter` → `onActivityExpired()` → `stop()`, or an explicit `stop()`. Leftover LL-HLS playlist GETs, a missing `stop()` override, or a keep-alive `renewActivityTimeout()` would all prevent the default 10m sleep. Source is **not in git**, so the exact keep-alive cannot be re-read; the capacity math and platform lifecycle are confirmed. |
| **CURRENT_5_INSTANCE_ATTRIBUTION** | 5 × Cloudflare `standard-3` (2 vCPU / 8 GiB / 16 GB) = **10 vCPU / 40 GiB / 80 GB**. Matches Dashboard live totals exactly. Application name suffix `tlvcfllhlsingestcontainer` = class `TlvCfLlhlsIngestContainer`. |
| **STALE_INSTANCES_CONFIRMED** | **YES (operator Dashboard + contrast + idle window).** Production Ready / live=0. Staging Active / live=5 after streams ended. Default sleep is 10m; persistence beyond that is stale-or-kept-alive. This agent could not re-query Cloudflare (no API token / wrangler). |
| **STAGING_CONTAINER_DELETED** | **NO** |
| **SAFE_SHUTDOWN_METHOD** | `Container.stop()` (Staging lifecycle POST) or Staging `sleepAfter=2m` + `onActivityExpired` → `stop()` after mixin deploy. **Never** Dashboard Delete Container / `wrangler containers delete`. See `OPERATOR-SCALE-TO-ZERO.md`. |
| **STAGING_LIVE_INSTANCES_BEFORE** | **5** (operator Dashboard) |
| **STAGING_LIVE_INSTANCES_AFTER** | **operator step documented** (no CF credentials in this environment; stop requires Human Staging deploy or tokenized stop route) |
| **PRODUCTION_LIVE** | **before=0 / after=0** (not mutated) |
| **INSTANCE_MEMORY_CONFIGURATION** | **standard-3 · 8 GiB RAM · 16 GB disk · 2 vCPU** per instance; 5 live ⇒ 40 GiB billable memory (dominant ~$22.58 line) |
| **IDLE_TIMEOUT_BEFORE** | **unknown in source** (platform default **10m** if unoverridden) |
| **IDLE_TIMEOUT_AFTER** | Staging policy **2m** (in repo, not yet deployed). Production **unchanged** (fail-closed). |
| **LIFECYCLE_FIX_IMPLEMENTED** | **YES (Staging-only module + overlay).** Production code path never applies sleep/stop. Not deployed (source of the live Worker is unpublished). |
| **COST_GUARDRAIL** | **YES.** `NO_ACTIVE_STREAMS AND LIVE>0` past idle timeout → FINDING. `autoDelete=false`. CLI: `node scripts/check-tlv-cf-llhls-ingest-idle-cost.mjs`. |
| **TLV_REGRESSION** | **NONE expected.** No `live/**` UI, Pages Functions, or Production Worker changes. |
| **PRODUCTION_MUTATION** | **NO** |
| **HIGH_CRITICAL_FINDINGS** | **HIGH:** Staging 5 × standard-3 still live / billable. **HIGH:** ingest Worker source absent from repo — runtime cannot be patched without Human. **No CRITICAL** Production live leak (live=0). |
| **HUMAN_GATE_REQUIRED** | **YES** — apply mixin to unpublished Staging Worker, Staging-only deploy, confirm Dashboard live→0. |
| **VERDICT** | **PARTIAL_REMEDIATE / COST_GUARD_READY.** Policy + guardrail + runbook shipped. Live instance count will drop only after Human Staging apply. |
| **EVIDENCE** | `reports/tasful-tlv-cf-staging-container-cost-remediation-v1/` |

## 1. What creates each instance

Cloudflare Containers are **Durable Objects**. Official pattern:

```js
getContainer(env.TLV_CF_LLHLS_INGEST, streamId).fetch(request)
```

Each distinct `streamId` (or each of `N` `getRandom` slots) is one instance
identity. The first `fetch` / `containerFetch` / `start*` starts the VM.

This monorepo does **not** contain that Worker. Inventory:

- No `wrangler.toml` / Worker `wrangler.jsonc`
- No `@cloudflare/containers` / `TlvCfLlhlsIngestContainer` implementation
- Pages Functions: DeepSeek secretary + ZEGO token only
- Docs still say TLV-P0-02 ingest is stub / Cloudflare Stream unconnected

The Staging/Production Container applications therefore come from an
**unpublished deploy**, not from `deploy/cloudflare` Pages.

## 2. Why five, and why they stayed up

Confirmed:

- Five live instances, not a single oversized VM.
- Capacity equals five `standard-3` replicas.
- Production control is zero live — cost is Staging.
- Cloudflare does not keep `min_instances` warm.

Best-supported leftover mechanism (platform docs, ingest shape):

1. Five test stream identities were addressed → five DOs started.
2. After publishers ended, **something still counted as activity** (playlist
   polling, health ping, alarm `renewActivityTimeout`) **or**
   `onActivityExpired` does not `stop()`.
3. Default 10m sleep should have fired if there was truly zero activity.
   Persistence ⇒ not a “Dashboard ghost”; instances are running.

Discarded guesses: see `evidence/discarded-hypotheses.json`.

## 3. Lifecycle fix (smallest, Staging-only)

`workers/tlv-cf-llhls-ingest/src/idle-lifecycle.mjs`:

| Env | `sleepAfter` | `onActivityExpired` | Playback GET without ingest |
| --- | --- | --- | --- |
| Staging | **2m** (apply) | **stop** if no active ingest; **keep** if ingest live | does **not** renew |
| Production / unknown | **no-op** | platform default (unchanged) | still renews (fail-closed) |

Operator stop: Staging `POST /internal/lifecycle/stop` + token → `stop()`.
Rejects Production. Never deletes the application.

Overlay `wrangler.staging.overlay.jsonc` records `instance_type=standard-3`
and `max_instances=5` for the existing Staging Worker. **Do not deploy this
directory as a new Worker** (`DO_NOT_DEPLOY.md`).

## 4. Cost guardrail

`evaluateIdleCostFinding`:

- `LIVE_INSTANCES > 0` AND `activeStreamCount === 0` AND idle past timeout
  → `FINDING NO_ACTIVE_STREAMS_AND_LIVE_INSTANCES`
- Staging severity HIGH; Production observe-only CRITICAL
- `autoDelete=false`; recommended actions are `stop()` / sleepAfter only

## 5. Verification

See `VERIFICATION.md`. Automated tests:

`node scripts/test-tlv-cf-llhls-ingest-idle-lifecycle.mjs`

## 6. Human gate

1. Copy mixin into unpublished Staging Worker source.
2. Deploy Staging only.
3. Confirm Staging live instances → 0; Production stays 0.
4. Do not delete the Container definition.

## Evidence index

| File | Contents |
| --- | --- |
| `evidence/repo-inventory.json` | No Worker source / no CF creds in agent env |
| `evidence/instance-type-correlation.json` | 5 × standard-3 math |
| `evidence/cloudflare-docs-notes.md` | Public lifecycle / stop vs delete |
| `evidence/discarded-hypotheses.json` | Rejected guesses |
| `evidence/guardrail-fixture-stale-staging.json` | 5 live / 0 streams fixture |
| `evidence/guardrail-run.json` | CLI output (generated) |
| `evidence/lifecycle-test-run.json` | Unit test output (generated) |
