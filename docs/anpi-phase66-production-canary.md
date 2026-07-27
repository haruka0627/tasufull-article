# ANPI Phase 66 — Production Canary Completion

**Date:** 2026-07-27  
**Production operations executed:** **false** (migration / deploy / Secrets / Cron enable / gate enable / canary / wall-clock / emergency: **not run**)  
**Canary identity selected:** **false**

```text
ANPI_PHASE66_STATUS: STOPPED_WAITING_HUMAN
ANPI_PHASE66A_READONLY_AUDIT: PASS (human Dashboard · no SQL errors)
ANPI_PRODUCTION_CANARY: NOT_STARTED
ANPI_PRODUCTION_CUTOVER: NO-GO
STOP_REASON: production_missing_anpi_scheduler_jobs · phase4_10_prereq_required · phase65_draft_blocked · canary_identity_unspecified · secrets_unregistered · explicit_approval_missing
```

---

## Executive verdict

Phase 66 **cannot** proceed to 66-B (Phase 65 allowlist apply) or Canary PASS.

Human Production read-only audit **completed** and confirmed a **blocking schema gap**:

| Finding | Evidence |
|---------|----------|
| `public.anpi_scheduler_jobs` | **does not exist** (`relation_exists=false`) |
| pending / processing / leased_active | **NULL** (Section 9) |
| SQL errors | **none** |

Phase 65 Prod allowlist draft **must not** be applied until Phase 4–10 scheduler foundations exist on Production (draft `RETURNS SETOF public.anpi_scheduler_jobs`).

Stop conditions:

| Stop condition | Hit? |
|----------------|------|
| Unexpected Production delta | **YES** — scheduler jobs relation missing |
| Phase 65 draft apply | **BLOCKED** |
| Secret / canary / cutover approval | Still required later |

**No** Production migration, Worker deploy, Secrets put, Cron enable, gate enable, notification, or canary registration was performed.

---

## 1. Production Read-only Audit (66-A)

### 1.1 Agent-performed (anon only · ref `ddojquacsyqesrjhcvmn`)

| Object | Anon REST |
|--------|-----------|
| `anpi_check_sessions` | **200** (exists · empty under anon RLS) |
| `anpi_notification_logs` | **200** |
| `anpi_user_contexts` | **200** |
| `anpi_scheduler_jobs` / `runs` | **404** PGRST205 |
| `anpi_phase6_claim_jobs` RPC | **404** PGRST202 |
| `anpi_prod_*` / `anpi_phase62_*` | **404** |
| OpenAPI | **401** |

### 1.2 Human Dashboard audit — **COMPLETED**

- Script: [`sql/anpi-phase66-production-readonly-audit.sql`](../sql/anpi-phase66-production-readonly-audit.sql) (dynamic Section 3/9 · `ccd623d`)
- Result: **PASS** (no SQL errors)
- Section 9 final row (reported):

| Column | Value |
|--------|-------|
| `relation_exists` | **false** |
| `pending` | NULL |
| `processing` | NULL |
| `leased_active` | NULL |

**Interpretation (locked):** Production is missing `public.anpi_scheduler_jobs`. This is a real absence (not merely anon/RLS hide). Older ANPI tables may still exist; Phase 4–10 scheduler path is **not** Production-ready.

### 1.3 Staging vs Production (live)

| Item | Staging (known) | Production (live) |
|------|-----------------|-------------------|
| Phase 4–10 `anpi_scheduler_jobs` | Present | **MISSING** (Section 9) |
| Phase 62 gate | Present | Expected **absent** |
| Phase 65 `anpi_prod_*` | N/A | Expected **absent** · **do not apply yet** |
| Staging sha8 `0411f04d` | Allowed in staging gate | Must **never** enter Prod allowlist |

---

## 2. Migration (66-B) — NOT APPLIED · **BLOCKED**

**Do not apply** [`sql/anpi-phase65-production-claim-allowlist-draft.sql`](../sql/anpi-phase65-production-claim-allowlist-draft.sql) on Production until prerequisites exist.

