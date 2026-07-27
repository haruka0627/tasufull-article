# ANPI Phase 65 — Production Readiness Blocker Resolution

**Date:** 2026-07-27  
**Production operations executed:** **false**  
**Canary identity selected:** **false**

```text
PR_20: MERGED
PR_21: MERGED
PR_22: MERGED
ANPI_PROD_V1_IDEMPOTENCY: IMPLEMENTED (unit)
ANPI_RUNTIME_PAUSE_HARDENING: IMPLEMENTED (unit + claim_mode)
ANPI_PRODUCTION_DB_LIVE_AUDIT: NOT PERFORMED (no Production connection · human auth)
ANPI_PRODUCTION_MIGRATION_DRAFT: READY (not applied)
ANPI_PRODUCTION_WORKER_DRAFT: READY (not deployed · fail-closed stub)
ANPI_PRODUCTION_CUTOVER: NO-GO · WAITING_EXPLICIT_APPROVAL
```

---

## 1. PR #20 / #21 / #22 merge state

| PR | Topic | Result |
|----|--------|--------|
| #20 | Phase 62 scoped Cron soak | **MERGED** → `c79bfc4` |
| #21 | Phase 63 wall-clock soak | **MERGED** → `fd036ac` |
| #22 | Phase 64 cutover plan | **MERGED** → `925a9e8` |

`origin/main` at Phase 65 start: `925a9e8`.  
Evidence docs for Phase 62/63/64 are on main. Local worktree branch deletes skipped (in use) — remotes merged cleanly (`mergeable=MERGEABLE`, CF Pages SUCCESS).

---

## 2. Production DB inventory

### 2.1 Live Production audit

**Not executed.** No Production Supabase credentials used. Supabase MCP Production is forbidden.  
Live Production inventory requires **human read-only** Dashboard/CLI against `ddojquacsyqesrjhcvmn`.

### 2.2 Expected objects (from `origin/cf-pages-deploy` migrations)

| Migration | Objects (summary) |
|-----------|-------------------|
| Phase 2–3 | settings / checks foundations |
| Phase 4 | `anpi_scheduler_jobs`, `anpi_scheduler_runs` |
| Phase 5 | emergency contacts |
| Phase 6 | delivery worker · `anpi_phase6_claim_jobs` · leases |
| Phase 8–10 | talk adapter · `anpi_resolve_talk_user_id` · write path (real write hard-disabled) |

**Not in migrations:** Phase 62 allowlist (Staging draft applied manually only).

### 2.3 Staging live snapshot (read-only · staging only)

| Object | Staging |
|--------|---------|
| `anpi_scheduler_jobs` / `runs` / deliveries | reachable |
| `anpi_phase62_claim_allowlist_gate` | present · **enabled=false** · allowlist `{0411f04d}` |
| `anpi_phase62_claim_allowlist_emergency_disable` | callable |
| Claim RPCs via empty `{}` | PostgREST signature miss (expected) — objects used successfully in Phase 62/63 soaks |

### 2.4 Staging vs Production delta (planning)

| Item | Staging | Production |
|------|---------|------------|
| Phase 4–10 | Present (soak-proven) | **LIVE UNVERIFIED** — human must confirm |
| Phase 62 gate/RPC | Present | **Missing** — use Phase 65 Prod draft (`anpi_prod_*`) |
| Staging test sha8 | Allowed in Staging gate | **Rejected** by Prod draft trigger |
| Apply method | Manual SQL | Human-approved only · not MCP |

### 2.5 Migration / rollback drafts (not applied)

- [`sql/anpi-phase65-production-claim-allowlist-draft.sql`](../sql/anpi-phase65-production-claim-allowlist-draft.sql)  
  - Target ref **`ddojquacsyqesrjhcvmn` only**  
  - Additive · parallel claim · empty allowlist · refuses `0411f04d`  
  - Does **not** replace `anpi_phase6_claim_jobs`
- [`sql/anpi-phase65-production-claim-allowlist-rollback.sql`](../sql/anpi-phase65-production-claim-allowlist-rollback.sql)

---

## 3. `anpi:prod:v1` implementation

| Item | Value |
|------|--------|
| Module | `scripts/lib/anpi-prod-stable-idempotency.mjs` |
| Prefix | `anpi:prod:v1:{kind}:{check_id}:{subject_sha8}:{YYYY-MM-DD}` |
| Notification id | `anpi-prod-{sha256(key)}` |
| Source marker (proposal) | `anpi_prod_canary` |
| Staging mix | Rejected (`anpi:p61:v1` forbidden) |
| Excluded factors | attempt · lease · worker · Cron ms |

**Tests:** `node scripts/test-anpi-phase65-prod-readiness.mjs` — due bucket stability · kind/check collision · reclaim/partial-failure same id.

**Not done:** Production inbox writes · wiring prod writer into Worker Cron.

---

## 4. Runtime pause hardening

