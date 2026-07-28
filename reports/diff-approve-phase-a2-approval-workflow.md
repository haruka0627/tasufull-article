# Diff & Approve — Phase A2 Approval Workflow

**Verdict:** PASS  
**Date:** 2026-07-28  
**Baseline HEAD (start):** `bad0cc731f1b351c80e14a7f13075e190e1f0738`  
**Scope:** Approval decisions only · Apply still forbidden

---

## Architecture

```text
Proposal (A1 draft)
↓
Pending Approval (A1)
↓
Approval Decision (A2)
↓
Approved | Rejected | Revision Requested
↓
Persist (concept only · no DB)
```

Module: `deploy/cloudflare/functions/_shared/ai-diff-approve-a2-approval.mjs`  
A1 vocab extended with `revision_requested` (active statuses unchanged).

---

## State machine

```text
draft → pending_approval          (A1)
pending_approval → approved       (A2 · approver|system)
pending_approval → rejected       (A2 · approver|system)
pending_approval → revision_requested (A2 · approver|requester|system)
expired = type-only (no transition)
```

Terminal states cannot transition again (`approved_twice` / `rejected_twice` / `already_terminal`).

---

## Authority

Roles: `approver` · `requester` · `system`  
Unknown actors rejected. Requester cannot grant/reject.

---

## Events

| Event | Meaning |
| --- | --- |
| `approval_requested` | Confirm pending workflow |
| `approval_granted` | → approved |
| `approval_rejected` | → rejected |
| `revision_requested` | → revision_requested |

Apply events are forbidden. `applyApprovedProposal` → `apply_forbidden`.

---

## Validation

- unknown actor / state / invalid transition
- approved twice / rejected twice
- immutable · extra fields · unicode ZWSP in actor id · prototype keys

---

## Security

No Provider / Network / SDK / Credential / Apply / DB mutation.  
Snapshot invariants: `applied=false` · `provider_called=false` · `executed=false` · `transmit=false` · `recorded_api_cost=0`  
No prompt body in snapshots.

---

## Regression

- `node scripts/test-diff-approve-phase-a2-approval-workflow.mjs`
- A1 suite remains valid (`PHASE_A1_ACTIVE_STATUSES` still draft|pending only)
