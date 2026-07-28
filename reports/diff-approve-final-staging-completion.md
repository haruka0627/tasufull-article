# Diff & Approve — Final Staging Completion / Production-Ready Boundary

## 1. Verdict

```text
PASS_DIFF_APPROVE_STAGING_COMPLETE
```

```text
Final Apply Gate: ENABLED (Staging)
Execution mode: staging_simulation ONLY
Real Provider execution: NOT AVAILABLE
Request status after gate/sim: APPROVED
Automatic retry: NOT CONNECTED
Automatic rollback: NOT CONNECTED
Production: NOT TOUCHED
Push: NOT PERFORMED
```

## 2. Starting state

| Field | Value |
| --- | --- |
| Branch | `cf-pages-deploy` |
| HEAD | `1f598a90bbe83a776ec6b1479064e73a821ac554` |
| Staged | 0 |
| Dirty (approx) | 1169 |
| Diff & Approve dirty at start | none |

## 3. Existing implementation audit

```text
READY_TO_EXTEND
```

Reused: Decision Write · Dry-run Apply Plan · A10 tamper · persistence repository · Staging-only guards · `DIFF_APPROVE_APPLY_ENABLED=false`.  
Status model: keep proposal at `approved`; gate/simulation as side records (no `apply_ready` proposal status).  
Disconnected: A4 commitApply · A6 performFinalApply · `/apply` routes · Provider adapters.

## 4. Final Apply Gate design

Manual gate after latest dry-run plan.

- Input: `requestId`, `expectedVersion`, `idempotencyKey`, `planId`, `planFingerprint`, `confirmationPhrase=CONFIRM_STAGING_APPLY_GATE`
- Server validates: staging · approved · version · plan ready · fingerprint match · recompute freshness · audit chain · approval · capability/budget · no prior apply · no active execution · manual phrase
- Outcome: `apply_ready` \| `blocked` (gate record) — proposal stays `approved`
- Codes: `STALE_PLAN`, `FINGERPRINT_MISMATCH`, `VERSION_CONFLICT`, `TAMPER`/`AUDIT_INVALID`, `ALREADY_APPLIED`, `EXECUTION_IN_PROGRESS`, `CAPABILITY_BLOCKED`, `BUDGET_BLOCKED`, `APPROVAL_MISSING`, `ENVIRONMENT_BLOCKED`, `PLAN_MISSING`, `PLAN_BLOCKED`, `INVALID_CONFIRMATION`

## 5. Execution boundary

```text
validate → createExecutionAttempt(staging_simulation) → noop provider → record result → audit → stop
```

Provider adapter: **noop only**. Real HTTP / payment / message / file / account mutation: **forbidden**.  
`realExecutionAvailable=false` always.

## 6. Persistence / migration

Migration: `supabase/migrations/20260728200000_ai_diff_approve_staging_final_gate_simulation.sql`

| Object | Role |
| --- | --- |
| `ai_diff_approve_apply_gates` | Gate snapshots (`apply_ready`/`blocked`) |
| `ai_diff_approve_execution_attempts` | Simulation attempts (`staging_simulation`) |
| `ai_diff_approve_confirm_apply_gate` | SECURITY DEFINER RPC |
| `ai_diff_approve_simulate_execution` | SECURITY DEFINER RPC |

Statuses for attempts: `prepared` \| `simulated` \| `failed` \| `blocked` \| `cancelled` (no `succeeded`).

## 7. API

| Route | Methods |
| --- | --- |
| `/api/ai-diff-approve/:id/apply-gate` | POST confirm · GET list |
| `/api/ai-diff-approve/:id/simulate-execution` | POST simulate · GET attempts |

Forbidden: `/apply`, `/execute`, `/run` (non-sim).

## 8. Operator UI

`/admin-diff-approve` badges: STAGING · APPROVED · DECISION WRITE · DRY RUN · APPLY READY · SIMULATION ONLY · NO PROVIDER EXECUTION · NO APPLY.

Controls: Generate Dry-run Plan · Confirm Final Apply Gate (phrase) · Run Staging Simulation.  
No Apply / Execute / Production / Provider Execute / auto retry / auto rollback buttons.

## 9. Audit events

`apply_gate_confirmed` · `apply_gate_blocked` · `execution_simulation_succeeded` · `execution_simulation_failed` (+ metadata: retryable, rollback_available=false, apply/provider false).

## 10. Security

RLS deny-all · service_role SELECT/INSERT only · RPC EXECUTE service_role only · fixed `search_path=public` · Staging environment check · Apply flag hard-deny.

## 11. Tenant isolation

Ops global Staging tenant pattern unchanged; proposal_id scoped reads/writes; cross-proposal plan/gate mismatch rejected.

## 12. Idempotency

Scoped keys `fg:{env}:{actor}:{request}:{op}:{client}` · same payload replay · conflict on mismatch.

## 13. Optimistic concurrency

`expectedVersion` required; RPC `FOR UPDATE` recheck; status must remain `approved`.

## 14. Tamper detection

A10 chain reuse; fingerprint recompute vs stored plan; mismatch → blocked / `STALE_PLAN` / `FINGERPRINT_MISMATCH`.

## 15. Failure / retry

`classifySimulationOutcome`: ok → `simulated`; transient → failed+retryable; permanent → failed+non-retryable.  
`next_attempt_not_scheduled=true` always. No automatic retry.

## 16. Rollback boundary

`rollback_available=false` · `rollback_not_executed=true` · strategy `none` (no provider mutation).

## 17. Unit test results

`scripts/test-diff-approve-staging-final-gate-simulation.mjs` → **24/24 PASS**  
Regression: apply-plan dry-run **30/30** · readonly ops **PASS**

## 18. Playwright results

Final gate playwright **8/8 PASS** · Apply-plan playwright **9/9 PASS** (8788)

## 19. Migration history

`20260728200000` local = remote applied (Staging `ahlxuyvhzqdqaojiywmu`).  
Unrelated local-only `20260718000000` untouched (REQUIRES_MANUAL_REVIEW; not staged).

## 20. Changed files

Contract · service · persistence repo · migration · apply-gate API · simulate-execution API · admin UI (+dist mirror) · tests · report summaries.

## 21. Commit

| Field | Value |
| --- | --- |
| Hash | `418f6bdfd453f81b3812d1d882693c283f947eae` |
| Message | `feat(diff-approve): complete staging apply simulation gate` |
| Files | 17 |
| Unexpected staged | none (`20260718000000` excluded) |

## 22. Remaining dirty

~1169 unrelated paths — not modified/staged (includes untracked Builder Calendar migration).

## 23. Production status

**NOT TOUCHED**

## 24. Push status

**NOT PERFORMED**

## 25. Track 3–9 readiness

Diff & Approve Staging workflow is complete for handoff. Tracks 3–9 (自作MCP · Agentic Cron · Self Correction · 秘書タスク基盤 · 音声 · マルチエージェント · トラフィック解析) were **not started** in this phase.

```text
Production was not touched.
No real provider execution was performed.
No automatic retry was performed.
No automatic rollback was performed.
The local-only Builder Calendar migration was not modified.
No push was performed.
```
