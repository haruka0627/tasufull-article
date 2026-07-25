# TASFUL AI — Staging Live Checklist

**Run only AFTER Staging is unpaused.** Do not run any item while Staging is paused.  
**Production is forbidden:** this checklist is Staging-only; do not use Production Supabase, Cloudflare, provider credentials, migrations, or deployment targets.

**Evidence location:** record command output, request IDs, sanitized logs, and screenshots in the Phase 9 verification report. Never record tokens, prompts, responses, or API secrets.

---

## DB / Migration

| Item | Prerequisite | Command / 操作 | Expected | Evidence | Rollback | PASS / FAIL |
| --- | --- | --- | --- | --- | --- | --- |
| Usage events schema | Staging unpaused; approved Staging migration window | Manually review and apply the approved Staging migration runbook; query Staging read-only for `ai_usage_events` | Table, constraints, and ingest RPC match migration | Migration ID and sanitized `SELECT` result | Execute approved Staging-only rollback SQL | [ ] PASS [ ] FAIL |
| Cost ledger schema | Previous row PASS; approved migration window | Manually verify `ai_model_price_rates`, views, and aggregate RPC in Staging | Read-only aggregation works; no Production reference | Sanitized query/result | Approved Staging-only rollback | [ ] PASS [ ] FAIL |

## JWT

| Item | Prerequisite | Command / 操作 | Expected | Evidence | Rollback | PASS / FAIL |
| --- | --- | --- | --- | --- | --- | --- |
| Workspace postEdge | Staging test account and JWT | Send an authenticated Workspace Chat request through Staging | Edge receives bearer JWT; authenticated request succeeds or returns an explicit policy result | HTTP status, request ID, sanitized Edge log | Disable test account/session; no code rollback | [ ] PASS [ ] FAIL |
| Manual deny | Plan/model combination denied for test user | Select disallowed Manual model and submit | Explicit `plan_model_denied`; no provider fallback and no mock completion | HTTP status, UI screenshot, request ID | Restore allowed model selection | [ ] PASS [ ] FAIL |
| Voice Live (only if enabled) | Live flags intentionally enabled | Confirm `VOICE_REALTIME_REQUIRE_JWT=1`, then test authenticated and missing-JWT requests | Authenticated request follows policy; missing JWT denied | Sanitized config confirmation and statuses | Turn flags OFF; remove test session | [ ] PASS [ ] FAIL |

## Provider

| Item | Prerequisite | Command / 操作 | Expected | Evidence | Rollback | PASS / FAIL |
| --- | --- | --- | --- | --- | --- | --- |
| Remote Workspace response | Approved Staging provider secrets and test account | Submit a low-risk test prompt | Remote provider response or explicit provider error; never silent mock success | HTTP status, request ID, sanitized provider/Edge log | Disable Staging provider route if required | [ ] PASS [ ] FAIL |
| OpenRouter isolation | No general Workspace OpenRouter configuration | Inspect Workspace model UI and standard Gateway trace | No OpenRouter model/route is exposed | Screenshot and sanitized trace | Keep PoC flags OFF | [ ] PASS [ ] FAIL |

## Usage

| Item | Prerequisite | Command / 操作 | Expected | Evidence | Rollback | PASS / FAIL |
| --- | --- | --- | --- | --- | --- | --- |
| Quota guard | Authenticated Staging test user | Invoke allowed and exhausted quota cases | Allowed case proceeds; unavailable/exhausted guard denies fail-closed | HTTP status, request IDs, sanitized usage rows | Reset/replace test entitlement under approved Staging procedure | [ ] PASS [ ] FAIL |
| Media usage log | Staging Media test feature enabled for test user | Run one safe Media test request | Exactly one corresponding usage event | Request ID and redacted row count | Delete only approved test data manually if runbook permits | [ ] PASS [ ] FAIL |
| Character usage log | Staging Character test feature enabled | Run one safe Character analysis request | Exactly one corresponding usage event | Request ID and redacted row count | Delete only approved test data manually if runbook permits | [ ] PASS [ ] FAIL |
| Text gauge | Workspace authenticated session | Open settings/billing after a text request | “テキスト利用枠” shows authoritative daily usage or explicit unavailable state | Screenshot and API response metadata | End session; no data rollback | [ ] PASS [ ] FAIL |

## Security

| Item | Prerequisite | Command / 操作 | Expected | Evidence | Rollback | PASS / FAIL |
| --- | --- | --- | --- | --- | --- | --- |
| Missing JWT | Staging endpoint accessible | Submit request with no/invalid bearer token | Auth-required rejection; no provider call | HTTP status and sanitized Edge log | None | [ ] PASS [ ] FAIL |
| Guard unavailable | Approved fault-injection method in Staging | Temporarily simulate guard/RPC unavailability | `usage_guard_unavailable`; no provider call | HTTP status and sanitized log | Restore guard dependency immediately | [ ] PASS [ ] FAIL |
| Secret exposure | Staging browser session | Inspect network/UI responses | No provider key, service-role key, or raw secrets exposed | HAR/log sanitized for storage | Revoke any exposed Staging credential | [ ] PASS [ ] FAIL |

## Performance

| Item | Prerequisite | Command / 操作 | Expected | Evidence | Rollback | PASS / FAIL |
| --- | --- | --- | --- | --- | --- | --- |
| Chat latency baseline | Staging provider route healthy | Run 5 low-risk authenticated text requests | Record median/p95; no unexpected timeout pattern | Sanitized timings and request IDs | Disable problematic route/flag if approved | [ ] PASS [ ] FAIL |
| Guard overhead | Same request set with timestamps | Compare guard + provider timings | Guard overhead is measurable and no fail-open behavior appears | Sanitized timing summary | Restore normal Staging configuration | [ ] PASS [ ] FAIL |

