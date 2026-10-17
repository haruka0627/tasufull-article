# ANPI Phase 64 — Production Cutover Plan & Ops Sign-off Readiness

**Date:** 2026-07-27  
**Scope:** Design · runbooks · Go/No-Go only  
**Production operations:** **NOT EXECUTED** · waiting explicit human approval  
**Staging soaks (正本):** Phase 62 SOAK PASS · Phase 63 WALL_CLOCK_SOAK PASS

```text
ANPI_PRODUCTION_CUTOVER_PLAN:           READY
ANPI_PRODUCTION_DB_READINESS:           NOT READY
ANPI_PRODUCTION_WORKER_READINESS:       NOT READY
ANPI_PRODUCTION_NOTIFICATION_READINESS: NOT READY
ANPI_PRODUCTION_OPS_READINESS:          PARTIAL (plan READY · sign-off PENDING)
ANPI_PRODUCTION_CUTOVER:                NO-GO · WAITING_EXPLICIT_APPROVAL
```

---

## 0. Locked lessons from Phase 63

| Fact | Treatment |
|------|-----------|
| Wall-clock scoped path PASS (6 Cron ticks · INSERT 1 · already_seen 5 · duplicate 0) | Staging proof of allowlisted claim → Phase 61 writer |
| Subjects only `{0411f04d}` on scoped path | Allowlist filter works when gate+flags ON |
| **14:45 flag-off deploy race** briefly ran `legacy_stub` and claimed outsider pending jobs | **Not** a scoped allowlist violation · **is** a config-switch runtime race |
| Mandatory Production order | **runtime pause → in-flight=0 → config change → deploy → health → gate enable → limited resume → observe** |

Staging test sha8 `{0411f04d}` must **never** be copied into Production allowlist.

---

## 1. Production current-state audit (readonly)

### 1.1 Project separation

| Env | Project ref | Role |
|-----|-------------|------|
| Staging | `ahlxuyvhzqdqaojiywmu` | Soak · drafts · Worker `anpi-staging-scheduler` |
| Production | `ddojquacsyqesrjhcvmn` | **Forbidden** for soak scripts · MCP · this phase |

Scripts/libs refuse Production URL/ref (Phase 48/56/61/62/63).

### 1.2 DB / migrations / RLS / RPC

| Area | Staging | Production (as of this plan) |
|------|---------|------------------------------|
| Phase 4–10 scheduler / delivery / talk adapter | Present on deploy branches; apply history must be verified per env | **Must be human-verified** before cutover — migrations labeled “review before prod” |
| Phase 15 identity mapping / Phase 17 insert gate | Staging SQL drafts · Staging live for probes | Phase 17 is **Staging-only** by design — do **not** port Phase 17 test gate to Production |
| Phase 62 claim allowlist | Applied on Staging · gate OFF · **not** in `supabase/migrations/` | **Missing** — needs Production-reviewed SQL package (new migration), not blind copy of staging draft |
| Phase 10 real write | Hard-disabled (`anpi_talk_real_write_disabled`) | Same hard-disable until separate enablement decision |
| Early ANPI RLS (`anpi-rls-production.sql`) | Separate from notify stack | Checklist exists (`docs/anpi-supabase-production-checklist.md`) — **does not** cover Phase 6–10/62 |

**DB readiness verdict:** **NOT READY** until Production apply inventory + Phase 62-class Production migration + RLS/RPC grants are reviewed and recorded.

### 1.3 Identity mapping & `official_anpi`

| Component | Notes |
|-----------|--------|
| `anpi_resolve_talk_user_id` | Fail-closed · required before inbox INSERT |
| TALK room | Client `official_anpi` (not a new chat product) |
| Card path | `talk-official-notify-card.js` · `type=anpi` · `target_url=#` |
| Production canary | Auth↔Talk bind must be pre-verified for **one** approved identity (sha8 only in docs/logs) |

**Notification path readiness:** Design READY · Production send **NOT READY**.

### 1.4 Worker / Cron / Secrets

| Item | Staging | Production |
|------|---------|------------|
| Worker name | `anpi-staging-scheduler` | **Does not exist** — require separate `anpi-production-scheduler` (proposed) |
| Cron | `*/5 * * * *` UTC | Not registered for Production ANPI |
| Secrets | `ANPI_STAGING_*` | Must use **Production-named** secrets · never reuse Staging |
| Flags | `ANPI_P62_*` / `ANPI_P61_*` default **false** · provider `talk_local` | Same fail-closed defaults until canary window |

**Worker readiness:** **NOT READY**.

### 1.5 Merge integrity (human gate)

