# AI Execution Gate — Phase C First Real Execution Use Case Design

```text
Status: Design Freeze Candidate
Implementation: Not Started
Provider: Not Connected
Staging: Not Applied
Production: Not Applied
```

**Date:** 2026-07-28  
**Branch baseline:** `cf-pages-deploy` @ `0af6968` (Phase B6 evidence)  
**Parent freeze:** [AI_EXECUTION_GATE.md](./AI_EXECUTION_GATE.md) (FREEZE APPROVED 2026-07-28)  
**Phase B plan / tickets / evidence:** [PHASE_B_PLAN](./AI_EXECUTION_GATE_PHASE_B_PLAN.md) · [PHASE_B_TICKETS](./AI_EXECUTION_GATE_PHASE_B_TICKETS.md) · [B6 evidence](../../reports/ai-exec-gate-phase-b6-integration-evidence.md)  
**Related:** [SECRETARY_AI.md](./SECRETARY_AI.md) · [TASFUL_AI_SAFE_OPS_FOUNDATION.md](./TASFUL_AI_SAFE_OPS_FOUNDATION.md) · AD-006 · AD-010  

> **Naming note:** FREEZE §16 labels **Phase C** as「費用台帳接続・予算・可観測性」(SAFE-06/07). This document freezes the **first real (non-fixture) Gate execution use case** on the existing Phase B capability plane, and treats SAFE-06/07 linkage + hard cost controls as **mandatory co-controls** before any provider-enabled Staging enablement. It does **not** amend FREEZE wording; implementation remains NO-GO until an explicit Phase C implementation ticket is approved.

---

## 1. Status

| Item | Value |
| --- | --- |
| Design freeze | **Candidate** (this document) |
| Implementation | Not started |
| Provider SDK / API keys | Not added · not connected |
| MCP / Cron / Worker / Queue | Out of scope |
| Send / Approve APIs | Out of scope |
| Staging / Production apply | Not applied |
| Phase B local evidence | `PASS_WITH_KNOWN_RISKS` (`0af6968`) |

---

## 2. Decision

**Selected first real Gate use case (exactly one):**

### AI Secretary Daily Operations Summary

Formal keys (unchanged from Phase B allowlist):

| Field | Value |
| --- | --- |
| Capability | `collect_daily_ops` → `generate_ops_report` |
| Action | `ops_secretary.daily_pending.report_pipeline` |
| Service | `ops_secretary` |
| Ports | `ops_collector` · `secretary_deepseek` · `gate_audit_writer` |
| Risk | **LOW** |
| Mode | **REPORT_ONLY** preferred for first provider-backed Staging; **AUTO** only after explicit ops enablement checklist |
| Environment | **Staging only** (Production fail-closed) |
| Actor | ops human (JWT `is_ops` / `tasu_admin`) |

**What changes vs Phase B runtime today (design intent only):**

| Layer | Phase B today (shipped) | Phase C first real use (design) |
| --- | --- | --- |
| Collector | Deterministic empty fixture | Read-only, allowlisted **counts** sources (Staging) |
| Report | Deterministic template · `provider_called=false` | Optional **one** provider call via port `secretary_deepseek` · AD-010 dedicated path |
| Dashboard | create → get · **no page-load execute** | Unchanged (explicit execute only) |
| Cost | hard cap env · recorded 0 | hard cap + SAFE-06/07 recording contract (no double ledger) |

---

## 3. Selected use case

### Responsibilities

1. Collect **count-based / opaque** daily ops signals (Staging).  
2. Optionally request a **single** LLM summary via Gate executor port (not Gateway).  
3. Persist **sanitized** result for ops Dashboard GET.  
4. Allow ops to **read** status / summary / warnings.  

### Explicit non-actions

- No external send · no user notify · no approval · no reject/suspend/charge/refund/delete  
- No Production state mutation beyond Gate audit tables  
- No automatic business “completion” — `succeeded` means **summary generation succeeded** only  

### Inputs (allowlist candidates — counts preferred)