Required before 66-B:

1. Human-approved **Phase 4–10** (or equivalent) Production prerequisite apply plan  
2. Re-run read-only audit → Section 9 `relation_exists=true`  
3. Confirm legacy claim RPC / related objects present  
4. Explicit approval to apply Phase 65 Prod allowlist draft  

Rollback draft (unchanged): [`sql/anpi-phase65-production-claim-allowlist-rollback.sql`](../sql/anpi-phase65-production-claim-allowlist-rollback.sql)

---

## 3. Rollback verify — NOT RUN

No apply → no rollback verify.

---

## 4. Worker deploy (66-C) — NOT DEPLOYED

Code prep only:

- Production adapter: `scripts/lib/anpi-phase66-production-cloudflare-scheduler-adapter.mjs`
- Worker entry wired (runtime default **false**): `deploy/cloudflare/workers/anpi-production-scheduler/`

### Secrets names (values **not** requested / not present as `ANPI_PRODUCTION_*`)

1. `ANPI_PRODUCTION_SUPABASE_URL`  
2. `ANPI_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY`  
3. `ANPI_DIAGNOSTIC_TOKEN`

Local `.env` has Production **anon** only. Staging `.env.staging` has Staging **service_role** only. **No** Production service_role available to the agent.

---

## 5. Cron (66-D) — NOT CONNECTED / NOT ENABLED

`wrangler.toml` still lists `*/5 * * * *` as draft. Runtime vars remain OFF. No `wrangler deploy` / secret put / cron register in this session.

---

## 6. Runtime pause verify — unit only

Production adapter **refuses** `ANPI_ALLOW_LEGACY_CLAIM=true`.  
Claim mode with runtime ON + scoped OFF + legacy OFF → `none` (Phase 63 race mitigation).

No Production live pause drill.

---

## 7–9. Canary / Wall-clock / Emergency — NOT STARTED

Template (do not apply with placeholder):

- [`sql/anpi-phase66-canary-allowlist-template.sql`](../sql/anpi-phase66-canary-allowlist-template.sql)

**Human must provide exactly one** canary `auth_sha8` (8 hex · not `0411f04d`).

---

## 10. Production Canary judgment

**NOT STARTED · NO-GO**

---

## 11. Remaining blockers (human)

1. **DONE:** Production read-only audit (66-A PASS)  
2. **NEXT:** Approve & apply Phase 4–10 Production prerequisites (separate controlled plan)  
3. Re-run audit until Section 9 `relation_exists=true`  
4. Then approve Phase 65 Prod allowlist draft apply (66-B)  
5. Register Cloudflare Secrets (names above)  
6. Explicit approve Worker deploy (paused)  
7. Select **one** canary sha8  
8. Explicit approve 66-F order (pause → … → limited resume → observe)  
9. Wall-clock observe + emergency drill + Canary PASS sign-off  

---

## 12. Go / No-Go

| Gate | Status |
|------|--------|
| Plan (Phase 64) | READY |
| 66-A read-only audit | **PASS** |
| DB readiness | **NOT READY** (`anpi_scheduler_jobs` missing) |
| Worker readiness | PARTIAL (code wired · not deployed) |
| Notification readiness | PARTIAL (`anpi:prod:v1` unit · no Prod write) |
| Ops readiness | PARTIAL |
| **Production Canary** | **NO-GO / WAITING_PREREQ** |
| Full Production launch | **FORBIDDEN** this phase |

---

## 13–14. Commit / PR

See PR opened from branch `anpi/phase66-production-canary`.

### Tests

```bash
node scripts/test-anpi-phase66-production-canary-prep.mjs
node scripts/test-anpi-phase65-prod-readiness.mjs
node scripts/test-anpi-phase56-cloudflare-scheduler.mjs
```

### Forced resume order (when human unlocks)

1. runtime pause  
2. in-flight = 0  
3. config verify  
4. deploy  
5. health verify  
6. gate enable (single canary)  
7. limited resume  
8. observe 1–3 wall-clock ticks  
9. emergency disable / pause / rollback drill  
