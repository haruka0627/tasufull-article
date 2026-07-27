# AI Execution Gate — Phase B2 migration notes

**Date:** 2026-07-28  
**Migration:** `supabase/migrations/20260728120000_ai_exec_gate_phase_b2.sql`  
**Status:** Local apply verified · Staging/Production apply **No-Go** (human approval required later)  
**Commit:** selective staging when instructed

## Objects (3 tables)

| Table | Role | service_role | Append-only |
| --- | --- | --- | --- |
| `ai_execution_requests` | Single execution SSOT | SELECT, INSERT, UPDATE | No DELETE grant |
| `ai_execution_events` | Step / transition history | SELECT, INSERT | Triggers forbid UPDATE/DELETE · ON DELETE RESTRICT |
| `ai_execution_results` | Sanitized result 1:1 | SELECT, INSERT, UPDATE | No DELETE grant |

**Not created (final B2 review):** `ai_feature_flags`, `ai_emergency_controls`

### Why config tables were removed

B1 already defines control SSOT via env:

- Feature Flag: `AI_EXEC_GATE_PHASE_B_DAILY_OPS_REPORT`
- Emergency Stop: `AI_EXEC_GATE_EMERGENCY_STOP`

Mutable DB control tables would create a **dual control plane** (DB change alone could look like enable/clear-stop). Phase B keeps:

- **Control:** B1 env only
- **Audit:** `feature_flag_*` / `emergency_stop_*` snapshot columns on `ai_execution_requests`

PLAN may still list five conceptual objects; B2 ships the three audit tables required for execution history. Live flag/stop evaluation remains env until a later phase explicitly moves control SSOT (not B3-ahead dual read).

No `ai_capability_definitions` seed. No SAFE-06/07 alterations. No Gate API/RPC.

## Contract CHECKs (B1-aligned)

- capabilities: `collect_daily_ops`, `generate_ops_report`
- action: `ops_secretary.daily_pending.report_pipeline`
- service: `ops_secretary`
- ports: `ops_collector`, `secretary_deepseek`, `gate_audit_writer`
- blocked reasons: B1 `GATE_BLOCKED_REASONS` incl. `budget_hard_cap`
- `execution_status`: FREEZE §8 set (not pending/allowed/completed as status)
- `preflight_decision`: `allowed` | `blocked` (decision ≠ status)
- `parent_execution_id` CHECK null (Phase B no child executions)
- budget: `estimated_api_cost >= 0`, `recorded_api_cost >= 0` or null, `budget_limit_snapshot` null or `> 0`, `budget_currency = 'USD'`
- no DB default `0.10` (B1 env fallback remains code-side only)
- recorded cost may exceed snapshot (audit row; SAFE-06/07 not enforced by DB trigger)

## Idempotency

- Constraint: `UNIQUE (idempotency_key)` global + length 8–200
- Scope rationale: FREEZE/tickets do not define composite DB scope; Phase B Staging-only + single pipeline makes global UNIQUE the safer default (rejects accidental reuse across actions if B3 emits short/shared keys)
- B3 responsibility: emit fully-qualified keys (env/service/action/day/hash) so distinct actions never collide

## Local verification (2026-07-28)

```text
npx supabase db reset   # local only · rebuilds migrations
# or: drop leftover config tables then re-apply if already partially applied

node scripts/test-ai-exec-gate-phase-b1-constants.mjs
node scripts/test-ai-exec-gate-phase-b2-db.mjs
# → ALL PASSED

node --check scripts/test-ai-exec-gate-phase-b2-db.mjs
```

Live constraint probes (local postgres via `supabase db query --local`):

- invalid capability → CHECK fail
- invalid action / service / port / status / reason → CHECK fail
- duplicate idempotency_key → UNIQUE fail
- event insert OK · duplicate sequence → UNIQUE fail
- event UPDATE/DELETE → `ai_execution_events is append-only`
- request DELETE not granted to service_role
- result insert OK
- RLS enabled on all 3 tables
- anon/authenticated: no table grants
- `ai_feature_flags` / `ai_emergency_controls` absent
- DB cannot enable flag or clear emergency stop (no control tables)

## Rollback / rebuild

- Migration is additive (`create if not exists` / drop policy if exists).
- Clean rebuild: `npx supabase db reset` (destroys local data — operator decision).
- Staging/Production: do not apply without explicit approval.

## Note on service_role defaults

Supabase may grant broader privileges via default privileges on CREATE. Migration therefore:

```sql
revoke all … from … service_role;
grant <minimal> … to service_role;
```

Re-apply this revoke/grant pattern if privileges drift after other tooling.
