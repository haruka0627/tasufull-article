# ANPI Phase 16 — Real INSERT Enablement Checklist (updated Phase 17)

> Historical phase result. Superseded by Phase 18 for current operational status. Do not use as current operational status.

**Environment:** staging `ahlxuyvhzqdqaojiywmu` only  
**First delivery mode:** polling / SELECT only · Realtime KEEP_DISABLED  
**Rule:** any FAIL / BLOCKED / NOT_TESTED for **first polling insert** ⇒ Real INSERT **NO-GO**

Status: `PASS` · `FAIL` · `BLOCKED` · `NOT_APPLICABLE` · `NOT_TESTED`

---

## Database

| ID | Item | Status | Evidence |
| --- | --- | --- | --- |
| DB-01 | identity mapping schema exists | PASS | `anpi_user_contexts` |
| DB-02 | resolver exists | PASS | `anpi_resolve_talk_user_id` |
| DB-03 | mapping rows approved_phase15 | PASS | 4 |
| DB-04 | no duplicate auth_user_id | PASS | |
| DB-05 | no duplicate talk_user_id | PASS | |
| DB-06 | authenticated INSERT=false | PASS | |
| DB-07 | anon SELECT/INSERT=false | PASS | |
| DB-08 | writer = service_role path | PASS | Phase17 wrapper |
| DB-09 | RLS enabled | PASS | |
| DB-10 | reader/writer claim parity | PASS | mismatches=0 |
| DB-11 | target mapping exists for planned test user | PASS | sha8 `0411f04d` bound |
| DB-12 | target user not disabled/revoked | PASS | banned/deleted=false |
| DB-13 | notification schema matches contract | PASS | |
| DB-14 | rollback SQL present | PASS | phase12–17 |
| DB-15 | purge function present | PASS | Phase16 |
| DB-16 | purge EXECUTE service_role only | PASS | |
| DB-17 | Phase17 writer wrapper present | PASS | READY_WITH_SAFE_WRAPPER |
| DB-18 | Phase17 cleanup guard present | PASS | |

## Realtime (first insert = polling)

| ID | Item | Status | Evidence |
| --- | --- | --- | --- |
| RT-01 | publication exists | PASS | |
| RT-02 | talk_notifications registration | PASS | absent · KEEP_DISABLED |
| RT-03 | publication unchanged | PASS | |
| RT-04 | RLS subscription boundary | PASS | |
| RT-05 | event scope INSERT-only | NOT_APPLICABLE | Realtime unused for first insert |
| RT-06 | channel filter talk_user_id | NOT_APPLICABLE | Realtime unused |
| RT-07 | unsubscribe / cleanup | NOT_APPLICABLE | |
| RT-08 | reconnect behavior | NOT_APPLICABLE | |
| RT-09 | duplicate event handling | NOT_APPLICABLE | |
| RT-10 | polling fallback | PASS | primary path for Phase18 |
| RT-11 | Realtime enablement approved | NOT_APPLICABLE | KEEP_DISABLED for first insert |
| RT-12 | replica identity DEFAULT OK | PASS | |
| RT-13 | Realtime remains disabled | PASS | realtime_reg=0 |

## Retention

| ID | Item | Status | Evidence |
| --- | --- | --- | --- |
| RE-01 | retention periods decided | PASS | |
| RE-02 | purge conditions decided | PASS | |
| RE-03 | hold protection | PASS | |
| RE-04 | retry protection | PASS | |
| RE-05 | batch purge local PASS | PASS | |
| RE-06 | purge privilege limited | PASS | |
| RE-07 | index confirmed | PASS | |
| RE-08 | scheduler mode decided | PASS | manual/disabled |
| RE-09 | scheduler enabled | NOT_APPLICABLE | not required for first insert |
| RE-10 | rollback confirmed | PASS | |

## Application

| ID | Item | Status | Evidence |
| --- | --- | --- | --- |
| AP-01 | writer uses canonical TALK id | PASS | resolver + gate talk_user_id |
| AP-02 | auth UID not written when claim exists | PASS | |
| AP-03 | reader/writer same namespace | PASS | |
| AP-04 | duplicate INSERT / PK conflict | PASS | ON CONFLICT DO NOTHING + already_seen |
| AP-05 | idempotency key | PASS | `anpi-phase17-first-insert-v1` → stable id |
| AP-06 | notification type allowlist | PASS | type=`anpi` only |
| AP-07 | payload schema validation | PASS | fixed title/body/`#` |
| AP-08 | payload size limit | PASS | title+body ≤500 |
| AP-09 | client unknown type handling | PASS | |
| AP-10 | read marking privileges | PASS | |
| AP-11 | error handling | PASS | reason_code returns |
| AP-12 | audit log | PASS | gate last_notification_id + reason_code |
| AP-13 | telemetry | NOT_APPLICABLE | out of scope for 1-row staging probe |
| AP-14 | feature flag for real send | PASS | `anpi_phase17_insert_gate.enabled` default OFF |
| AP-15 | emergency disable path | PASS | `anpi_phase17_emergency_disable()` |

## Operations

| ID | Item | Status | Evidence |
| --- | --- | --- | --- |
| OP-01 | staging only | PASS | |
| OP-02 | production connection forbidden | PASS | |
| OP-03 | test user limited | PASS | single bound target |
| OP-04 | test notification type limited | PASS | `anpi` + source marker |
| OP-05 | test payload non-sensitive | PASS | fixed strings |
| OP-06 | cleanup procedure | PASS | cleanup SQL |
| OP-07 | rollback owner | PASS | documented · service_role ops |
| OP-08 | incident stop procedure | PASS | emergency disable runbook |
| OP-09 | Push disabled | PASS | |
| OP-10 | no external send | PASS | |
| OP-11 | execution time/owner recorded | PASS | Phase17 report + Phase18 runbook slot |
| OP-12 | post-run audit items | PASS | checklist in Phase17 doc |

---

## Phase 16 automation NOT_TESTED:5 → Phase 17 closure

| Item (enablement script) | Phase 16 | Phase 17 | Evidence |
| --- | --- | --- | --- |
| realtime.enablement_approved | NOT_TESTED | **NOT_APPLICABLE** | polling-first |
| realtime.client_event_scope_insert_only | NOT_TESTED | **NOT_APPLICABLE** | Realtime unused |
| app.feature_flag_real_insert | NOT_TESTED | **PASS** | gate default OFF |
| app.emergency_disable_path | NOT_TESTED | **PASS** | emergency_disable() |
| retention.scheduler_enabled | NOT_TESTED | **NOT_APPLICABLE** | not required for first insert |

## Summary (first polling insert gate)

```text
PASS: 48
FAIL: 0
BLOCKED: 0
NOT_APPLICABLE: 8
NOT_TESTED: 0
FINAL for Phase17 readiness: GO_FOR_PHASE18 (insert still forbidden until Phase 18)
```

Notes on counts: checklist expanded with DB-17/18 · RT-13 and closed prior NOT_TESTED via PASS or NOT_APPLICABLE. Realtime is **not** a P1 blocker for the first polling insert.
