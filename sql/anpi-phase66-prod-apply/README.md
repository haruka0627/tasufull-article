# ANPI Phase 66 — Production Phase 2–10 apply packages

**STATUS:** Runbook artifacts only · **DO NOT APPLY** without per-step human GO  
**TARGET:** `ddojquacsyqesrjhcvmn` only  
**SSOT procedure:** [`docs/anpi-phase66-production-phase2-10-apply-runbook.md`](../../docs/anpi-phase66-production-phase2-10-apply-runbook.md)

## Layout

| Kind | Files |
|------|-------|
| Preflight | `00-preflight-readonly.sql`, `00-legacy-guard-readonly.sql` |
| Apply (full SQL) | `01`…`08`-phase*-APPLY-*.sql |
| Verify | `verify-after-phase{2,3,4,5,6,8,9,10}.sql` |

Out of scope: Phase 65 · Worker · Cron · Canary.
