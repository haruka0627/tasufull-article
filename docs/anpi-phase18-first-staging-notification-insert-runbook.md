# ANPI Phase 18 — First Staging Notification INSERT Runbook

**Historical staging verification** (Phase 18 executed · test row cleaned · flag returned OFF).  
**DO NOT RE-RUN WITHOUT A NEW EXPLICIT AUTHORIZATION**  
**STAGING ONLY · DO NOT APPLY TO PRODUCTION**  
**Environment:** staging only (`ahlxuyvhzqdqaojiywmu`)  
**Production:** prohibited (`ddojquacsyqesrjhcvmn`)  
**Realtime / Push / email / SMS / webhook:** off  
**Commit / push / deploy:** not part of this runbook

## Preconditions

1. Phase 17 PASS · `FINAL: GO_FOR_PHASE18`
2. Linked project ref = `ahlxuyvhzqdqaojiywmu`
3. Mapping rows = 4 · identity mismatches = 0
4. Target inbox = 0 · test marker rows = 0 · flag = OFF
5. Writer = `READY_WITH_SAFE_WRAPPER`

```bash
node scripts/verify-anpi-phase17-first-insert-readiness.mjs
```

STOP if any preflight unexpected state.

## Fixed flow

```text
staging confirm
→ preflight (Phase 17 verifier)
→ enable_flag
→ dry-run insert(true)
→ Real INSERT insert(false)  # once
→ DB + polling verify
→ second insert(false)       # idempotency only
→ cleanup dry-run
→ cleanup(false)             # once
→ emergency_disable
→ safe probe dry-run         # expect flag_off
→ final audit
```

## Commands (service_role / linked CLI)

```sql
-- 18-E
select * from public.anpi_phase17_enable_flag();

-- 18-F
select * from public.anpi_phase17_insert_first_test_notification(true);

-- 18-G (once)
select * from public.anpi_phase17_insert_first_test_notification(false);

-- 18-I
select * from public.anpi_phase17_polling_reader_dry_run();

-- 18-J (idempotency; once)
select * from public.anpi_phase17_insert_first_test_notification(false);

-- 18-K / 18-L
select * from public.anpi_phase17_cleanup_first_test_notification(true);
select * from public.anpi_phase17_cleanup_first_test_notification(false);

-- 18-M
select * from public.anpi_phase17_emergency_disable();
select * from public.anpi_phase17_insert_first_test_notification(true); -- probe only
```

## Absolute limits

| Constraint | Limit |
| --- | --- |
| New INSERT rows | max 1 |
| Live writer calls | max 2 (insert + idempotency) |
| Recipients | bound Phase 17 test user only |
| Cleanup | id + source + type (never user_id/type/time alone) |

## Expected reason codes

| Step | reason_code |
| --- | --- |
| Dry-run | `anpi_phase17_dry_run_would_insert` |
| First live | `anpi_phase17_inserted` |
| Second live | `anpi_phase17_already_seen` |
| Cleanup dry | `anpi_phase17_cleanup_dry_run` |
| Cleanup live | `anpi_phase17_cleanup_deleted` |
| Probe after disable | `anpi_phase17_flag_off` |

## Test contract (unchanged from Phase 17)

```text
type: anpi
source: anpi_phase17_test
title: ANPI Phase17 staging test
body: Non-sensitive readiness probe. Safe to delete.
target_url: #
idempotency_key: anpi-phase17-first-insert-v1
```

## Failure recovery (summary)

| Case | Action |
| --- | --- |
| Timeout / unknown INSERT | search marker; do not re-run writer immediately |
| Wrong user | emergency_disable → isolate by marker → guarded cleanup |
| Duplicate (>1) | emergency_disable → no auto cleanup → human recovery SQL |
| Polling invisible | do not delete; audit identity/RLS/resolver |
| Cleanup fail | emergency_disable → no broad DELETE |

## Post-state verify

```bash
node scripts/verify-anpi-phase18-first-insert.mjs
```

Expect: inbox 0 · markers 0 · flag OFF · maps 4 · realtime 0 · probe `flag_off`.

## Notes

- Cleanup decrements `inserted_count`, so `remaining_allowance` may return to 1 after cleanup. Gate stays closed because `enabled=false`.
- Never call live INSERT (`dry_run=false`) only to prove OFF.
- Do not store raw UUID / JWT / service-role key in git artifacts.