| Signal | Class | Provider? |
| --- | --- | --- |
| Pending approval / task counts | internal | yes (aggregated) |
| Failed / blocked Gate request counts | internal | yes |
| Moderation open counts (if available Staging) | internal | yes (counts only) |
| ANPI operational counts (non-emergency) | internal | yes (counts only) |
| System warning counts | internal | yes |
| Support queue counts | internal | yes |
| Opaque category keys | internal | yes (no raw titles if PII) |

### Prohibited inputs

raw message bodies · passwords · tokens · API keys · payment full details · unrestricted DB dumps · raw user content · unnecessary personal identifiers · unrestricted prompt injection payloads from stored text

### Outputs

- Internal sanitized summary (bounded)  
- Priority checklist for humans  
- Count-based warnings  
- `provider_called` · `recorded_api_cost` · model metadata allowlist · `error_code`  

### Prohibited output actions

send · approve · reject · suspend · charge · refund · delete · notify users · alter production business state

---

## 4. Rejected alternatives

| ID | Candidate | Decision | Primary reason (evidence) |
| --- | --- | --- | --- |
| A | **AI Secretary Daily Operations Summary** | **SELECTED** | Already FREEZE/PLAN Phase B vertical slice; LOW; SAFE-17 morning report surface; Dashboard path exists |
| B | AI secretary anomaly summary | Rejected (first) | New capability / detection semantics; higher false-positive / hallucination ops risk; not in B allowlist |
| C | Support / inquiry classification | Rejected (first) | FREEZE §14 Phase B 外; drifts to MEDIUM/HIGH send path |
| D | Internal report drafting (generic) | Rejected (first) | Overlaps A; less tied to existing Gate action/ports |
| E | ANPI operations summary | Rejected (first) | ANPI 緊急 is HIGH example in FREEZE; separate product freeze |
| F | Platform moderation summary | Rejected (first) | Platform AI engine forbidden (AD-003); new port/product scope |

### Comparison matrix (summary)

| Criterion | A Daily ops | B Anomaly | C Support classify | D Generic draft | E ANPI | F Moderation |
| --- | --- | --- | --- | --- | --- | --- |
| Business value (ops desk) | High | Med | High | Med | High | Med |
| Complexity | Low–Med | Med–High | High | Med | High | High |
| External API | Optional 1 call | Likely | Likely | Likely | Likely | Likely |
| PII exposure | Low if counts | Med | High | Med | High | High |
| Irreversible action | None | Low | High if send | None | High | High |
| Approval needed | View only | View only | Often | View only | Often | Often |
| Retry complexity | Low | Med | Med | Low | High | Med |
| Idempotency (JST day) | Excellent | Fair | Fair | Fair | Fair | Fair |
| Auditability | High (existing tables) | Med | Med | Med | Med | Med |
| Cost predictability | High | Med | Med | Med | Med | Med |
| Code reuse | **Max** (B1–B5) | Low | Partial secretary | Partial | ANPI stack | Platform |
| Phase B fit | **Exact** | Poor | Poor | Partial | Poor | Poor |

---

## 5. Scope

**In (design freeze):**

- One use case on existing B capabilities/action/ports  
- Provider **interface** + redaction/validation contracts  
- Cost / flag / stop / lease / orphan recovery design  
- Privacy classes · threat model · test/rollout/rollback  
- Explicit execute-only trigger (Dashboard must not auto-execute)  

**Co-control (must be designed with enablement):**

- SAFE-06 usage event recording for Gate provider calls (no SAFE-06/07 double ledger)  
- SAFE-07 cost aggregation hooks / estimates  
- Conservative hard caps (env placeholders until priced)

---

## 6. Non-goals

- Implementing collector/provider/SDK/API keys  
- Staging/Production apply or deploy  
- MCP · Cron · Worker · Queue  
- Diff & Approve · Self Correction  
- External send / approval APIs  
- New capabilities beyond B allowlist  
- Amending FREEZE body (use later amendment if needed)  
- Production enablement  

---

## 7. Data flow

