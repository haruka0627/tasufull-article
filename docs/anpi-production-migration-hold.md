# ANPI Production Migration — Formal HOLD

**Status:** **ON HOLD** (official)  
**Project ref:** `ddojquacsyqesrjhcvmn`  
**Decided:** 2026-07-28  
**Production plan (human-confirmed):** **Free**

```text
ANPI_PRODUCTION_MIGRATION: HOLD
ANPI_PRODUCTION_SUPABASE_PLAN: FREE
ANPI_P66_BACKUP_GATE: NOT_SATISFIED
ANPI_PHASE2_THROUGH_10_APPLY: FORBIDDEN
ANPI_PHASE65: FORBIDDEN
ANPI_PRODUCTION_WORKER_CRON_CANARY: FORBIDDEN
ANPI_PRODUCTION_SQL_CHANGES: NONE · DO NOT EXECUTE
RESUME: after Supabase Pro + backup gate PASS + fresh human GO
PRIORITY_UNTIL_RESUME: normal product development (non-Prod-ANPI-apply)
```

---

## Decision

Production ANPI apply work is **formally paused**.

Until Supabase Production is moved to **Pro** (or higher) **and** the backup gate is satisfied, do **not** execute:

- Phase 2–10 Production APPLY  
- Phase 65 (`anpi_prod_*` draft)  
- Production Worker deploy  
- Production Cron enable  
- Production Canary / gate enable / notifications  

Prefer **normal development** until the pre-launch Pro timing.

---

## Snapshot at HOLD (evidence)

| Item | State |
|------|--------|
| Phase 66 audit (Sections 1/2/9) | **PASS** |
| Missing migrations | **Identified** · Phase 2→3→4→5→6→8→9→10 |
| Apply runbook | **Ready** · [`anpi-phase66-production-phase2-10-apply-runbook.md`](./anpi-phase66-production-phase2-10-apply-runbook.md) |
| Preflight (Prod SELECT) | **PASS** |
| Phase 2 package review | **GO_WITH_CONDITIONS** |
| Backup gate | **NOT SATISFIED** (Free · `backups: []` · PITR off) |
| Phase 2 APPLY attempt | **STOPPED** · [`reports/anpi-phase66-phase2-apply/STOP-no-backup-pitr.json`](../reports/anpi-phase66-phase2-apply/STOP-no-backup-pitr.json) |
| Production schema/data changes | **None** |

---

## Resume conditions (all required)

1. **Upgrade** Production Supabase to **Pro** (or Team/Enterprise).  
2. **Backup gate PASS** — any one of:  
   - ≥1 restoreable daily/physical backup (Dashboard or `supabase backups list`)  
   - **or** PITR enabled with usable recovery window  
   - **or** approved runbook logical dump + restore smoke test PASS  
   Detail: [`anpi-phase66-production-backup-gate.md`](./anpi-phase66-production-backup-gate.md)  
3. Re-confirm Phase 2 preflight still PASS (collision / legacy counts).  
4. **Fresh explicit human GO** for Phase 2 APPLY only (then one phase at a time per runbook).

Resume entry point:  
[`anpi-phase66-production-phase2-10-apply-runbook.md`](./anpi-phase66-production-phase2-10-apply-runbook.md) Step 1.

---

## Forbidden while ON HOLD

| Action | Status |
|--------|--------|
| Production SQL Editor APPLY / DDL / DML for ANPI migrate | **Forbidden** |
| `supabase db push` / migration apply to Prod | **Forbidden** |
| Phase 65 / Worker / Cron / Canary on Prod | **Forbidden** |
| Selecting canary identity / allowlist expansion | **Forbidden** |

Read-only investigation on Staging remains allowed under existing Staging rules.

---

## Related SSOT

- [`anpi-phase66-production-canary.md`](./anpi-phase66-production-canary.md)  
- [`anpi-phase66-production-missing-migrations.md`](./anpi-phase66-production-missing-migrations.md)  
- [`anpi-phase66-production-backup-gate.md`](./anpi-phase66-production-backup-gate.md)  
- [`anpi-phase65-production-readiness-blockers.md`](./anpi-phase65-production-readiness-blockers.md)  
- [`anpi-phase64-production-cutover-plan.md`](./anpi-phase64-production-cutover-plan.md)