| PR | Topic | Status at plan time |
|----|--------|---------------------|
| #19 | Phase 62 SQL apply docs | Merged (prior) |
| #20 | Phase 62 scoped Cron soak | **OPEN** — merge before Production planning freeze preferred |
| #21 | Phase 63 wall-clock soak | **OPEN** — merge before Production planning freeze preferred |

Cutover must not proceed with soak evidence only on feature branches.

### 1.6 Provider / competing paths

| Path | Production cutover stance |
|------|---------------------------|
| `talk_local*` stub | Safe idle / pause resume default |
| Phase 61 scoped writer + Phase 62 allowlisted claim | **Only** approved real-write Cron path for canary |
| `ANPI_NOTIFICATION_PROVIDER=talk_write` | **Do not use** as cutover switch (CF/Phase 48 reject · wrong layer) |
| Phase 8 attempt-scoped `create_internal` | **Do not** enable as primary Cron writer (duplicate risk) |
| SMS / phone / email / Push / Realtime | **Forbidden** for core ANPI notify |

---

## 2. Production allowlist design

### 2.1 Rules

1. Staging sha8 `{0411f04d}` is **test-only** — **never** Production allowlist entry.
2. Docs, tickets, logs, alerts: **sha8 only** (or opaque canary id). **No raw auth UUID.**
3. Initial cutover: **exactly one** canary identity (or empty until filled by ops under dual control).
4. Allowlist expansion = **new review + new approval** (never silent growth).
5. Gate default **`enabled=false`**. Emergency disable must be one RPC / runbook step.

### 2.2 Canary selection method (human)

Ops selects Production canary using **all** of:

- [ ] Explicit written consent / internal owner approval for receiving ANPI inbox canary
- [ ] Auth user exists in Production
- [ ] `anpi_resolve_talk_user_id` resolves to expected Talk id (verify sha16 privately; log sha only)
- [ ] Not a high-blast shared inbox / admin broadcast identity
- [ ] Preference: internal staff or contracted pilot — **not** random marketplace user
- [ ] Record: `canary_auth_sha8`, `canary_talk_sha16`, approver, approved_at (no raw UUIDs in git)

### 2.3 Lifecycle

| Action | Procedure (design) |
|--------|-------------------|
| Add | Dual review → update gate allowlist array → keep gate OFF → verify digest → enable only in canary window |
| Remove | Update array **or** emergency_disable first if mid-window |
| Emergency stop | `anpi_phase62_claim_allowlist_emergency_disable()` equivalent on Production objects → runtime pause |

### 2.4 Proposed Production object naming

Keep parallel (do **not** replace) `anpi_phase6_claim_jobs`:

- Gate table: `anpi_prod_claim_allowlist_gate` (or versioned `anpi_phase64_*` after review)
- Claim RPC: `anpi_prod_claim_jobs_allowlisted(...)`
- Enable / `emergency_disable` — `service_role` only

Staging Phase 62 names may remain Staging-only; Production package should be explicitly labeled **PRODUCTION** in migration headers.

---

## 3. Production idempotency design

### 3.1 Formal key (locked proposal)

```text
anpi:prod:v1:{kind}:{check_id}:{subject_sha8}:{YYYY-MM-DD}
```

| Factor | Rule |
|--------|------|
| Version prefix | `anpi:prod:v1` — **not** `anpi:p61:v1` (staging marker) |
| kind | Job kind (`initial` / `reminder` / …) |
| check_id | Check instance UUID string |
| subject_sha8 | sha256(auth_user_id)[:8] |
| date bucket | `logicalDueAt` normalized to **UTC `YYYY-MM-DD`** (same semantics as Phase 61) |
| Excluded | attempt · lease · worker_id · execution_id · Cron scheduledTime ms |

Notification id: `anpi-prod-{sha256(key)}` (or length-safe truncating scheme matching existing id constraints).

Inbox `source` marker for canary: `anpi_prod_canary` (distinct from `anpi_phase61_test`).

### 3.2 Timezone / due boundary

- Logical due uses job `available_at` (or approved due field) → UTC date bucket.
- Asia/Tokyo schedule still maps through existing check `local_check_date` / `scheduled_at` constraints; key uses UTC bucket for stability across reclaim.
- Kind / check_id differences must not collide (already proven in Phase 61 unit semantics).

### 3.3 Write-then-job-update failure

| Step | Failure | Recovery |
|------|---------|----------|
| INSERT inbox | Fail | Job remains `processing`/`failed` · lease release · retry later · **no** duplicate if INSERT never committed |
| INSERT success · job status update fail | Partial | Reclaim/retry → stable key → **already_seen** · job can be marked `sent` on retry · **duplicate INSERT must be 0** |
| Collision on id | `ON CONFLICT` / ignore-duplicates | Treat as already_seen |

