# Diff & Approve — Staging Persistence Foundation

**Date:** 2026-07-28  
**Branch:** `cf-pages-deploy`  
**Start HEAD:** `82b915314a9574718fd1107f7a02491ed8abb818`  
**Verdict:** `PASS_STAGING_PERSISTENCE_FOUNDATION`

## 1. Verdict

Staging persistence foundation is complete: schema + RLS/grants + transactional RPC + persistent adapter + static/mock tests + Staging apply + isolation probe + cleanup. Real Apply / Production / Provider remain out of scope.

## 2. Starting state

| Item | Value |
| --- | --- |
| branch | `cf-pages-deploy` |
| HEAD | `82b915314a9574718fd1107f7a02491ed8abb818` (match expected) |
| dirty lines | 1084 |
| tracked dirty | 582 |
| untracked | 502 |
| staged | 0 |
| Supabase local | Docker unavailable · no local live DB |
| Staging target | `ahlxuyvhzqdqaojiywmu` (`tasful-staging`) · linked confirmed |
| Production (Do-Not-Use) | `ddojquacsyqesrjhcvmn` |
| Existing Diff & Approve migrations | none (new) |
| Existing RLS conventions | AI Execution Gate B2 deny-all + service_role grants |
| Existing RPC conventions | service_role execute · SECURITY DEFINER with fixed `search_path` |

Existing dirty tree was not edited, staged, or deleted.

## 3. Execution strategy

Primary-led dense implementation (migration ↔ adapter ↔ RPC tightly coupled). Agent A (read-only) audited B2 patterns; no parallel editors on the same files.

## 4. Multi-agent usage

| Agent | Role | Result |
| --- | --- | --- |
| A | Schema/security audit (RO) | event+aggregate · B2 ownership · Staging apply via CLI |
| B/C/D | Not separately launched | Primary implemented migration + adapter + QA in one lane to avoid file conflicts |

## 5. Existing DB audit

- B2 tables: `ai_execution_requests` / `events` / `results`
- Pattern: RLS `deny_all` · revoke-all then minimal `service_role` grants · append-only event triggers · no DELETE
- Diff & Approve A7: versioned records + in-memory idempotency · A9 events · A10 FNV-1a hashes

## 6. Schema decision

**Chosen:** event + aggregate (4 tables), not 7 peer tables.

**Reason:** Aligns with B2 control-plane shape and A7 `record_type`/`record_version` model; single timeline table for A9/A10 chain; dedicated idempotency map.

## 7. Tables / records

| Table | Role |
| --- | --- |
| `ai_diff_approve_proposals` | Aggregate SSOT · apply-forbidden CHECKs (`applied/executed/...=false`, cost `0`) · `environment='staging'` |
| `ai_diff_approve_records` | Versioned A7 payloads (proposal…final_gate, audit) |
| `ai_diff_approve_events` | Append-only timeline · `sequence_number` + hash chain columns |
| `ai_diff_approve_idempotency` | Insert-only claim map · UNIQUE key (+ optional proposal/execution+op indexes) |

RPC: `public.ai_diff_approve_write_step(jsonb)` — transactional put + idempotency + audit append.

## 8. Ownership model

**Priority:** Execution Gate B2 model (user instruction: prefer existing gate ownership).

- DB: `service_role` writers only · anon/authenticated **no grants** · RLS deny-all
- Column `owner_user_id` is an application ownership hint for Edge filtering
- Client cannot spoof via PostgREST (no authenticated table access)
- Authenticated role probe on Staging: `permission denied for table ai_diff_approve_proposals`

## 9. RLS matrix

| Role | proposals | records | events | idempotency |
| --- | ---: | ---: | ---: | ---: |
| anon | deny | deny | deny | deny |
| authenticated | deny | deny | deny | deny |
| service_role | bypass RLS (grants only) | same | same | same |

Policies: `*_deny_all` `USING (false) WITH CHECK (false)` on all four tables.

## 10. Grant matrix

| Table | service_role | anon/auth |
| --- | --- | --- |
| proposals | SELECT, INSERT, UPDATE | none |
| records | SELECT, INSERT, UPDATE | none |
| events | SELECT, INSERT | none |
| idempotency | SELECT, INSERT | none |
| write_step(jsonb) | EXECUTE | none |

DELETE not granted. Event/idempotency UPDATE/DELETE blocked by triggers.

## 11. Repository adapter

Path: `deploy/cloudflare/functions/_shared/ai-diff-approve-persistence-repository.mjs`

- A7-compatible: `put` / `get` / `listByProposal` / `claimIdempotency`
- Extras: `getProposalBundle` / `listProposalBundles` / `getAuditTimeline` / typed savers
- Flags: `DIFF_APPROVE_PERSISTENCE_ENABLED` · `DIFF_APPROVE_APPLY_ENABLED` (must stay false)
- Rejects Production URL ref `ddojquacsyqesrjhcvmn`
- NFC normalization · strict A7 validation · immutable returns
- Forbidden apply fns throw (`performApply`, `commitApply`, …)

