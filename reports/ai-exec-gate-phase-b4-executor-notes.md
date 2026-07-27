# AI Execution Gate — Phase B4 executor notes

**Date:** 2026-07-28  
**HEAD base:** `37f0ec6` (B3)  
**Status:** Final review hardened · selective commit when PASS

## Executor contract

| Item | Value |
| --- | --- |
| Route | `POST /api/ai-exec-gate/execute` |
| Entry | `executeGatePipeline` |
| Auth | ops JWT (`is_ops` / `tasu_admin`) · `actor_id` must match creator (B4; no scheduler expansion) |
| Env | Staging only (B1 detect + row.environment) · Production blocked |
| Input | `{ execution_id }` UUID only |
| Timeout | `PHASE_B4_EXECUTOR_TIMEOUT_MS = 10000` (cooperative between steps; not AbortSignal wall-clock) |

## Claim (atomic)

```text
PATCH ai_execution_requests
WHERE id = :id
  AND execution_status = queued
  AND preflight_decision = allowed
  AND parent_execution_id IS NULL
SET execution_status = running
Prefer: return=representation
```

- Empty representation `[]` → claim fail → `409 execution_already_claimed`
- Never treat GET lookup alone as claim success
- Concurrent execute: exactly one claim / one pipeline / one result / one terminal success event

## Status lifecycle

```text
queued → running → succeeded | failed
```

- `decision` stays `allowed` (never used as status)
- No retry · failed / succeeded terminal
- succeeded → idempotent replay (no re-run · no new events/results)
- blocked / running / failed → refuse execute

## Result 1:1 (insert-only)

- `insertExecutionResult` only — **no PATCH upsert overwrite**
- Existing result → refuse execute (`execution_already_completed`) or race → no overwrite
- `provider_called=false` · `recorded_api_cost=0` (B3 estimate `$0.01` is **not** recorded cost)
- Sanitized summary / bounded metrics only · no arbitrary client payload · no raw errors

## Pipeline (fixed)

1. `ops_collector` / `collect_daily_ops` — empty-safe **deterministic fixture** (not live inbox)
2. `secretary_deepseek` **port name only** / `generate_ops_report` — deterministic template · **no DeepSeek / OpenAI / Gemini / Claude / external HTTP**
3. `gate_audit_writer` — persist `ai_execution_results`

## Events

Success order (names are `*_start` / `*_done` constants):

`executor_claimed` → `execution_started` → `step_collect_*` → `step_report_*` → `result_persisted` → `step_audit_done` → `execution_succeeded`

Failure: `step_*_failed` (when applicable) → `execution_failed`  
Terminal event: one · no success+failure mix · `result_persisted` only after insert

## Failure recovery

| Path | Behavior |
| --- | --- |
| collector / generator / result persist | `running → failed` + failure code + event |
| event persist early | 500 · `audit_incomplete` · failRunning best-effort |
| post-result event fail | keep result · try `succeeded` · never overwrite result |
| `running→failed` transition miss | `console.error` with `execution_id` · `running_orphan_risk` |
| timeout | 504 · failRunning |

## Residual running orphan risk

`failRunning` is best-effort. If status transition fails after claim, structured log retains `execution_id`. Detectable via status=`running` + missing terminal event. No B4 auto-reaper.

## HTTP E2E note

Safe ops JWT not minted in CI. Mock + optional local DB (`SUPABASE_SERVICE_ROLE_KEY`) cover execute. HTTP on `8788`: OPTIONS/405/401/malformed covered by B3 patterns + route method checks; full ops POST path requires existing ops token (not created/stored here).

## Tests

```bash
node scripts/test-ai-exec-gate-phase-b1-constants.mjs
node scripts/test-ai-exec-gate-phase-b2-db.mjs
node scripts/test-ai-exec-gate-phase-b3-api.mjs
node scripts/test-ai-exec-gate-phase-b4-executor.mjs
```

## B5 boundary (do not implement in B4)

Dashboard read of sanitized get/result only. No send UI. No provider enablement. No Cron/Worker/Queue/MCP.

## Out of scope (unchanged)

FREEZE · PLAN · B2 migration · provider connection · live inbox · retry framework
