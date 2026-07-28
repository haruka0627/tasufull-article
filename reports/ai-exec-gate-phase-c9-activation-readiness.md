# AI Execution Gate — Phase C9 Provider Activation Readiness

**Verdict:** PASS  
**Date:** 2026-07-28  
**Baseline HEAD (start):** `a0b19587ed197661c99ae05683690f2055ce89fb`  
**Scope:** Non-executing activation eligibility evaluation only

---

## Purpose

Add a provider-neutral **Activation Readiness** layer that decides only:

- `eligible`
- `not_eligible`

after Dry-Run and before the deterministic C1 report.  
Real provider communication remains forbidden.

---

## Architecture

| Symbol | Role |
| --- | --- |
| `ActivationEvaluator` (`evaluateActivation`) | Fail-closed eligibility decision |
| `ActivationDecision` | `eligible` \| `not_eligible` |
| `ActivationReason` | Stable deny/ready vocabulary |
| `CapabilityEligibility` | Phase B capability allowlist only |
| `ProviderEligibility` | C4 provider id allowlist only |
| `ActivationSnapshot` | Minimal audit snapshot (no prompt/secrets/payload) |

Module: `deploy/cloudflare/functions/_shared/ai-exec-gate-c9-activation-readiness.mjs`

---

## Activation evaluation

Checks (first failure wins → `not_eligible`):

1. Capability allowlist (`collect_daily_ops` · `generate_ops_report` only; unknown → not eligible)
2. Provider existence (C4 `validateProviderIdentifier`)
3. Execution boundary (immutable plan · optional envelope · `transmit===false` · execute flags false · cost 0)
4. Budget state (blocked / hard_cap → not eligible)
5. Invocation state (must be `allowed` for eligible; C6 live path is always `denied`)
6. Policy state (all C6 enable flags must be `true` for eligible; live `getInvocationPolicy()` is all `false`)
7. Dry-run state (`ok` · no execute flags)

Live pipeline path therefore remains **`not_eligible`** (`invocation_denied` or `provider_disabled`).  
`eligible` is reachable only with synthetic test inputs (evaluation math coverage) — still never executes.

---

## Capability

Reuses existing Phase B definitions only. No new capabilities. Unknown capability → `not_eligible`.

---

## Policy

- Event: `activation_readiness_evaluated`
- Policy dependency: `PHASE_C6_INVOCATION_POLICY` / `getInvocationPolicy()`
- C9 does **not** flip C6 flags and does **not** call `adapter.execute()`

---

## Pipeline

```text
Validation
↓
Hardening
↓
SAFE Usage (C7)
↓
Budget (C3)
↓
Resolve / Prepare (C4)
↓
Execution Boundary (C5)
↓
Invocation Gate (C6 · denied)
↓
Dry Run (C8)
↓
Activation Evaluation (C9)   ← NEW (decide only)
↓
C1 Report
↓
Persist
```

---

## Security

Forbidden and statically checked in C9 module:

- `fetch` · axios · SDK · Authorization · Bearer · API key
- `process.env` · `eval` · `Function` · dynamic `import`
- `adapter.execute`

Invariants retained:

- `provider_called=false`
- `executed=false`
- `transmit=false`
- `recorded_api_cost=0`

Snapshot excludes prompt body, credentials, and provider payload.

---

## Tests

`node scripts/test-ai-exec-gate-phase-c9-activation-readiness.mjs`

Coverage:

- ActivationEvaluator
- Capability / Provider
- Budget blocked
- Invocation denied
- DryRun invalid
- Eligible / Not eligible
- No execute / No network (static)
- Immutable · prototype pollution · unicode · extra fields
- Pipeline integration (live → not_eligible · event order)

---

## Regression

Required suite: B1–B6 · C1–C9 (see final report / CI local run).

---

## Known risks

1. Response body gains additive `activation` field (live: `not_eligible`).
2. `eligible` must never be treated as execute permission without a later explicit phase.
3. C9 trusts caller-supplied `policy` for math; executor always injects frozen `getInvocationPolicy()`.
4. Hard evaluation failure maps to report failure code (fail-closed).

---

## Scope

Not touched: Dashboard · Migration · Deploy · Production · Staging apply · Worker · Cron · Queue · MCP.
