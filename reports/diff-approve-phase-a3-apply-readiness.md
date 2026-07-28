# Diff & Approve — Phase A3 Apply Readiness

**Verdict:** PASS  
**Date:** 2026-07-28  
**Baseline HEAD (start):** `28d19dcf44bb3e3b257c092ed71fcb3d812936d1`  
**Scope:** Pre-apply validation only · Apply still forbidden

---

## Architecture

```text
Approved Proposal
↓
Consistency Validation
↓
Conflict Detection (record)
↓
Apply Readiness (ready | not_ready)
↓
Apply Plan (requires_apply=true · no exec)
↓
Persist (concept only)
```

Module: `deploy/cloudflare/functions/_shared/ai-diff-approve-a3-apply-readiness.mjs`  
Uses A3 sibling `validateApprovedProposal` (A1 still forbids `approved` as active).

---

## Readiness

Decision vocabulary: `ready` | `not_ready` only.

`ready` requires all of:

- status === `approved`
- valid proposal / diff / impact
- known capability · resource · actor
- zero blocking conflicts

---

## Consistency

`validateConsistency` checks proposal shape, freeze, allowlists, actor role, and records conflicts without mutating state.

---

## Conflict Detection

Record-only codes:

- `proposal_status`
- `resource_mismatch`
- `missing_diff`
- `missing_impact`
- `unknown_capability`
- `unknown_resource`

---

## Validation

not approved · unknown capability/resource/actor · missing diff/impact · immutable · extra fields · unicode · prototype keys

---

## Security

No Provider / Network / SDK / Credential / Apply / DB mutation.  
Invariants: `applied=false` · `provider_called=false` · `executed=false` · `transmit=false` · `recorded_api_cost=0`  
`applyProposalChanges` → `apply_forbidden`

---

## Regression

- A3 suite PASS
- A1 + A2 apply remain forbidden; pending → grant → readiness path green
