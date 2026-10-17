# ANPI Phase 60 — Staging Scheduled Real Write Cutover Readiness

**Date:** 2026-07-27  
**Environment:** staging `ahlxuyvhzqdqaojiywmu` assessment only  
**Production:** untouched

## Verdict

```text
ANPI_STAGING_SCHEDULED_REAL_WRITE_CUTOVER: NOT READY (NO-GO)
CUTOVER_PERFORMED: false
CRON_PROVIDER: talk_local* (unchanged)
```

## Why cutover was not performed

Existing guards **cannot** safely limit Cron real writes to a test identity/schedule:

| Blocker | Detail |
|---------|--------|
| Cron hard-wired stub | Phase 47 → `anpi_phase6_process_claimed_job` → `talk_local_stub` only |
| No identity filter | `anpi_phase6_claim_jobs` claims all due `channel=talk` jobs |
| Provider flip ≠ cutover | `ANPI_NOTIFICATION_PROVIDER=talk_write` is **rejected** by CF/Phase 48 (`anpi_cf_provider_not_talk_local`) |
| Separate probe path | Phase 17/59 inbox INSERT is manual/gated — not on Cron |
| Idempotency risk | Attempt-scoped keys (`anpi:{job_id}:{attempt}`) can duplicate on reclaim if real write were enabled without new dedup |
| Phase 10 | `anpi_talk_real_write_disabled` still hard-disabled |

## Provider switch method (today)

**There is no safe config-only switch.** Cron stays on `talk_local` in `wrangler.toml`.  
Immediate stub rollback (if ever needed after a future code cutover): set `ANPI_NOTIFICATION_PROVIDER=talk_local` + redeploy, or `ANPI_STAGING_RUNTIME_ENABLED=false`, or clear crons.

## Commands

```bash
npm run test:anpi-cron-cutover
npm run verify:anpi-cron-cutover
```

## Next (recommended)

**Phase 61:** Staging-only Phase 10 job-writer enablement **plus** claim identity allowlist **plus** attempt-stable / job-level idempotency — still without Production and without unscoped Cron blast.
