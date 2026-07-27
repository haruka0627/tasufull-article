# AI Execution Gate — Phase B3 API notes

**Date:** 2026-07-28  
**HEAD base:** `d1a73f7` (B2)  
**Status:** Final review · HTTP E2E · selective commit  
**Staging/Production:** No-Go · push/deploy No-Go

## Endpoints

| Method | Path | File |
| --- | --- | --- |
| `POST` | `/api/ai-exec-gate/create` | `functions/api/ai-exec-gate/create.js` |
| `POST` | `/api/ai-exec-gate/execute` | `functions/api/ai-exec-gate/execute.js` |
| `GET` | `/api/ai-exec-gate/:id` | `functions/api/ai-exec-gate/[id].js` |
| `OPTIONS` | same | CORS preflight |

Body limit: **8 KiB**. Content-Type: `application/json`. Cache: `no-store`.

## Auth

1. Bearer Supabase access token (`/auth/v1/user`)
2. Ops claim: `is_ops` **or** `role === tasu_admin` (app_metadata + top-level merge)
3. Unauthenticated → `401` · non-ops → `403` `ops_required` · **no DB write**
4. Body `role` / `is_ops` rejected

## Gate evaluation (after auth)

B1: **environment → emergency stop → feature flag → allowlist → hard cap**  
Control SSOT = B1 **env**.

## Create lifecycle

```text
auth/ops → validate → day spend → policy → insert request
→ insert events (required) → respond
```

- Allowed → `status=queued`, `decision=allowed`
- Blocked (ops) → audited `blocked`
- Event insert failure → **HTTP 500** `event_persist_failed` + `execution_id` / `correlation_id` / `audit_incomplete` (not a clean allowed)

## Estimate (temporary B3)

Constant: `PHASE_B3_FIXED_REQUEST_ESTIMATE_USD = 0.01`  
Server-only · client override forbidden · **not** FREEZE/B1 permanent SSOT · **B4+ replaces** with real estimator.

## Idempotency

Same key + same `payload_hash` → replay · mismatch → `409` · UNIQUE race → lookup · replay **does not** re-insert events.

## Execute stub (B3)

```text
Phase B3 stub only
No executor invocation
No provider call
No external side effect
```

- Records `execute_stub_accepted` event
- **Leaves status `queued`** (does **not** set `succeeded`)
- No `ai_execution_results`
- GET exposes `stub` / `pipeline_invoked: false`

## Atomicity residual

No SECURITY DEFINER RPC. Request may exist if events fail; response is **500** with ids for ops follow-up. Replay of successful create does not duplicate events.

## Tests

```bash
node scripts/test-ai-exec-gate-phase-b1-constants.mjs
node scripts/test-ai-exec-gate-phase-b2-db.mjs
node scripts/test-ai-exec-gate-phase-b3-api.mjs
```

## B4 boundary

B4 owns real `ops_collector` → `secretary_deepseek` → `gate_audit_writer` and results.