## 12. Idempotency

| Conflict | Behavior |
| --- | --- |
| duplicate `idempotency_key` | `duplicate_key` · return existing token · no new row |
| duplicate proposal+operation (when both set) | unique index → conflict |
| duplicate execution+operation | unique index → conflict |
| stale `record_version` | `stale_version` |
| same/higher version rewrite | `duplicate_key` |

## 13. Audit chain

- Adapter computes A10-compatible `event_hash` (FNV-1a)
- DB verifies sequence continuity + `previous_event_hash` match
- Read path re-walks chain (`getAuditTimeline`)
- UPDATE/DELETE forbidden (trigger + no grants)
- No secret key signatures

## 14. Migration

`supabase/migrations/20260728140000_ai_diff_approve_staging_persistence.sql`

Includes tables, constraints, indexes, RLS, policies, grants/revokes, triggers, RPC, comments, verification query comments.

## 15. Local verification

| Check | Result |
| --- | --- |
| Docker / local Supabase | **Unavailable** (Docker not installed) |
| Static migration + mock adapter tests | **PASS** (`node scripts/test-diff-approve-staging-persistence.mjs`) |

Local live DB probes deferred; Staging used as the live verification environment after static PASS and Staging target proof.

## 16. Staging application

| Step | Result |
| --- | --- |
| Linked ref | `ahlxuyvhzqdqaojiywmu` (Staging) |
| Pre-snapshot | all four `to_regclass` = null |
| Apply | `npx supabase db query --linked --yes -f …140000….sql` → exit 0 |
| Production operations | none |

## 17. Staging verification

| Check | Result |
| --- | --- |
| Tables exist | PASS |
| RLS enabled | PASS |
| anon SELECT false | PASS |
| service_role events INSERT true / DELETE false | PASS |
| RPC execute service_role only | PASS |
| write_step create + audit | PASS (2 events) |
| duplicate idempotency | PASS (`duplicate_key`, existing `tok-a`) |
| record_version → 2 | PASS |
| audit UPDATE | PASS deny (`append-only`) |
| authenticated SELECT | PASS deny (`permission denied`) |
| chain mismatch path | exercised in probe SQL |

## 18. Cleanup

`supabase/tests/ai_diff_approve_staging_persistence_cleanup.sql` removed probe rows:

`left_proposals=0 · left_records=0 · left_events=0 · left_idem=0`

(Operator temporarily disabled delete-forbid triggers for cleanup only.)

## 19. Security invariants

Maintained on aggregate CHECKs and adapter bundle returns:

`applied=false · executed=false · provider_called=false · transmit=false · recorded_api_cost=0 · network_called=false · production_written=false · rollback_executed=false`

No `performApply` / provider / external AI / billing / Dashboard wiring.

## 20. Tests

| Suite | Result |
| --- | --- |
| `node scripts/test-diff-approve-staging-persistence.mjs` | PASS |
| `node scripts/test-diff-approve-safe-batch-integration.mjs` | PASS |
| A1–A5 phase tests | PASS |
| C10 production readiness | PASS |
| B2 static db test | PASS (ran) |

## 21. Regression

Diff & Approve A1–A11 safe batch + forbid-apply paths remain green. AI Execution Gate C10 green. No Production API behavior changed.

## 22. Scope audit

**In scope delivered:** Staging schema, RLS, grants, RPC, adapter, tests, Staging apply, evidence, selective commits.

**Out of scope (stopped):** Production migration/deploy, real Apply/Rollback, Provider execute, external AI, billing, Dashboard UI, Cron/Worker/Queue.

## 23. Known risks

1. Local Docker absent → local live RLS probes not re-run offline
2. `owner_user_id` isolation is Edge/service_role discipline (not auth.uid() policies) — intentional B2 alignment
3. Staging probe cleanup requires privileged trigger disable (operator-only)
4. Migration applied via `db query -f` (not `migration history` bookkeeping) — may need `supabase migration repair` if history tracking is required later

## 24. Critical boundary

Next real boundaries (do not start without explicit approval):

- Production migration
- Real Apply / Provider / Rollback
- Dashboard UI wiring
- Cron / Worker / Queue enablement
- Authenticated owner RLS redesign (if product requires browser-direct access)

## 25. Commits

See final report section after git commits (selective staging only · no push).

## 26. Next recommended action

Require explicit approval before:

1. Wiring Dashboard UI to persistent repository  
2. Enabling any Apply path (`DIFF_APPROVE_APPLY_ENABLED` must remain false)  
3. Production migration  
4. Optional: authenticated owner RLS if product model changes away from B2