```text
ops (explicit trigger)
  → POST /api/ai-exec-gate/create  (idempotent JST-day key)
  → POST /api/ai-exec-gate/execute (explicit only; not page-load)
       → Gate policy (env · stop · flag · allowlist · hard cap)
       → atomic claim queued+allowed+parent null → running
       → ops_collector: Staging read-only allowlisted counts → sanitized bag
       → secretary_deepseek port:
            · redaction gate
            · at most 1 provider call OR deterministic fallback
            · output schema validation
       → gate_audit_writer: insert-only sanitized result
       → events + status succeeded|failed
  → GET /api/ai-exec-gate/:id  (Dashboard read)
  → ops human review (no auto action)
```

**Deterministic fallback (design):** If provider disabled / timeout / malformed / over cap → **fail closed** to blocked/failed **or** emit deterministic summary with `provider_called=false` only when feature flag `fallback_deterministic=1` is explicitly enabled (default: fail closed for “real” mode).

---

## 8. Request contract

| Field | Rule |
| --- | --- |
| `purpose` / action | Fixed `ops_secretary.daily_pending.report_pipeline` |
| `actor` | Server JWT subject only · client cannot spoof |
| `environment` | `staging` required · Production rejected |
| `idempotency_key` | 8–200 · includes JST day + actor + purpose · server fingerprint |
| `sanitized_input` | Counts/opaque keys only · size-bounded |
| `payload_hash` | Server-computed · never client-trusted |
| timestamps | Server `created_at` |
| `estimated_api_cost` | Server-only · client estimate forbidden (B3) |

**Trigger:** explicit `execute` by ops (API/tooling). Dashboard page-load remains create→get only (B5 freeze).

---

## 9. Provider interface (design only — not connected)

### Interface (logical)

```text
OpsSummaryProvider.generate({
  correlation_id,
  budget_day_key,
  sanitized_counts,      // allowlisted JSON
  max_output_tokens,
  timeout_ms,
  locale: "ja-JP"
}) → {
  ok,
  text_summary,          // bounded plain text
  priorities[],          // short strings
  warnings[],
  model_id,              // allowlisted
  usage?: { input_tokens?, output_tokens? },
  error_code?
}
```

### Binding (AD-010)

- Port name remains `secretary_deepseek`  
- Implementation **must not** route through `TasuAiModelGateway`  
- Preferred existing surface: dedicated Pages Function pattern (`/api/secretary-deepseek-chat`) wrapped behind Gate redaction — **wiring is future implementation ticket**  
- No new SDK packages in this design freeze  

### Limits (placeholders — do not invent prices)

| Control | Initial design default |
| --- | --- |
| Timeout | 10–15s overall execute (align B4 10s or raise explicitly in impl ticket) |
| Max provider calls / claim | **1** |
| Max input JSON size | e.g. 8–16 KiB sanitized |
| Max output tokens | config placeholder `AI_EXEC_GATE_C_MAX_OUTPUT_TOKENS` |
| Model allowlist | config placeholder list (empty ⇒ provider disabled) |
| Hard cap USD | keep B1 env hard cap; do **not** invent numeric price tables here |

### Normalization

Map provider HTTP/SDK failures to Gate executor codes (extend carefully; do not conflate with B1 blocked reasons):  
`provider_disabled` · `provider_timeout` · `provider_failed` · `output_invalid` · `rate_limited` · `budget_hard_cap` (preflight)

---

## 10. Result contract

Allowlisted persisted/GET fields (extends B5 slice):

| Field | Notes |
| --- | --- |
| `summary` | sanitized · bounded |
| `pending_total` / warning counts | numbers |
| `priorities` | short string array · bounded length |
| `provider_called` | boolean |
| `recorded_api_cost` | number ≥ 0 |
| `output_type` | e.g. `ops_daily_report` |
| `completed_at` | ISO |
| `error_code` | allowlisted code or null |
| model metadata | allowlisted keys only (`model_id`, token counts) |

