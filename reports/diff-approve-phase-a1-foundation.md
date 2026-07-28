# Diff & Approve — Phase A1 MVP Foundation

**Verdict:** PASS  
**Date:** 2026-07-28  
**Baseline HEAD (start):** `fd505e08297738a3c80db34030e602af788cbdd6`  
**Scope:** Proposal / Diff / Impact / Pending Approval / Snapshot / Validation only

---

## Architecture

```text
AI Request
↓
Execution Gate (existing · unchanged)
↓
Proposal (draft)
↓
Diff (before / after / summary)
↓
Impact (estimate)
↓
Pending Approval
↓
Persist (concept only · no DB write)
```

Apply is **not** implemented (`applyProposal` → `apply_forbidden`).

Module: `deploy/cloudflare/functions/_shared/ai-diff-approve-a1-foundation.mjs`

Greenfield sibling to Execution Gate (evaluation-only · no executor wire · no Dashboard).

---

## Proposal

Fields:

- `proposal_id` · `request_id` · `capability` · `resource_type` · `resource_id`
- `change_type` · `status` · `created_at` · `reason`

Capability: existing Phase B allowlist only.  
Resource types: `text` · `json` · `settings` (code excluded).  
A1 active statuses: `draft` · `pending_approval`.

---

## Diff

`generateDiff` returns frozen `{ before, after, summary }` for text/json/settings.  
Prototype keys stripped. Depth/size limited. No code diffs.

---

## Impact

`generateImpactSummary` returns:

- `changed_fields`
- `estimated_risk` (`low` | `medium` | `high`)
- `approval_required` (always `true` in A1)
- `affected_scope`

Estimate only — no apply side effects.

---

## Validation

Fail-closed checks:

- missing proposal
- unknown status / resource / capability / change_type
- approved/rejected/expired forbidden as active A1 status
- prototype pollution / extra fields
- unicode resource mismatch
- immutable requirement

---

## Security

Forbidden:

- Provider execute · Network · SDK · Credential · Migration · Apply · DB mutation

Invariants on snapshots:

- `applied=false`
- `provider_called=false`
- `executed=false`
- `transmit=false`
- `recorded_api_cost=0`

---

## Regression

`node scripts/test-diff-approve-phase-a1-foundation.mjs` — PASS  
Execution Gate B–C10 left untouched (no executor integration in A1).
