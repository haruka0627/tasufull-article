# ANPI Phase 17 — First Staging Insert Readiness

> Historical phase result. Superseded by Phase 18 for current operational status. Do not use as current operational status.

**Status:** readiness foundation applied · **Real INSERT not executed** (in Phase 17)  
**Staging only:** `ahlxuyvhzqdqaojiywmu`  
**Production deny:** `ddojquacsyqesrjhcvmn`

## Purpose

Close Phase 16 enablement NOT_TESTED items for a **polling-first** single-row staging insert, and install a safe writer wrapper because Phase 10 job writer RPCs are **not present** on staging.

## Test user (masked)

| Field | Value |
| --- | --- |
| pick | Phase15 approved mapping #3 (created_at order) |
| auth_user_id | `0411f04d…dbdd` (sha8 bind `0411f04d`) |
| talk_user_id | sha16 `88d3dbfacf62520b` · prefix `u_st…` |
| mapping_status | `approved_phase15` |
| inbox | 0 |
| banned/deleted | false |
| writer==mapping | true |

## Writer verdict

```text
Phase 10 anpi_talk_notification_create_internal: NOT_PRESENT
Phase 17 wrapper: READY_WITH_SAFE_WRAPPER
```

Functions:

- `anpi_phase17_insert_first_test_notification(p_dry_run default true)`
- `anpi_phase17_enable_flag()` / `anpi_phase17_emergency_disable()`
- `anpi_phase17_cleanup_first_test_notification(p_dry_run default true)`
- `anpi_phase17_polling_reader_dry_run()`

## Test contract

```text
type: anpi
source: anpi_phase17_test
title: ANPI Phase17 staging test
body: Non-sensitive readiness probe. Safe to delete.
target_url: #
idempotency_key: anpi-phase17-first-insert-v1
id: anpi-p17-||sha256(key)
count: max 1
Realtime/Push/email/SMS/webhook: off
```

## Feature flag

- Table: `anpi_phase17_insert_gate`
- `enabled` default **false**
- Target bound server-side by sha8 (no UUID in git)
- Client cannot toggle
- OFF ⇒ writer returns `anpi_phase17_flag_off`, inserted=0

## Emergency disable

```sql
select * from public.anpi_phase17_emergency_disable();
-- confirm: enabled=false
-- optional: revoke execute on anpi_phase17_insert_first_test_notification from service_role;
```

## Phase 18 apply order (not this Phase)

1. Confirm linked staging
2. `select * from anpi_phase17_insert_first_test_notification(true);` → expect would_insert after enable
3. `select * from anpi_phase17_enable_flag();`
4. `select * from anpi_phase17_insert_first_test_notification(false);` → inserted=1 once
5. Polling SELECT by talk_user_id
6. `anpi_phase17_cleanup_first_test_notification(false)`
7. `anpi_phase17_emergency_disable()`

## Prohibited in Phase 17

- live INSERT (`dry_run=false`)
- Realtime / Push / production
- mapping mutation
- commit / push / deploy
