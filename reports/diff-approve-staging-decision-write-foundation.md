# Diff & Approve — Staging Operator Decision Write Foundation

## 1. Verdict

```text
PASS_STAGING_DECISION_WRITE_FOUNDATION
PASS_STAGING_DECISION_WRITE_HARDENING
```

```text
Decision writes: ENABLED IN STAGING
Apply: NOT EXECUTED
Provider execute: NOT EXECUTED
Automatic execution: NOT CONNECTED
Production: NOT TOUCHED
Migration repair: NOT PERFORMED
```

## 2. Scope

Implemented Staging-only persistence for Operator decisions:

| Action | Transition | Audit event |
| --- | --- | --- |
| `propose` | `draft` → `pending_approval` | `proposal_submitted` |
| `approve` | `pending_approval` → `approved` | `approval_granted` |
| `reject` | `pending_approval` → `rejected` | `approval_rejected` |
| `cancel` | `pending_approval` → `cancelled` | `approval_cancelled` |

Out of scope (explicitly not connected): Apply, Provider execute, queue/worker/cron, billing, Production, rollback execution.

## 3. Starting State

| Field | Value |
| --- | --- |
| Branch | `cf-pages-deploy` |
| Starting HEAD | `c6c7413cdfee606911c4867ebcadec2b04bd37da` |
| Staged | 0 |
| Dirty | large unrelated tree (untouched) |
| Linked Supabase | Staging `ahlxuyvhzqdqaojiywmu` |

## 4. Existing Architecture Audit

Reused:

- A1 status vocabulary (`draft` / `pending_approval` / `approved` / `rejected` …)
- A2 decision semantics (approve/reject as records, Apply forbidden)
- Persistence tables + deny-all RLS + service_role ownership (B2)
- `requireGateOpsUser` for Operator auth
- A10 FNV hash chain for audit events
- Existing GET `/api/ai-diff-approve/*` read APIs (unchanged method policy)

User term `proposed` maps to existing status `pending_approval`.

## 5. State Machine

Implemented transitions only:

```text
draft -> pending_approval     (propose)
pending_approval -> approved  (approve)
pending_approval -> rejected  (reject)
pending_approval -> cancelled (cancel)
```

Denied (examples): `draft→approved`, `approved→rejected`, `approved→cancelled`, any `→applying|applied`.

`approved` is a Decision terminal for this foundation and remains an Apply Gate *candidate* only — no Apply path is invoked.

## 6. Decision Contract

Module: `deploy/cloudflare/functions/_shared/ai-diff-approve-ops-decision-contract.mjs`

Input allowlist: `requestId`, `action`, `expectedVersion`, `idempotencyKey`, `reason`.

Enforced: UUID normalize, action allowlist, non-negative integer version, idempotency charset/length, reason ≤500, control-char reject, prototype-key reject, NFC + whitespace normalize, payload hash stability.

Actor / tenant / timestamps / resulting status are server-derived.

## 7. Database Changes

Migration: `supabase/migrations/20260728160000_ai_diff_approve_staging_decision_write.sql`

- New RPC `public.ai_diff_approve_record_decision(jsonb)`
- Reuses existing proposals / records / events / idempotency tables
- Adds `cancelled` as decision vocabulary (commented; no applying/applied writes)
- Actor stored in event payload (not FK-forced onto `auth.users`)

## 8. RPC and Grants

| Principal | EXECUTE `ai_diff_approve_record_decision` |
| --- | --- |
| `anon` | false |
| `authenticated` | false |
| `service_role` | true |

`SECURITY DEFINER` + `search_path = public`. No table grants added for anon/authenticated.

## 9. RLS and Authorization

| Actor | propose/approve/reject/cancel |
| --- | --- |
| Operator (`is_ops` / `tasu_admin`) via Edge | allow |
| Member | deny (ops_required) |
| Anonymous | 401 / RPC denied |
| Browser direct table write | deny-all RLS |

Edge resolves actor from JWT (`requireGateOpsUser`); client cannot spoof role.

## 10. Idempotency

Scoped key: `dw:{env}:{actor}:{request}:{action}:{clientKey}` (≤200).

