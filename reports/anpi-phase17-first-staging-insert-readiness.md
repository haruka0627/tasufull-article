# ANPI Phase 17 — First Staging Insert Readiness Report

**STAGING TEST ONLY · DO NOT APPLY TO PRODUCTION**

> Historical phase result. Superseded by Phase 18 for current operational status. Do not use as current operational status.


Date: 2026-07-27  
Verdict: **Phase 17 PASS · Phase 18 First INSERT: GO_FOR_PHASE18 · Real INSERT not executed**

## 1. Conclusion

```text
Phase 17: PASS
Phase 18 First INSERT: GO
Realtime: KEEP_DISABLED
Push: NO-GO
Production: NO-GO
```

(GO means Phase 18 may perform **exactly 1** staging INSERT under the Phase17 gate — not that Phase17 inserted.)

## 2. Git state

| Item | Value |
| --- | --- |
| HEAD (start) | `ebf44989c576b69746b12876402be2b731234a70` |
| staged | 0 |
| tracked dirty | pre-existing unrelated tree (untouched) |
| untracked | Phase12–17 ANPI packages |
| commit/push/deploy | **not performed** |

This Phase files: `sql/anpi-phase17-*`, `docs/anpi-phase17-*`, `docs/anpi-phase16-real-insert-enablement-checklist.md`, `reports/anpi-phase17-*`, `scripts/*phase17*`, `reports/_anpi-phase17-readiness/**`

## 3. NOT_TESTED closure (Phase16 automation 5)

| Item | Phase 16 | Phase 17 | Evidence |
| --- | --- | --- | --- |
| realtime.enablement_approved | NOT_TESTED | NOT_APPLICABLE | polling-first |
| realtime.client_event_scope_insert_only | NOT_TESTED | NOT_APPLICABLE | Realtime unused |
| app.feature_flag_real_insert | NOT_TESTED | PASS | gate.enabled default false |
| app.emergency_disable_path | NOT_TESTED | PASS | emergency_disable() |
| retention.scheduler_enabled | NOT_TESTED | NOT_APPLICABLE | not needed for first insert |

Checklist `NOT_TESTED: 0` for first-polling-insert scope.

## 4. Test user

| Field | Value |
| --- | --- |
| mapping | approved_phase15 |
| uniqueness | PASS (unique auth/talk) |
| auth exists | true |
| talk user exists | true |
| inbox | 0 |
| banned/deleted | false |
| auth_user_id | `0411f04d…dbdd` |
| talk_user_id | sha16 `88d3dbfacf62520b` · prefix `u_st…` |
| bind key | sha8 `0411f04d` (in SQL; no raw UUID in git) |

## 5. Writer RPC

| Item | Result |
| --- | --- |
| existence | Phase10 create_internal **NOT_PRESENT**; Phase17 wrapper **PRESENT** |
| security | SECURITY DEFINER · search_path pinned |
| privileges | service_role EXECUTE only · auth/anon false |
| canonical identity | resolver + gate talk_user_id parity |
| validation | fixed payload · type anpi · `#` · size guard · key charset |
| idempotency | stable id from key · ON CONFLICT DO NOTHING · already_seen |
| verdict | **READY_WITH_SAFE_WRAPPER** |

## 6. Polling reader

- Path: SELECT `talk_notifications` where `user_id = talk_user_id` (+ RLS `talk_current_user_id()`)
- Dry-run RPC: `anpi_phase17_polling_reader_dry_run`
- parity: **true**
- inbox_for_target: **0**
- anon_select: **false** · auth_insert: **false**
- realtime_registered: **false**

## 7. Safety controls

```text
Feature flag: OFF (anpi_phase17_insert_gate.enabled=false)
Emergency disable: PASS (executed; remains false)
Realtime: KEEP_DISABLED
Push: NO-GO
External delivery: disabled
```

## 8. Cleanup

- dry-run matched=0 / deleted=0 (`cleanup_none`)
- expected=1 / 0 / >1 guards in function
- unauthorized: no EXECUTE for auth/anon
- rollback SQL drops gate; does not touch Phase15 maps

## 9. Verification

```text
Static: 9 PASS
Local: PASS (flag OFF block · dry-run · insert1 · idempotency · cleanup · emergency · rollback)
Staging: foundation applied · dry-runs only · inbox=0 · maps=4
```

Automated readiness (expected after docs exist):

```text
FINAL: GO_FOR_PHASE18
```

## 10. Phase re-audit

```text
Mapping rows: 4
Identity mismatches: 0
Inbox rows: 0
Authenticated INSERT: false
Anon access: none
Realtime publication: not registered
Push: off
Production: untouched
```

## 11. Artifacts

- `sql/anpi-phase17-first-insert-readiness-foundation.sql`
- `sql/anpi-phase17-first-insert-cleanup.sql`
- `sql/anpi-phase17-first-insert-readiness-rollback.sql`
- `docs/anpi-phase17-first-staging-insert-readiness.md`
- `docs/anpi-phase16-real-insert-enablement-checklist.md` (updated)
- `reports/anpi-phase17-first-staging-insert-readiness.md`
- `scripts/test-anpi-phase17-first-insert-readiness.mjs`
- `scripts/verify-anpi-phase17-first-insert-readiness-local.mjs`
- `scripts/verify-anpi-phase17-first-insert-readiness.mjs`
- `reports/_anpi-phase17-readiness/`

## 12. Remaining blockers before Phase 18 INSERT

1. Human confirm linked project = staging  
2. Run writer dry-run after `enable_flag` (still dry_run=true) → expect `would_insert`  
3. Execute **one** `insert_first_test_notification(false)`  
4. Polling verify 1 row for target talk_user_id  
5. Cleanup(false) → 0 rows  
6. `emergency_disable()`  
7. Do not enable Realtime/Push  

## Recovery matrix (summary)

| Case | Action |
| --- | --- |
| writer success / reader fail | disable flag; cleanup by id; rematch parity |
| timeout but inserted | already_seen on retry; cleanup by deterministic id |
| duplicate 2 | cleanup BLOCK if >1 match; manual review |
| wrong user_id | disable; do not broad-delete; investigate gate bind |
| flag OFF fail | revoke EXECUTE from service_role |
| cleanup 0/ambiguous | stop; no force delete |

## Safety

- Staging Real INSERT: **not executed** (dry-run only; flag OFF)
- Realtime/Push/Production: unchanged / untouched
- Mapping rows: **4 maintained**
- commit/push/deploy: **not performed**
