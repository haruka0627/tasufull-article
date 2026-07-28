# Diff & Approve — Phase A4 Apply Engine

**Verdict:** PASS  
**Date:** 2026-07-28  
**Baseline HEAD (start):** `db542887f794b8fe5915560362db1d92d0d96941`  
**Scope:** Apply path engine · `planned`→`validated` only · no real Apply

---

## Architecture

```text
Approved Proposal
↓
Apply Readiness (A3)
↓
Apply Engine (A4)
↓
Validation + Idempotency
↓
Execution Snapshot (validated)
↓
Persist (concept only)
```

Module: `deploy/cloudflare/functions/_shared/ai-diff-approve-a4-apply-engine.mjs`

---

## Apply Engine

Inputs: approved proposal · ApplyPlan · readiness · Execution Gate result  
Output: `ApplyResult` with `execution_state="validated"`

Always: `applied=false` · `executed=false` · `provider_called=false` · `transmit=false` · `recorded_api_cost=0`

---

## Execution Flow

Vocabulary: `planned` · `validated` · `executed` · `failed` · `rolled_back`  
A4 emits only **`planned` (internal) → `validated` (final)**.  
`executed=true` and production write remain forbidden (`commitApply` → `apply_forbidden`).

---

## Rollback

`RollbackPlan` is **record-only**:

- `rollback_required`
- `rollback_steps`
- `rollback_reason`

No real rollback execution.

---

## Idempotency

`validateIdempotency` keys on `proposal_id` + `execution_id` → `execution_hash`.  
Optional in-memory store blocks `duplicate_apply`.

---

## Validation

not approved · not ready · duplicate apply · invalid plan · missing execution gate · immutable · extra fields · unicode · prototype keys · gate execute flags forbidden

---

## Security

No Provider / Network / SDK / Credential / Migration / Production write.  
`execution_state="validated"` ≠ `executed=true`.

---

## Regression

A1–A4 apply/commit remain forbidden; A4 suite PASS.
