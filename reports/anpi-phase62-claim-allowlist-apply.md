# ANPI Phase 62 — Claim Allowlist SQL Apply Report

**Date:** 2026-07-27  
**SQL file:** `sql/anpi-phase62-claim-allowlist-draft.sql`  
**Target:** staging `ahlxuyvhzqdqaojiywmu` only  
**Production:** **NOT TOUCHED**

---

## Verdict

```text
SQL_APPLY: PASS
GATE_ENABLED: false
CRON_PROVIDER: talk_local*
CRON_SOAK / GATE_ENABLE: NOT PERFORMED — waiting explicit approval
```

---

## Apply result

| Item | Result |
|------|--------|
| Staging project ref | `ahlxuyvhzqdqaojiywmu` |
| Channel | `npx supabase db query --linked` (relinked from accidental Production temp link → staging before apply) |
| gate `enabled` | **false** |
| allowlist | `{0411f04d}` |
| `anpi_phase62_claim_jobs_allowlisted` | present |
| `anpi_phase6_claim_jobs` | present (unchanged) |
| scoped claim while disabled | **0 rows** |
| inbox INSERT | **0** |
| Cron wrangler provider | `talk_local` |
| CF lease recent | present · `error_safe=null` |
| rollback SQL | present · objects exist to drop |

Evidence: [`reports/anpi-phase62-claim-allowlist-apply-evidence.json`](./anpi-phase62-claim-allowlist-apply-evidence.json)

---

## Created objects

- TABLE `anpi_phase62_claim_allowlist_gate`
- FUNCTIONs: validate_sha8_array · gate_biu · enable · emergency_disable · stable_idempotency_key · claim_jobs_allowlisted
- TRIGGER `trg_anpi_phase62_claim_allowlist_gate_biu`

---

## Cron soak prerequisites audit (NOT started)

See [`docs/anpi-phase62-cron-soak-readiness.md`](../docs/anpi-phase62-cron-soak-readiness.md).

**Stopped awaiting:** gate enable + Cron soak explicit approval.

---

## Human gates next

1. Approve scoped writer wiring plan (Worker/runtime → allowlisted claim → Phase 61 writer)  
2. Approve gate enable window + test identity only  
3. Approve limited Cron soak (1–3 ticks) + rollback owner  
4. Do **not** flip `ANPI_NOTIFICATION_PROVIDER` without separate approval  
