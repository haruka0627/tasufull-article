# AI Execution Gate — Phase C7 Authoritative Usage Snapshot Read

```text
Status: PASS
Date: 2026-07-28
Branch: cf-pages-deploy
Baseline HEAD (start): 856e83283b034c0ba6e7b5d4558fd66274cced3b (Phase C6)
Provider execute: NOT wired
provider_called: false
recorded_api_cost: 0
executed: false
transmit: false
invocation_decision: denied
invocation_reason: provider_disabled
SAFE write: none
```

## Purpose

Connect Phase C3 Budget Guard to SAFE-06/07 **authoritative usage snapshot read** (read-only). Remove silent `current_usage: 0` on the execute path. Keep Provider / Invocation Gate deny / zero cost.

## Starting state

| Item | Value |
| --- | --- |
| branch | `cf-pages-deploy` |
| HEAD | `856e83283b034c0ba6e7b5d4558fd66274cced3b` |
| staged | 0 |
| tracked dirty | ~582 |
| untracked | ~502 |
| dirty total | ~1084 · untouched |

## Multi-agent usage

| Agent | Mode | Outcome |
| --- | --- | --- |
| A SAFE/Schema/Freeze | read-only | SAFE-07 `ai_cost_ledger_aggregate` is SSOT; no new schema; silent-0 vs fail-closed conflict fixed by C7 |
| B Core | new C7 file only | `ai-exec-gate-c7-usage-snapshot.mjs` |
| C QA/Security | Primary re-verified | Isolation · fail-closed · no SDK · regressions |
| Primary | integrate | repository RPC · executor · tests · evidence · commit |

## Freeze verification

| Topic | Result |
| --- | --- |
| C7 named in Design Freeze? | No — incremental ticket after C6 |
| Period | Design Freeze “Daily actor / env caps” + Gate `budget_day_key` JST + SAFE-07 `p_tz=Asia/Tokyo` |
| Currency | USD (C3 + SAFE-07 default) |
| Hard cap | Code constant `PHASE_C3_HARD_CAP_USD` (not DB) |
| Collision requiring stop? | **NO** (silent-0 was the gap C7 closes; period/isolation grounded in Freeze + Gate + SAFE-07) |

## SAFE-06/07 audit

| Object | Role |
| --- | --- |
| `ai_usage_events` | SAFE-06 raw usage (read via ledger) |
| `ai_cost_ledger_aggregate` | SAFE-07 aggregate RPC (read-only · service_role) |
| `ai_usage_cost_enriched` | alternate enriched view (not required for C7) |
| Gate `sumDayEstimatedAllowed` | **not** used for execute BudgetState (avoids dual ledger) |

## Usage SSOT

- **Used amount:** SAFE-07 aggregate `estimated_cost_sum` for exact `bucket === actor_id`
- **Hard cap:** C3 code constant
- **Projected:** C3 (`estimated=0` while provider disconnected)

## Read architecture

```text
createSafe07UsageSnapshotReader({ rpcAggregate })
  → rpcAiCostLedgerAggregate (repository · parameterized JSON body)
  → buildUsageSnapshotFromAggregate (exact actor bucket · never sum-all)
  → usageSnapshotToBudgetInput → evaluatePhaseC3BudgetGuard
```

Supabase REST `Authorization: Bearer <service_role>` is DB access — **not** a Provider credential / SDK.

## Snapshot model

Allowlisted immutable fields including `recorded_usage_usd`, `reserved_usage_usd=0`, `effective_usage_usd`, period bounds, `source=safe07.ai_cost_ledger_aggregate`, `provider_called=false`, `recorded_api_cost=0`.

## Isolation / period

- Actor: UUID `actor_id` ↔ SAFE `user_id` bucket (non-UUID fail-closed)
- Period: JST day from `budget_day_key` · start inclusive · end exclusive (`+09:00`, no DST)
- Environment: require Gate env allowlist; DB project scopes Staging vs Production
- Never sum all users; ambiguous duplicate buckets fail-closed

## Failure behavior

Read error / invalid scope / currency mismatch / ambiguous → `403 usage_snapshot_unavailable` · **no claim** · queued preserved · **not** treated as usage=0.

Authoritative empty bucket after successful RPC → usage `0` (available).

## Budget integration

Single conversion path → C3 `evaluatePhaseC3BudgetGuard` / `evaluateBudgetDecision`. No reimplemented hard-cap rules in C7. C3 now rejects missing `current_usage` (no silent 0).

## Pipeline integration

```text
… → C7 Usage Read → C3 Budget → C4 Resolve → C5 Boundary → C6 Invocation (denied) → C1 Report → Persist
```

Usage read and budget block are **before claim**.

## Injected usage handling

- Runtime: SAFE-07 reader only
- `budgetUsage` ignored on execute path
- Tests: `usageSnapshotReader` / fixtures · mock RPC returns empty rows for authoritative 0

## Security audit

C7 module (code): no Provider SDK / fetch-to-provider / eval / dynamic import / process.env. Repository uses existing Gate REST helper with parameterized RPC body (no string-concat SQL). Lockfiles unchanged.

## Tests

```text
node --check …/ai-exec-gate-c7-usage-snapshot.mjs → 0
node --check …/ai-exec-gate-executor.mjs → 0
node --check …/ai-exec-gate-repository.mjs → 0
node --check …/ai-exec-gate-c3-budget.mjs → 0
node --check …/ai-exec-gate-policy.mjs → 0
node scripts/test-ai-exec-gate-phase-c7-usage-snapshot-read.mjs → PASS 0
```

## Regression

| Suite | exit |
| --- | --- |
| C7 | 0 PASS |
| C6–C1 | 0 PASS |
| Phase B suite (b1–b6) | 0 PASS (after B4 SAFE RPC mock) |

## Scope audit

C7-related shared modules · policy/events · repository RPC · executor · tickets · evidence · C7 tests/fixtures · necessary regression test updates for UUID actor + SAFE mock / usage reader. No Dashboard / migration / deploy / MCP / Provider SDK / SAFE write.

## Known risks

1. Staging SAFE-06/07 migration apply may still be paused ops-side — live RPC needs existing migrations applied (not a C7 DDL).
2. SAFE feature vocabulary does not yet include Gate ops features — empty daily actor usage is expected until provider usage is recorded.
3. Create-path still uses Gate `sumDayEstimatedAllowed` (preflight) — execute BudgetState uses SAFE only (documented dual-surface; not a second write ledger).
4. Prior findings retained: C4 NoOp stub unused · B4 replay cost omission · C5 deepFreeze in-place · C6 no bypass.
5. `budgetUsage` still accepted in JSDoc for compatibility but ignored — callers must migrate to `usageSnapshotReader` for tests.

## Explicitly not implemented

SAFE writes · reservation · actual/estimated cost write · Provider execute · credentials · retry/circuit · Dashboard · Cron/Worker/Queue · MCP · Migration · Deploy · C8+

## Commit

(filled after commit)