### 3.4 Accidental aggregation

Forbid keys that omit `check_id` or `kind`. Never aggregate multiple checks into one notification id.

---

## 4. Runtime pause design (mandatory)

### 4.1 Pause state location

| Layer | Control | Effect |
|-------|---------|--------|
| **P0 Worker runtime flag** | `ANPI_PRODUCTION_RUNTIME_ENABLED=false` (name TBD · mirror staging) | Phase 56 adapter refuses tick → **no** Phase 47 legacy · **no** scoped path |
| **P1 Scoped gate** | gate `enabled=false` | Scoped claim returns **0** rows |
| **P2 Scoped flags** | `ANPI_P62_SCOPED_CRON_PATH=false` · writer flag false | Even if runtime on, real writer disconnected |
| **P3 Cron remove** | Clear `[triggers].crons` | No scheduled invocations |
| **P4 Provider** | Remain `talk_local*` | Never flip to `talk_write` for cutover |

**Invariant:** Pause must stop **both** legacy claim and scoped claim. Phase 63 proved: flipping scoped flags while Cron still runs can execute **legacy_stub**. Therefore **P0 before any flag/secret/config deploy**.

### 4.2 Cutover-forbidden if

- Any `anpi_scheduler_runs` lease for Production worker with `finished_at IS NULL` and not expired beyond TTL
- Any job `status=processing` with live lease for canary / allowlisted subjects (or global if unscoped risk)
- Runtime flag still `true` while changing secrets/flags

### 4.3 Pause / resume audit

Record (ops ticket + optional DB note):

- who · when · reason · from_version → to_version · runtime flag · gate · scoped flags · cron present · in-flight counts

Suggested log fields (Worker JSON): `runtime_enabled`, `scoped_cron_path`, `gate_enabled_echo` (if probed), `pause_reason_code`.

### 4.4 Resume prerequisites (all true)

1. Runtime was paused and deploy healthy  
2. In-flight = 0  
3. Project ref = Production only  
4. Provider = `talk_local*`  
5. Scoped flags match intended canary config  
6. Gate allowlist = approved canary sha8 only  
7. Observer ready (tail + lease query)

---

## 5. Cutover runbook (commands = documentation only · **DO NOT RUN** in this phase)

> Replace placeholders. Never paste secrets into tickets/git.

### 5.1 Preflight

```text
[ ] PRs #20/#21 (or successors) merged to deploy branch
[ ] Production ref confirmed ddojquacsyqesrjhcvmn (Dashboard)
[ ] Staging Worker not pointed at Production secrets
[ ] Canary sha8 approved on paper
[ ] Rollback owner online
[ ] Monitoring channel ready
```

### 5.2 Backup / rollback prep

```text
[ ] Note current Production Worker versions (if any) / confirm none
[ ] Export allowlist gate row (empty/disabled) after objects exist
[ ] Confirm emergency_disable RPC exists and is granted to service_role only
[ ] Confirm wrangler rollback / prior artifact available
```

### 5.3 Runtime pause (first!)

```bash
# DOC ONLY — Production Worker directory (to be created; not staging)
cd deploy/cloudflare/workers/anpi-production-scheduler
# Set ANPI_PRODUCTION_RUNTIME_ENABLED=false in wrangler.toml [vars]
npx wrangler deploy
# Confirm: no new anpi_scheduler_runs for prod worker for ≥1 Cron period
```

```sql
-- DOC ONLY · service_role on Production
-- select count(*) from anpi_scheduler_runs
--  where finished_at is null and worker_id like 'anpi-p48-lease:cf-prod-%';
-- Expect 0 before proceeding
```

### 5.4 DB / RLS / RPC apply

```text
[ ] Apply reviewed Production migration package (Phase 4–10 if not present)
[ ] Apply Production allowlist gate + parallel claim RPC (new migration)
[ ] Verify legacy anpi_phase6_claim_jobs unchanged
[ ] Verify grants: service_role execute; anon/auth denied
[ ] Verify gate enabled=false · allowlist=[canary_sha8]
```

### 5.5 Secrets registration

```bash
# DOC ONLY
npx wrangler secret put ANPI_PRODUCTION_SUPABASE_URL
npx wrangler secret put ANPI_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put ANPI_DIAGNOSTIC_TOKEN
# Never reuse Staging secret values
```

### 5.6 Worker deploy + Cron