| Control | Behavior |
|---------|----------|
| `ANPI_*_RUNTIME_ENABLED=false` | Phase 56 refuses tick (unchanged) — **no** claims |
| `resolveClaimMode` | `scoped` \| `legacy` \| `none` |
| `ANPI_ALLOW_LEGACY_CLAIM` | Staging default **true** · Production default **false** |
| Phase 63 race | Scoped OFF + runtime ON + legacy allowed → legacy claim (**unsafe**) |
| Mitigation | Production `ANPI_ALLOW_LEGACY_CLAIM=false` → mode `none` (no claim during flag flip) |
| Forced order | `FORCED_PAUSE_ORDER` in `anpi-runtime-pause.mjs` |

Phase 48 now branches on `claim_mode` (`paused_no_claim` when none).  
Staging `wrangler.toml` documents `ANPI_ALLOW_LEGACY_CLAIM=true`.

**Verification:** unit simulation of flag-off race (PASS). No Production deploy. Staging Worker not redeployed in this phase (optional; defaults remain safe with legacy true for stub continuity).

---

## 5. Production Worker readiness draft

Path: `deploy/cloudflare/workers/anpi-production-scheduler/`

| Item | Draft |
|------|--------|
| Name | `anpi-production-scheduler` |
| Runtime default | false |
| Legacy claim | **false** |
| Scoped flags | false |
| Provider | `talk_local` |
| Stub entry | fail-closed (`anpi_prod_worker_draft_not_wired`) |
| Deploy | **NOT DONE** |

### Secrets names (prepare · do not request values here)

1. `ANPI_PRODUCTION_SUPABASE_URL`  
2. `ANPI_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY`  
3. `ANPI_DIAGNOSTIC_TOKEN`

**Code gap:** Phase 56 adapter is staging-only — Production adapter wiring remains a blocker before real Cron.

---

## 6. Ops tabletop

| Scenario | Operator action | Pass criteria |
|----------|-----------------|---------------|
| Enable canary | Pause → inflight=0 → flags/secrets → deploy → health → set canary sha8 → gate enable → limited resume | Only canary sha8 claimed · INSERT≤1 · duplicate 0 |
| Observe | Wall-clock Cron 1–3 · wrangler tail + leases | `trigger=cloudflare_cron` · lease released · error_safe null |
| Emergency disable | Gate emergency_disable · prefer pause first | claim 0 · gate false |
| Rollback | Pause → disable → flags OFF → cron clear → wrangler rollback | in-flight 0 · no new canary rows |
| Stuck lease | Pause · reclaim/fail processing · release lease rows | no null `finished_at` beyond TTL |
| Duplicate suspicion | Pause · count canary source ids | remaining logical ids ≤1 · STOP if >1 |
| Missed Cron | Check leases vs schedule · page if >2 intervals | alert · pause if writing |
| Provider error | Confirm still `talk_local*` | non-local → STOP |
| Project ref mismatch | Health/logs show Production ref only | staging URL → STOP |

Full order: see Phase 64 plan + `FORCED_PAUSE_ORDER`.

---

## 7. Remaining blockers (cutover still NO-GO)

1. **Human read-only Production DB inventory** (confirm Phase 4–10 present)  
2. **Human apply** of Prod allowlist draft (after review) — not this phase  
3. **Canary identity selection** (human)  
4. **Production adapter** (Phase 56 dual-env or prod-specific) before real Worker wiring  
5. **Wire `anpi:prod:v1` writer** into Cron path (code) — unit only today  
6. **Ops tabletop sign-off** recorded by humans  
7. **Explicit Production cutover approval**

---

## 8. Can we approve Production cutover now?

**No.** Plan and several blockers improved, but `ANPI_PRODUCTION_CUTOVER` remains **NO-GO**.

Updated readiness snapshot:

| Judgment | Phase 65 |
|----------|----------|
| CUTOVER_PLAN | READY (Phase 64) |
| DB_READINESS | NOT READY (live Prod unverified · draft ready) |
| WORKER_READINESS | PARTIAL (draft + secrets names · not deployable for real ticks) |
| NOTIFICATION_READINESS | PARTIAL (`anpi:prod:v1` unit · no Prod write path wired) |
| OPS_READINESS | PARTIAL (tabletop documented · human sign-off pending) |
| CUTOVER | **NO-GO** |

---

## 9. Commands

```bash
node scripts/test-anpi-phase65-prod-readiness.mjs
node scripts/test-anpi-phase56-cloudflare-scheduler.mjs
node scripts/test-anpi-phase62-scoped-cron-path.mjs
```

## 10. Related paths

- `scripts/lib/anpi-prod-stable-idempotency.mjs`
- `scripts/lib/anpi-runtime-pause.mjs`
- `sql/anpi-phase65-production-claim-allowlist-draft.sql`
- `deploy/cloudflare/workers/anpi-production-scheduler/`
- `reports/anpi-phase65-blocker-resolution.json`
