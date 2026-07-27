# ANPI Phase 66 — Production backup gate (resume conditions)

**Status:** HOLD supplement · **Phase 2 APPLY FORBIDDEN**  
**Target:** `ddojquacsyqesrjhcvmn`  
**Recorded:** 2026-07-27 (CLI) · plan confirmed Free 2026-07-28  
**Production change SQL:** none

```text
ANPI_P66_BACKUP_GATE: NOT_SATISFIED · PRODUCTION_PLAN_FREE
ANPI_P66_PHASE2_APPLY: FORBIDDEN · SEE docs/anpi-production-migration-hold.md
ANPI_PRODUCTION_MIGRATION: HOLD until Pro + gate PASS + human GO
```

**Human-confirmed:** Production Supabase plan is **Free** (2026-07-28).  
Formal hold: [`anpi-production-migration-hold.md`](./anpi-production-migration-hold.md).

---

## 1. Current Production plan & daily backups

### CLI evidence (last check)

```json
{
  "region": "ap-northeast-1",
  "walg_enabled": true,
  "pitr_enabled": false,
  "backups": [],
  "physical_backup_data": {}
}
```

| Observation | Meaning |
|-------------|---------|
| `backups: []` | **No restoreable physical/daily backup listed via Management API / CLI** |
| `pitr_enabled: false` | PITR add-on **off** |
| `walg_enabled: true` | WAL-G plumbing may exist, but **empty list ≠ usable restore point** |

### Plan (human-confirmed 2026-07-28)

**Production is on the Free plan.** Automatic daily backups are **not** included on Free. This is why `backups: []` and the APPLY stop are expected until Pro.

Human must still verify Billing in Dashboard when resuming:

`https://supabase.com/dashboard/project/ddojquacsyqesrjhcvmn/settings/billing`  
`https://supabase.com/dashboard/project/ddojquacsyqesrjhcvmn/database/backups/scheduled`

| Plan (docs) | Automatic daily backups | PITR |
|-------------|-------------------------|------|
| **Free** | **Not included** — docs recommend CLI `db dump` off-site | Not available |
| **Pro** | Yes · **7 days** retention (Dashboard Scheduled) | Optional paid add-on |
| **Team** | Yes · 14 days | Add-on |
| **Enterprise** | Yes · up to 30 days | Add-on / custom |

**Inference superseded:** plan is **confirmed Free**, not merely inferred.

---

## 2. If upgrading to Pro — when is a restoreable daily backup “ready”?

After Pro is active:

1. Supabase schedules **automatic daily backups**.  
2. Gate is **not** satisfied at the moment of upgrade alone.  
3. Wait until **at least one** restoreable backup is visible:

| Evidence channel | PASS criterion |
|------------------|----------------|
| Dashboard → Database → Backups → **Scheduled** | ≥1 backup with status usable/completed · restore UI available |
| CLI: `npx supabase backups list --project-ref ddojquacsyqesrjhcvmn -o json` | `backups` array length ≥ 1 **or** documented Dashboard screenshot/export recorded by human |

Typical wait: **up to ~24 hours** for the first daily snapshot (exact timing is platform-controlled). Re-check until PASS.

Also confirm: project remains `ACTIVE_HEALTHY` · ref still `ddojquacsyqesrjhcvmn`.

---

## 3. Is PITR mandatory for this runbook?

**No.** For Phase 2–10 Production apply gate:

| Option | Satisfies gate? | Notes |
|--------|-----------------|-------|
| **≥1 restoreable daily/physical backup** (Pro+) | **YES** | Preferred for Production |
| **PITR enabled** with non-empty recovery window | **YES** (alternative / stronger RPO) | Paid add-on · needs Small+ compute · **disables daily backups** while on |
| Neither | **NO** | Current stop reason |

**PITR is recommended for finer RPO, not required** to unblock Phase 2 APPLY under this runbook.

---

## 4. Can CLI logical backup (`db dump`) substitute?

