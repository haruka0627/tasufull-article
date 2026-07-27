# ANPI Phase 62 — Cron Soak Readiness Audit (gate OFF · soak NOT started)

**Date:** 2026-07-27  
**Prerequisite:** Claim allowlist SQL **applied** on staging · `enabled=false`  
**This doc does NOT authorize gate enable or Cron soak.**

---

## Current safe state

| Item | State |
|------|--------|
| SQL objects | Present |
| Gate | **OFF** |
| Cron provider | `talk_local*` |
| Scoped claim | Returns 0 rows while OFF |
| Real inbox via Cron | Disabled |

---

## Required before soak (audit)

### 1. Scoped writer wiring

| Need | Detail |
|------|--------|
| Runtime path | Diagnostic or temporary Worker path that calls `anpi_phase62_claim_jobs_allowlisted` **instead of** `anpi_phase6_claim_jobs` |
| Writer | Phase 61 scoped writer (`anpi.talk.contract.v1` · stable key · `source=anpi_phase61_test` or soak marker) |
| Dual guard | Gate `enabled=true` **and** process env / Worker var for writer enable |
| Must not | Change default Phase 47/48 path globally without flag |
| Must not | Set `ANPI_NOTIFICATION_PROVIDER=talk_write` (still fail-closed / wrong layer) |

**Recommended shape:** feature flag e.g. `ANPI_P62_SCOPED_CRON_PATH=true` on staging Worker only → claim allowlisted → scoped write → lease release / `error_safe`.

### 2. Gate enable plan

```text
precheck: ref=ahlxuyvhzqdqaojiywmu · markers=0 · Cron talk_local
→ select * from anpi_phase62_claim_allowlist_enable();
→ verify enabled=true · allowlist={0411f04d}
→ run 1–3 scoped ticks ONLY (flagged path)
→ emergency_disable() immediately after soak window
→ cleanup soak markers
```

**Do not leave gate enabled overnight without owner.**

### 3. Test identity限定

| Control | Value |
|---------|--------|
| Allowlist | `{0411f04d}` only |
| Preflight | Count pending jobs for non-allowlisted subjects (informational; claim skips them) |
| Writer | Re-check allowlist before INSERT (Phase 61) |
| Max claim limit | ≤5 (SQL already clamps ≤20; soak should pass 1–3) |

### 4. Rollback手順

| Priority | Action |
|----------|--------|
| P0 | `select * from anpi_phase62_claim_allowlist_emergency_disable();` |
| P0 | Clear / disable `ANPI_P62_SCOPED_CRON_PATH` (or stop Worker cron) |
| P1 | Cleanup `talk_notifications` soak markers (id/source scoped) |
| P2 | Optional full drop: `sql/anpi-phase62-claim-allowlist-rollback.sql` |

---

## Explicit stop

```text
GATE_ENABLE: WAITING_EXPLICIT_APPROVAL
CRON_SOAK_START: WAITING_EXPLICIT_APPROVAL
```

No gate enable and no Cron soak in this phase.
