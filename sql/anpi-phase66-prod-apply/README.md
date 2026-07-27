# ANPI Phase 66 — Production Phase 2–10 apply packages

**STATUS:** Runbook artifacts only · **DO NOT APPLY** without per-step human GO  
**TARGET:** `ddojquacsyqesrjhcvmn` only  
**SSOT procedure:** [`docs/anpi-phase66-production-phase2-10-apply-runbook.md`](../../docs/anpi-phase66-production-phase2-10-apply-runbook.md)

## Layout

| Kind | Files |
|------|-------|
| Preflight splits | `preflight/01`…`05` + `00-legacy-guard-readonly.sql` |
| Preflight index | `00-preflight-readonly.sql` |
| Apply (full SQL) | `01`…`08`-phase*-APPLY-*.sql (**DO NOT RUN without GO**) |
| Phase 2 verify splits | `verify-phase2/01`…`12` |
| Phase 2 verify index | `verify-after-phase2.sql` |
| Later phase verifies | `verify-after-phase{3,4,5,6,8,9,10}.sql` |

Out of scope: Phase 65 · Worker · Cron · Canary.