**Never store/return:** provider secrets · Authorization · full sensitive prompts · unrestricted provider JSON · stacks · raw PII · payload_hash / idempotency_key on GET (B5)

**Semantics:** `execution_status=succeeded` ⇒ summary artifact persisted successfully — **not** business approval or ops action completion.

---

## 11. Cost controls

| Control | Design |
| --- | --- |
| Per-request hard cap | B1 env hard cap · exceed ⇒ `blocked` / fail closed |
| Daily actor / env caps | Design for Phase C impl via SAFE-07 aggregates + Gate snapshots — placeholders until wired |
| Max input size / output tokens | Config placeholders |
| Provider call count | ≤1 per successful claim |
| Estimated vs recorded | Estimate at create; record actual (or 0 if deterministic/fallback) at result |
| Cost unavailable | **Fail closed** for provider-enabled mode (do not silently run unbounded) |
| Emergency stop / feature flag | Existing B1 env SSOT · disable provider path when stopped/disabled |

No invented USD price schedule in this freeze.

---

## 12. Retry / lease / orphan recovery

Addresses B4 known risk: `failRunning` transition miss → rare `running` orphan.

| Topic | Design decision |
| --- | --- |
| `max_attempts` | Remain **1** for first real use (no auto-retry storms) |
| Lease | Optional `lease_expires_at` column/field — **requires explicit migration ticket** if added; until then, operator detection via `running` + age |
| Heartbeat | **Not required** for short synchronous Pages execute |
| Stale running detection | Operator / Staging query: `status=running AND started_at < now()-N` |
| Reclaim | Manual ops tool or future ticketed reclaim API · must not double-call provider if result exists |
| Result present | **Re-execute forbidden** (B4 insert-only) |
| Retryable errors | Documented for future Phase H; **not auto-retried** in first real use |
| Non-retryable | auth · validation · blocked · output_invalid · budget |
| Duplicate provider call prevention | Conditional claim + result uniqueness + call counter in execution row/events |
| failRunning failure | Structured log with `execution_id` · alert ops · manual status repair runbook |
| Cron/Worker | **Not implemented** — detection may later be Agentic Cron (FREEZE Phase G) under separate approval |

---

## 13. Approval boundary

| Concept | Meaning |
| --- | --- |
| Gate `succeeded` | Summary generation + audit persist OK |
| Business approval | **Separate** · not granted by Gate success |
| Dashboard | Read-only display · no approve/send buttons (B5) |
| Diff & Approve | Future Phase E connection point: proposals reference `execution_id` + sanitized summary only |

First real use case = **view-only** after generation.

---

## 14. Privacy model

| Class | Examples | Provider? | Retention / display |
| --- | --- | --- | --- |
| public | none expected | n/a | n/a |
| internal | aggregated counts · opaque category keys | yes | audit metadata sanitized · Dashboard OK |
| personal | user ids, emails | **no** (opaque or omit) | avoid logs |
| sensitive | message bodies · auth material | **prohibited** | never |
| prohibited | secrets · full payment · unrestricted dumps | **prohibited** | never |

Principles: counts first · opaque IDs · no raw content to provider · never trust stored text as instructions (prompt injection).

---

## 15. Threat model (minimum)

| Threat | Prevention | Detection | Containment | Recovery |
| --- | --- | --- | --- | --- |
| Prompt injection via stored content | Don’t send raw content; structured counts only | Output schema validation | Drop provider text on invalid schema | Fail closed / deterministic fallback flag |
| Malicious stored content | Collector allowlist · no free SQL | Collector errors | Staging-only | Disable flag |
| Oversized input | Hard size limits | Reject create/execute | — | — |
| Repeated execution | Idempotency + claim + max_attempts=1 | Duplicate events/metrics | 409 | Replay GET |
| Actor spoofing | Server JWT ops claims | Auth denials | 401/403 | — |
| Request ID guessing | Actor ownership on GET/execute | 403/404 | — | — |
| Cost exhaustion | Hard cap · call≤1 · stop flag | Cap blocks · SAFE-07 | Stop flag | Raise after review |
| Provider timeout | Timeout + failRunning | timeout code | — | Manual |
| Malformed JSON | Validate I/O | `output_invalid` | Don’t persist raw | Retry only manual |
| Hallucinated ops facts | Prefer counts in UI; label AI summary as non-authoritative | Ops review | Don’t auto-act | Human verify source counts |
| Sensitive output | Output redaction allowlist | Review events | Strip fields | Rotate if leaked |
| Log leakage | No tokens in logs/reports | Log review | Redact | — |
| Stale running orphan | Lease design / ops query | Status monitor | Manual repair | Runbook |
| Cross-environment | Staging detect · Production blocked | wrong_environment | — | — |
| Accidental Production enable | Fail closed · no Prod apply | Env checks | Stop | — |