```bash
# DOC ONLY
# wrangler.toml: ANPI_ENVIRONMENT=production
# ANPI_PRODUCTION_PROJECT_REF=ddojquacsyqesrjhcvmn
# ANPI_NOTIFICATION_PROVIDER=talk_local
# ANPI_P62_SCOPED_CRON_PATH=false
# ANPI_P61_SCOPED_WRITER_ENABLED=false
# ANPI_PRODUCTION_RUNTIME_ENABLED=false   # still paused
# crons = ["*/5 * * * *"]   # optional while paused (ticks no-op) OR omit until resume
npx wrangler deploy
curl -sS "https://anpi-production-scheduler.<account>.workers.dev/health"
```

### 5.7 Health / provider / project ref

```text
[ ] health.environment == production
[ ] logs refuse staging ref
[ ] provider talk_local
[ ] diagnostic (if used) returns SKIPPED/FAIL while runtime false — not PASS scoped writes
```

### 5.8 Scoped flags (still paused)

```text
[ ] Set ANPI_P62_SCOPED_CRON_PATH=true
[ ] Set ANPI_P61_SCOPED_WRITER_ENABLED=true
[ ] Deploy while RUNTIME_ENABLED=false
[ ] Confirm no claims (runtime pause)
```

### 5.9 Gate enable (still paused)

```sql
-- DOC ONLY
select * from anpi_prod_claim_allowlist_enable();  -- name per final migration
-- Verify enabled=true · allowlist length=1 · sha8=canary
```

### 5.10 Limited runtime resume (canary only)

```text
[ ] In-flight still 0
[ ] Set ANPI_PRODUCTION_RUNTIME_ENABLED=true
[ ] Deploy
[ ] Observe 1–3 real Cron ticks (wall-clock only)
[ ] Verify: claim subjects == canary sha8 only · INSERT≤1 · duplicate=0 · outsider N/A or pending
```

### 5.11 Expand or rollback

```text
[ ] PASS canary → keep gate ON only for approved expand review OR emergency_disable + pause
[ ] FAIL any stop condition → §6 Rollback immediately
```

### 5.12 Final status

```text
[ ] Gate/flags/runtime match intended end state (usually: pause or disable after canary)
[ ] Provider talk_local unless explicitly approved otherwise (default stay talk_local + scoped flags)
[ ] No Production SMS/email/Push added
```

---

## 6. Rollback runbook (DOC ONLY)

**Order (forced):**

1. **Runtime pause** (`ANPI_PRODUCTION_RUNTIME_ENABLED=false` + deploy)  
2. **`emergency_disable`** on Production allowlist gate  
3. Scoped flags **OFF** + deploy  
4. Cron stop (clear crons) if needed  
5. Provider confirm `talk_local`  
6. Worker `wrangler rollback` to last known-good if code suspect  
7. Stuck lease: release/fail via existing Phase 6 reclaim / lease finish patterns (service_role)  
8. Jobs `processing`: fail/cancel with `error_safe` code `anpi_prod_rollback` — do not invent silent `sent`  
9. Notification cleanup:
   - **May delete** only rows with explicit canary `source=anpi_prod_canary` and known canary notification ids · with owner approval  
   - **Must not delete** ordinary user notifications / non-canary sources  
10. Rollback complete when: runtime paused or stub-only · gate false · flags OFF · in-flight 0 · canary markers handled per policy · alert clear

---

## 7. Monitoring / alerts

| Signal | Suggest threshold | Action |
|--------|-------------------|--------|
| Cron missed tick | No lease in >2 intervals | Page ops · pause if writing |
| Lease not released | `finished_at` null > TTL | Investigate · pause |
| Duplicate inbox id/source | count>1 same logical key | **Stop** · rollback |
| Allowlist-out claim | subject sha8 ∉ allowlist | **Stop** · emergency_disable |
| Allowlist-out INSERT | source canary but wrong user | **Stop** |
| Writer error | error_safe / log error_code spike | Pause |
| Provider non-local | provider not talk_local* | **Stop** |
| Backlog pending growth | pending talk jobs >> baseline | Investigate |
| Gate/flags unintended ON | drift vs desired | Pause · correct |
| Project ref mismatch | staging URL in prod worker | **Stop** |
| Emergency disable fired | audit | Confirm intentional |

**Logs:** Worker JSON (`service=anpi-scheduler`) · `anpi_scheduler_runs` · no bodies/PII/raw UUIDs.  
**Retention:** ≥30 days Cloudflare logs · ≥90 days lease rows (or per company policy).

---

## 8. Go / No-Go checklist

### Must be YES for any Production canary resume

