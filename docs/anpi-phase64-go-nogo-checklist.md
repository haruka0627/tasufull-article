# ANPI Phase 64 — Go / No-Go Sign-off Sheet

Print / attach to ops ticket. **No Production execution in Phase 64.**

## Judgments

| ID | Judgment | Verdict |
|----|----------|---------|
| J1 | ANPI_PRODUCTION_CUTOVER_PLAN | READY |
| J2 | ANPI_PRODUCTION_DB_READINESS | NOT READY |
| J3 | ANPI_PRODUCTION_WORKER_READINESS | NOT READY |
| J4 | ANPI_PRODUCTION_NOTIFICATION_READINESS | NOT READY |
| J5 | ANPI_PRODUCTION_OPS_READINESS | PARTIAL |
| J6 | ANPI_PRODUCTION_CUTOVER | NO-GO |

## Gate checklist (all required before canary resume)

| # | Item | Owner | Date | Pass? |
|---|------|-------|------|-------|
| G1 | Production migrations READY | | | ☐ |
| G2 | RLS READY | | | ☐ |
| G3 | Identity mapping READY | | | ☐ |
| G4 | Canary identity approved (sha8 only) | | | ☐ |
| G5 | Stable idempotency `anpi:prod:v1` READY | | | ☐ |
| G6 | Runtime pause READY (legacy+scoped) | | | ☐ |
| G7 | Rollback dry review PASS | | | ☐ |
| G8 | Secrets prepared (Prod ≠ Staging) | | | ☐ |
| G9 | Worker / Cron reviewed | | | ☐ |
| G10 | Ops understands enable/observe/disable | | | ☐ |
| G11 | Explicit Production cutover approval | | | ☐ |
| G12 | Soak PRs #20/#21 merged or superseded | | | ☐ |

## Forced cutover order (acknowledge)

1. ☐ Runtime pause  
2. ☐ Active lease / in-flight = 0  
3. ☐ Configuration / secrets / flags change  
4. ☐ Worker deploy  
5. ☐ Health / provider / project ref  
6. ☐ Scoped gate enable  
7. ☐ Limited runtime resume  
8. ☐ Observe (wall-clock)  
9. ☐ On issue: re-pause → rollback  

## Canary (do not write raw UUID)

| Field | Value |
|-------|--------|
| canary_auth_sha8 | |
| canary_talk_sha16 | |
| Approver | |
| Approved at | |

## Final

```text
ANPI_PRODUCTION_CUTOVER: NO-GO until G1–G12 = PASS and J6 flipped by human
PRODUCTION_CUTOVER_EXECUTED: false
```

SSOT: [`docs/anpi-phase64-production-cutover-plan.md`](./anpi-phase64-production-cutover-plan.md)