**Yes, as an explicit Free-tier / interim alternative**, per [Supabase backups docs](https://supabase.com/docs/guides/platform/backups): Free projects should regularly `db dump` and keep **off-site** backups.

| Aspect | Assessment |
|--------|------------|
| Substitute for empty platform backups? | **Allowed** if dump is complete, off-repo, and **restore-smoke-tested** |
| Equal to Dashboard daily restore? | **No** — restore path is DIY (local Postgres / new project), not one-click Prod restore |
| Requires DB password? | Usually yes (`--password` or prompt) — **never log / commit** |
| Includes Storage objects? | **No** (same as platform backups) |
| Custom role passwords | Not in dumps for security — reset after restore if needed |

**Preference order for Production ANPI apply:**

1. Pro + ≥1 completed scheduled/physical backup (or PITR window)  
2. Else: verified off-site logical dump (roles + schema + data) with restore smoke test  

---

## 5. Logical dump procedure (read-only toward Production · secrets-safe)

**Do not** run APPLY. Dumps are **read** from Prod.

### 5.1 Prep (human)

1. Confirm ref `ddojquacsyqesrjhcvmn`.  
2. Obtain DB password from Dashboard → Database → Settings (**do not paste into chat / git**).  
3. Choose off-repo directory, e.g. local encrypted disk:  
   `D:\tasful-secrets\anpi-prod-logical-backup\<UTC-date>\`  
4. Ensure directory is in OS ignore / outside the monorepo.

### 5.2 Dump commands (examples — run locally, not committed)

```bash
# Link Prod only for dump session; restore Staging link afterwards
npx supabase link --project-ref ddojquacsyqesrjhcvmn --yes

# Roles only
npx supabase db dump --linked --role-only -f roles.sql

# Schema (public + extensions as needed)
npx supabase db dump --linked --schema public,extensions,auth -f schema.sql

# Data (large — exclude if policy forbids full prod copy offsite)
npx supabase db dump --linked --data-only --use-copy -f data.sql

npx supabase link --project-ref ahlxuyvhzqdqaojiywmu --yes
```

Password: interactive prompt or env var in the **local shell only** (e.g. session-scoped), never written to repo files.

### 5.3 Restore smoke test (not against Production)

1. Start disposable Postgres (Docker) **or** a throwaway Supabase project.  
2. Apply `roles.sql` → `schema.sql` → `data.sql` in order (adjust for auth.users deps as needed).  
3. Confirm: legacy ANPI tables readable · row counts sanity · no dump/restore error.  
4. Destroy the disposable DB.  
5. Record smoke-test PASS in the gate evidence (below) **without** attaching dump files.

### 5.4 What “safe” means here

- Production remains unchanged (dump is SELECT/`pg_dump`).  
- No APPLY.  
- No Worker/Cron/Canary.  
- Dumps never enter `git add` / PR artifacts / chat logs.

---

## 6. Secrets & password handling

| Rule | Detail |
|------|--------|
| Never commit | DB password, service_role, dumps, `.sql` backups, connection strings |
| Never log | Agent/CI must not echo passwords; use prompts or secret stores |
| Never attach dumps to PR | Evidence = checklist JSON/md only |
| Repo `.gitignore` | Ensure `*.dump`, `*-backup/`, local secret dirs ignored if ever created under workspace |
| After dump session | Clear shell history if password was typed; re-link **Staging** |

---

## 7. Gate PASS evidence (clear criteria)

Backup gate is **PASS** when **exactly one** of A/B/C holds, plus checklist D:

### A — Platform daily/physical (preferred)

- [ ] Human confirms plan ≥ Pro (or Team/Enterprise)  
- [ ] Dashboard Scheduled backups shows ≥1 restoreable backup **OR**  
      `supabase backups list -o json` has `backups.length >= 1`  
- [ ] Screenshot or CLI JSON saved under `reports/` (**no secrets**)

### B — PITR

- [ ] `pitr_enabled: true`  
- [ ] Dashboard PITR shows earliest/latest recovery points (non-empty window)  
- [ ] Note: daily backups stop while PITR is on (platform behavior)

### C — Logical off-site substitute

- [ ] `roles.sql` + `schema.sql` (+ `data.sql` if required by human policy) stored **off-repo**  
- [ ] Restore smoke test PASS on disposable target  
- [ ] Human attestation recorded (path location type only, e.g. “encrypted local disk”, not the path with secrets)

### D — Always

- [ ] Project ref `ddojquacsyqesrjhcvmn`  
- [ ] Phase 2 preflight still PASS (collision false · legacy counts unchanged)  
- [ ] **Fresh explicit human GO** for Phase 2 APPLY (backup gate PASS alone is not APPLY permission)

### Gate FAIL / keep APPLY forbidden when

- `backups: []` and PITR off and no attested logical substitute  
- Only `walg_enabled: true` without listed backups  
- Dump exists but restore smoke test not done  
- Secrets leaked into repo/chat

---

## 8. Relation to Phase 2 APPLY

| Item | Status |
|------|--------|
| This document | Investigation + runbook supplement only |
| Phase 2 APPLY | **Still forbidden** until gate PASS **and** new human GO |
| Phase 3–10 / 65 / Worker / Cron / Canary | **Not started** |

When gate PASS + GO arrive, resume at runbook Step 1 using  
`sql/anpi-phase66-prod-apply/01-phase2-APPLY-…sql` once only.

---

## References

- https://supabase.com/docs/guides/platform/backups  
- https://supabase.com/docs/reference/cli/supabase-db-dump  
- Prior stop evidence: `reports/anpi-phase66-phase2-apply/STOP-no-backup-pitr.json`  
- Apply runbook: `docs/anpi-phase66-production-phase2-10-apply-runbook.md`
