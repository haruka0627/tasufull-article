# ANPI Phase 59 — Staging Controlled Real Inbox Write Report

**Date:** 2026-07-27  
**Scope:** Prove staging-only controlled INSERT into `public.talk_notifications`  
**Production deploy / DB / Secrets / Worker / Cron / real user notify:** **NOT PERFORMED**

---

## Verdict

```text
ANPI_STAGING_CONTROLLED_REAL_INBOX_WRITE: PASS
ANPI_PRODUCTION_REAL_INBOX_SEND: NOT READY
ANPI_PERIODIC_CRON_REAL_WRITE: NOT SWITCHED
PHASE10_JOB_WRITER_REAL_MODE: STILL_DISABLED
NEW_ARCHITECTURE_OR_PAID_PROVIDER: NOT REQUIRED
```

---

## Controlled enablement

**Method:** Reuse existing Phase 17 staging gate/writer (fail-closed flag · max 1 · test identity only).  
**Orchestration:** `scripts/verify-anpi-phase59-staging-controlled-write.mjs`  
**Guards:** URL project ref + `SUPABASE_PROJECT_REF` must both equal `ahlxuyvhzqdqaojiywmu`; Production ref refused.

---

## Evidence summary

| Check | Result |
|-------|--------|
| Live INSERT | `anpi_phase17_inserted` · count 0→1 |
| Idempotent re-run | `anpi_phase17_already_seen` · inbox stayed 1 |
| Row shape | `type=anpi` · `target_url=#` · `source=anpi_phase17_test` |
| Owner JWT SELECT | count=1 |
| Other mapped user JWT SELECT | count=0 |
| Anon SELECT | 401 / denied |
| Anon writer RPC | 401 / `42501` |
| Malformed idempotency key | 400 / `22023` |
| Production ref refuse | PASS |
| Cleanup | deleted=1 · remaining=0 · inbox 0 |
| Emergency disable | flag OFF · probe `flag_off` |
| Phase 10 real mode | still `false` |
| Cron provider | still `talk_local*` |

Full JSON: [`reports/anpi-phase59-staging-controlled-write-evidence.json`](./anpi-phase59-staging-controlled-write-evidence.json)

---

## Tests

```text
npm run test:anpi-controlled-write   → PASS (A–D)
npm run verify:anpi-controlled-write → PASS_STAGING_CONTROLLED_WRITE
```

---

## Changes

| Path | Role |
|------|------|
| `scripts/lib/anpi-phase59-staging-controlled-write.mjs` | Guards + REST client helpers |
| `scripts/test-anpi-phase59-staging-controlled-write.mjs` | Unit tests |
| `scripts/verify-anpi-phase59-staging-controlled-write.mjs` | Staging live probe |
| `docs/anpi-phase59-staging-controlled-write.md` | Runbook |
| `docs/anpi-talk-notification-provider.md` | Link Phase 59 status |
| `package.json` | npm scripts |

---

## Production human gates (still)

1. Production migrations / RLS confirmation  
2. Real writer enablement design review (Phase 10 hard-disable lift)  
3. Production Worker / secrets / cron (Phase 57)  
4. Cutover periodic runtime off `talk_local*` only after intentional flags  
5. No SMS / phone / email / Push as core path  

---

## Recommended next Phase

**Phase 60 — Staging Phase 10 job-writer controlled enablement**  
Wire a staging-only flag into `anpi_talk_notification_create_internal` / Phase 10 path (contract catalog titles · sidecar links), still without Cron cutover or Production enablement.