Token = payload hash.

| Case | Result |
| --- | --- |
| Same key + same payload | `200`, `replayed: true`, no new audit, no version bump |
| Same key + different payload | `409` `IDEMPOTENCY_CONFLICT` |

## 11. Optimistic Concurrency

`expectedVersion` must equal `ai_diff_approve_proposals.record_version` under `FOR UPDATE`.

Conflicts:

- `VERSION_CONFLICT`
- `INVALID_STATE_TRANSITION`
- `ALREADY_DECIDED`

## 12. Repository Adapter

`createPersistentRepository(...).recordOperatorDecision(...)` → RPC.

Returns: `requestId`, `previousStatus`, `currentStatus`, `version`, `decision`, `auditEventId`, `replayed`, `createdAt`, Apply flags always false.

`performApply` / Provider methods remain hard-forbidden.

## 13. API

`POST /api/ai-diff-approve/:id/decision`

Guards: ops auth, Staging env, persistence enabled, Apply flag false, Origin allowlist (8788 + `*.tasufull-article.pages.dev`), JSON-only, 8KiB body, Idempotency-Key header or body, no-store.

GET read routes remain GET-only (`rejectNonGet`).

## 14. Operator UI

`/admin-diff-approve` badges: **STAGING · DECISION WRITE · NO APPLY**.

Detail panel: Propose / Approve / Reject / Cancel + reason + version + feedback + timeline refresh.

No Apply / Execute / Deploy / Rollback / Provider / Force Approve controls.

Non-ops: no action controls (ops guard).

## 15. Audit Timeline

Append-only events with A10 hash chain. Types above. Payload includes actor, from/to status, version, reason, payload hash, Apply flags false.

## 16. Apply Isolation

Proven by:

- No Apply/Provider imports on write path
- RPC rejects `applying`/`applied` targets
- Approve result `status=approved`, `applied=false`
- Repository Apply methods throw `apply_forbidden`
- UI/network surface limited to Decision + GET refresh

## 17. Local Tests

```text
node scripts/test-diff-approve-staging-decision-write.mjs
→ PASS_STAGING_DECISION_WRITE_LOCAL

node scripts/test-diff-approve-staging-readonly-ops.mjs
→ PASS staging history + read-only ops

node scripts/test-diff-approve-phase-a2-approval-workflow.mjs
→ A2 PASSED
```

## 18. Staging Apply

| Check | Result |
| --- | --- |
| Target | Staging `ahlxuyvhzqdqaojiywmu` (linked ◁E) |
| Production ref selected | No |
| Method | `supabase db query --linked --yes -f …160000….sql` (not full push) |
| Repair | **Not performed** (forbidden per task) |
| Pre-existing local-only migrations | Present in list (unrelated; not executed) |

## 19. Staging Verification

- RPC present; `anon`/`authenticated` EXECUTE false; `service_role` true
- Live propose / replay / conflict / approve / reject / cancel / stale version PASS
- Anonymous RPC denied
- Approve stops at `approved` without Apply

## 20. E2E

```text
node scripts/test-diff-approve-staging-decision-write-e2e.mjs
→ PASS_STAGING_DECISION_WRITE_E2E (18/18)
```

Evidence: `reports/diff-approve-staging-decision-write-e2e-summary.json`

Browser Preview Playwright (login UI) not re-run in this pass; API/DB E2E + static UI isolation covered. Optional `--base` for live page GET.

## 21. Security Review

Origin fail-closed; CSRF via Origin for Bearer SPA; ops-only Edge; service_role not exposed to browser; unknown fields rejected; secrets redacted in client; Apply flag fail-closed; Production gate deny.

## 22. Files Changed

