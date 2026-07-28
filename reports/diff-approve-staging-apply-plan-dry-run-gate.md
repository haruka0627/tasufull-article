# Diff & Approve — Staging Apply Plan / Dry-run Gate

## 1. Verdict

```text
PASS_STAGING_APPLY_PLAN_DRY_RUN_GATE
```

```text
Apply Plan: ENABLED IN STAGING
Mode: DRY RUN ONLY
Request status after plan: APPROVED
Apply: NOT EXECUTED
Provider execute: NOT EXECUTED
Automatic execution: NOT CONNECTED
Production: NOT TOUCHED
```

## 2. Scope

Non-executing Apply Plan generation for approved Diff & Approve requests on Staging only.

## 3. Starting State

| Field | Value |
| --- | --- |
| Branch | `cf-pages-deploy` |
| HEAD | `357efde1ce2b6c23c74ca84979ce83b94294e28d` |
| Prior | Decision Write + history ALIGNED |

## 4. Existing Apply Boundary Audit

```text
SAFE_PLAN_BOUNDARY_WITH_FINDINGS
```

Reusable A1–A11 / Decision Write / A10 / persistence. No Diff&Approve auto-apply path. Status can stay `approved`. Plan vs Apply split: dry-run snapshot only; `performApply` remains forbidden.

## 5. Plan Contract

`ai-diff-approve-ops-apply-plan-contract.mjs` — input allowlist `requestId|expectedVersion|idempotencyKey|mode=dry_run`.

## 6. Deterministic Plan Model

Canonical fingerprint via A10 `hashValue` over env/tenant/request/sourceVersion/hashes/capability/budget/ops/preconditions/warnings/blockers. Excludes timestamps/planId.

## 7. Preconditions

Staging · approved · version match · audit chain · approval present · no prior apply flags · capability present · budget soft-check.

## 8. Warning and Blocker Model

Warnings: large change / high impact / capability outside Phase B allowlist.  
Blockers: INVALID_STATUS, AUDIT_INVALID, ALREADY_EXECUTED, BUDGET_BLOCKED, etc. Client cannot suppress.

## 9. Idempotency

Scoped `ap:{env}:{actor}:{request}:create_apply_plan:{key}` · same payload replay · mismatch → conflict.

## 10. Optimistic Concurrency

`expectedVersion` required; RPC `FOR UPDATE` recheck; status must remain `approved`.

## 11. Tamper Detection

A10 hashes for proposal/approval; audit chain validation; blocked on failure.

## 12. Persistence

Table `ai_diff_approve_apply_plans` · migration `20260728180000_…` · append-oriented · select/insert service_role only.

## 13. RPC / Grants / RLS

`ai_diff_approve_create_apply_plan(jsonb)` · SECURITY DEFINER · search_path=public · EXECUTE service_role only · RLS deny-all.

## 14. Repository Adapter

`persistApplyPlan` · `listApplyPlans` · `getApplyPlan` · `getProposalRow`.

## 15. API

`POST|GET /api/ai-diff-approve/:id/apply-plan` — ops auth · Origin · JSON · no `/apply` endpoint.

## 16. Operator UI

Badges: STAGING · DECISION WRITE · DRY RUN · NO APPLY.  
Control: Generate Dry-run Plan only. No Apply/Execute.

## 17. Audit Timeline

`apply_plan_created` / `apply_plan_blocked` · no audit on replay.

## 18. Apply Isolation

No A4/A6 execute imports · RPC asserts status stays approved · Apply flags false · UI/network forbid Apply.

## 19. Local Tests

```text
node scripts/test-diff-approve-staging-apply-plan-dry-run.mjs
→ PASS_STAGING_APPLY_PLAN_DRY_RUN_LOCAL (30/30)
```

## 20. Staging Migration

Linked `ahlxuyvhzqdqaojiywmu` · `db query -f 180000` · history repair `--status applied` (history-only).

## 21. Staging Verification

Table present · anon EXECUTE false · service_role true · plan live success · status approved · Apply forbidden.

## 22. Playwright E2E

`scripts/test-diff-approve-staging-apply-plan-playwright.mjs` — badges · no Apply · viewports 1280/390.

## 23. Regression

Decision Write path used for fixtures · readonly badge assertion updated for DRY RUN.

## 24. Security Review

Origin reuse · ops JWT actor · secrets not in plan · service_role not in browser.

## 25. Migration History

| Version | Local | Remote |
| --- | --- | --- |
| 140000 | yes | applied |
| 160000 | yes | applied |
| 180000 | yes | applied |

```text
history_alignment: ALIGNED (for decision-write + apply-plan chain)
```

## 26. Files Changed

Contract · service · persistence · migration · API · UI · tests · report · dist mirrors.

## 27. Production Status

NOT TOUCHED · no push.

## 28. Remaining Risks

- Local 8788 may lack persistence flags for live plan UI against list fixtures
- Pre-existing unrelated local-only migrations (e.g. 120000) remain outside this chain
- Phase B capability allowlist treated as warning for Diff Approve domain capability strings

## 29. Final Conclusion

Staging Dry-run Apply Plan Gate is complete. Plans persist and audit; requests remain `approved`; Apply/Provider disconnected; Production untouched.