---

## 16. Observability

- Gate events sequence (existing)  
- SAFE-06 usage event for provider calls (when wired)  
- Metrics: success/fail/blocked rates · latency · `provider_called` rate · cost · orphan running count  
- No prompt/response full text in audit (FREEZE permanent NO-GO)

---

## 17. Test strategy (future implementation tickets)

1. Contract tests: allowlist · caps · redaction  
2. Collector unit: empty-safe · size bounds · no prohibited fields  
3. Provider adapter mock: 1-call · timeout · malformed · cost  
4. Executor: claim · no double provider · result insert-only · orphan logging  
5. API: ops-only · Staging-only · Production block  
6. Dashboard: still no page-load execute  
7. Idempotency JST boundaries · actor isolation  
8. SAFE-06/07 linkage tests without double write  

No live Production tests.

---

## 18. Rollout stages (design)

| Stage | Content |
| --- | --- |
| C0 | **This design freeze** (docs only) |
| C1 | Collector allowlist + fixtures → Staging read counts (no provider) |
| C2 | Provider adapter behind flag · mock/staging key · Gate execute explicit |
| C3 | SAFE-06/07 record · hard cap verification |
| C4 | Limited ops dogfood · Dashboard read  
| C5 | Evidence report · only then consider broader Staging |

Each stage requires **explicit human instruction**. Cron still NO-GO until Phase G.

---

## 19. Rollback

1. Feature flag off · emergency stop  
2. Force deterministic path / disable provider  
3. Dashboard continues read-only of last sanitized results  
4. Do not DROP audit tables casually  

---

## 20. Exit criteria (design freeze)

Design freeze is **accepted** when:

- [x] Exactly one use case selected with reject list  
- [x] Request / result / provider interface specified without implementing  
- [x] Cost · retry/orphan · approval · privacy · threats documented  
- [x] Non-goals include no provider connect / no apply / no send  
- [ ] Human marks this document **Design Freeze Approved** (separate explicit instruction)

**Implementation must not start** until Design Freeze Approved + scoped implementation ticket.

---

## Appendix A — Existing architecture citations

| Layer | Path / doc |
| --- | --- |
| Freeze | `docs/AI/AI_EXECUTION_GATE.md` §0.1 · §16 |
| B plan slice | `docs/AI/AI_EXECUTION_GATE_PHASE_B_PLAN.md` L7 · §6 · §15 |
| B1 caps | `deploy/cloudflare/functions/_shared/ai-exec-gate-capabilities.mjs` |
| B4 fixture | `.../ai-exec-gate-ops-collector.mjs` · `.../ai-exec-gate-report-generator.mjs` |
| B5 no execute | `admin-ai-exec-gate-client.js` |
| B6 verdict | `reports/ai-exec-gate-phase-b6-integration-evidence.md` |
| AD-010 | `docs/DECISIONS.md` · secretary DeepSeek Function |
| SAFE-06/07 · SAFE-17 | `docs/AI/TASFUL_AI_SAFE_OPS_FOUNDATION.md` |

## Appendix B — Explicitly unimplemented now

provider connection · API keys · SDK · MCP · Cron · Worker · Queue · send · approve · Staging apply · Production apply · Dashboard auto-execute · FREEZE text amendment