- `supabase/migrations/20260728160000_ai_diff_approve_staging_decision_write.sql`
- `deploy/cloudflare/functions/_shared/ai-diff-approve-ops-decision-contract.mjs`
- `deploy/cloudflare/functions/_shared/ai-diff-approve-ops-decision-write.mjs`
- `deploy/cloudflare/functions/_shared/ai-diff-approve-persistence-repository.mjs`
- `deploy/cloudflare/functions/_shared/ai-diff-approve-http.mjs`
- `deploy/cloudflare/functions/api/ai-diff-approve/[id]/decision.js`
- `admin-diff-approve.html` / `.css` / `-client.js` (+ dist mirrors)
- `scripts/test-diff-approve-staging-decision-write.mjs`
- `scripts/test-diff-approve-staging-decision-write-e2e.mjs`
- `scripts/test-diff-approve-staging-readonly-ops.mjs` (badge/POST assertions)
- `reports/diff-approve-staging-decision-write-foundation.md`
- `reports/diff-approve-staging-decision-write-e2e-summary.json`

## 23. Migration History

| Version | Remote schema | Notes |
| --- | --- | --- |
| `20260728140000` | Applied (prior) | Persistence foundation |
| `20260728160000` | SQL applied via `db query` | History row may still show local-only until coordinated non-reexec align |

No `migration repair` in this task.

## 24. Production Status

```text
Production: NOT TOUCHED
Production Supabase: NOT CONNECTED
cf-pages-deploy push: NOT PERFORMED
```

## 25. Remaining Risks

- Migration history drift for `20260728160000` (SQL applied; schema_migrations unrepaired — **repair intentionally NOT performed**)
- Pre-existing unrelated local-only migrations remain in `migration list`
- Local 8788 may lack `DIFF_APPROVE_READ_ENABLED` so Playwright list/detail soft-paths fixtures
- Ops-global model (no per-tenant RLS); Edge + service_role remain trust boundary

## 26. Final Conclusion

Staging Operator Decision Write Foundation is complete: decisions and audit events persist safely; Apply remains disconnected; Production untouched; no push.

---

## 27. Operational Hardening

```text
PASS_STAGING_DECISION_WRITE_HARDENING
PASS_STAGING_DECISION_WRITE_PLAYWRIGHT
```

Completed in follow-up hardening pass (no Apply / Provider / Production / repair):

| Area | Result |
| --- | --- |
| Migration history audit | DRIFT documented · repair NOT performed · SQL re-exec NOT performed |
| Duplicate propose/approve/reject/cancel | PASS |
| Invalid version matrix | PASS |
| Timeline / audit ordering + chain | PASS |
| Replay adds no audit | PASS |
| Filter / pagination after writes | PASS |
| Read-only after approve (`applied=false`) | PASS |
| Minimal UX (disable-while-submit · data attrs) | PASS |
| Playwright desktop/mobile badges + no Apply net | PASS |

Evidence:

- `reports/diff-approve-staging-decision-write-hardening-summary.json`
- `reports/diff-approve-staging-decision-write-playwright-summary.json`

Scripts:

- `scripts/test-diff-approve-staging-decision-write-hardening.mjs`
- `scripts/test-diff-approve-staging-decision-write-playwright.mjs`

### Migration History Audit

| Version | Local | Remote history | Schema |
| --- | --- | --- | --- |
| `20260728140000` | yes | yes | present |
| `20260728160000` | yes | **missing** | present (applied via `db query`) |

```text
history_alignment: DRIFT
repair_needed: YES (history-only)
repair_performed: NO
sql_reexec_needed: NO
recommendation: document_drift_only (stop condition: do not repair in this task)
```

### Regression Expansion

Added: duplicate matrices, invalid version variants, timeline/audit ordering, filter/pagination after writes, operator UX attrs, Apply isolation static.

### Timeline Integrity

Verified contiguous `sequence_number`, `previous_event_hash` chain, non-decreasing `created_at`, event type order `proposal_submitted → approval_granted`, replay does not append.

### Idempotency Audit

Same-key replay for approve/reject/cancel; payload mismatch → `IDEMPOTENCY_CONFLICT`; new-key after terminal → `ALREADY_DECIDED|INVALID_STATE_TRANSITION`.

### Security Review Update

```text
service_role_browser: SAFE
origin_csrf: PASS
json_allowlist: PASS
actor_spoofing: PASS
audit_spoofing: PASS
tenant_isolation: N_A_OPS_GLOBAL
must_fix_now: NONE
repair: NOT_PERFORMED
Production: NOT_TOUCHED
Apply: NOT_EXECUTED
```