| # | Item | Status now |
|---|------|------------|
| G1 | Production migrations READY (4–10 + prod allowlist package) | **NO** |
| G2 | RLS / grants READY | **NO** (verify) |
| G3 | Identity mapping READY for canary | **NO** (human select) |
| G4 | Canary identity approved (sha8 on record) | **NO** |
| G5 | Stable idempotency `anpi:prod:v1` implemented & tested | **NO** (design only) |
| G6 | Runtime pause stops legacy+scoped | **Design YES** · Prod Worker **NO** |
| G7 | Rollback dry review PASS (tabletop) | **PENDING** |
| G8 | Production secrets prepared (not Staging) | **NO** |
| G9 | Worker/Cron config reviewed | **NO** |
| G10 | Ops understands pause→change→deploy→gate→resume→observe | **PENDING sign-off** |
| G11 | Explicit Production cutover approval recorded | **NO** |
| G12 | PRs #20/#21 (soak evidence) merged or superseded | **NO** (OPEN) |
| G13 | No SMS/phone/email/Push/Realtime scope creep | **YES** (policy) |

**Aggregate:** **NO-GO** for `ANPI_PRODUCTION_CUTOVER`.

---

## 9. Readiness judgments (split)

| Judgment | Verdict | Why |
|----------|---------|-----|
| `ANPI_PRODUCTION_CUTOVER_PLAN` | **READY** | This document + runbooks + pause order + Phase 63 race incorporated |
| `ANPI_PRODUCTION_DB_READINESS` | **NOT READY** | Prod apply inventory incomplete · Phase 62 not a Prod migration · Phase 10 still hard-disabled |
| `ANPI_PRODUCTION_WORKER_READINESS` | **NOT READY** | No Production Worker/Cron/Secrets |
| `ANPI_PRODUCTION_NOTIFICATION_READINESS` | **NOT READY** | Canary identity + prod idempotency prefix + prod source marker not implemented/approved |
| `ANPI_PRODUCTION_OPS_READINESS` | **PARTIAL** | Plan READY · human tabletop + merge hygiene pending |
| `ANPI_PRODUCTION_CUTOVER` | **NO-GO** | Waiting explicit approval after G1–G12 |

---

## 10. Production vs Staging delta (summary)

| Topic | Staging | Production needed |
|-------|---------|-------------------|
| Worker | `anpi-staging-scheduler` | New Production Worker |
| Secrets | `ANPI_STAGING_*` | `ANPI_PRODUCTION_*` |
| Allowlist SQL | Phase 62 draft applied | Reviewed Prod migration |
| Key prefix | `anpi:p61:v1` | `anpi:prod:v1` |
| source marker | `anpi_phase61_test` | `anpi_prod_canary` |
| Allowlist sha8 | `{0411f04d}` | **Different** human-approved canary |
| Runtime pause | `ANPI_STAGING_RUNTIME_ENABLED` | Prod equivalent · **mandatory before flag flips** |
| Phase 17 gate | Staging probe only | **Do not** port as Prod cutover control |

---

## 11. Human actions at approval time (execution list)

When a human explicitly approves Production cutover, they (not this agent) will:

1. Merge soak PRs / freeze branch  
2. Select & approve canary sha8  
3. Apply DB package on Production (Dashboard/CLI · not MCP)  
4. Create Production Worker + secrets + cron  
5. Execute §5 runbook including **runtime pause first**  
6. Observe 1–3 wall-clock ticks  
7. Either expand (new approval) or rollback (§6)

---

## 12. Remaining blockers

1. Production DB inventory & reviewed migration package (incl. parallel allowlisted claim)  
2. Production Worker + secrets + cron (net-new)  
3. Canary identity human selection  
4. Implement `anpi:prod:v1` writer path (code) behind flags — not done in Phase 64  
5. Merge #20/#21 (or equivalent) for evidence continuity  
6. Ops tabletop sign-off on pause/rollback  
7. **Explicit Production cutover approval**

---

## 13. Related docs

- [`docs/anpi-phase63-wall-clock-scoped-cron-soak.md`](./anpi-phase63-wall-clock-scoped-cron-soak.md)  
- [`docs/anpi-phase62-scoped-cron-soak.md`](./anpi-phase62-scoped-cron-soak.md)  
- [`docs/anpi-talk-notification-provider.md`](./anpi-talk-notification-provider.md)  
- [`docs/anpi-cloudflare-scheduler-ops.md`](./anpi-cloudflare-scheduler-ops.md)  
- [`reports/anpi-phase64-production-cutover-readiness.json`](../reports/anpi-phase64-production-cutover-readiness.json)

```text
PRODUCTION_CUTOVER_EXECUTED: false
NEXT: human approval after blockers cleared
```
