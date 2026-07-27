# AI Execution Gate — Phase B6 Integration Evidence

**Date:** 2026-07-28  
**Branch:** `cf-pages-deploy`  
**Starting HEAD:** `1fef729` (Phase B5)  
**Verdict:** `PASS_WITH_KNOWN_RISKS`  
**Runtime:** `http://127.0.0.1:8788` (Wrangler Pages Dev)  
**Production / Staging deploy:** not performed  
**Migration apply:** not performed  

> Tokens, passwords, Authorization values, and Production credentials are **not** recorded in this report.

---

## 1. Conclusion

```text
Phase B6: PASS_WITH_KNOWN_RISKS
```

Phase B vertical slice (B1–B5) is locally verified with suite PASS. Dashboard remains create→get only (no execute). Provider unconnected. Known risks listed in §17.

---

## 2. Starting state

| Item | Value |
| --- | --- |
| branch | `cf-pages-deploy` |
| HEAD | `1fef729` |
| B5 ancestor | yes |
| staged | 0 |
| unrelated dirty | ~1080 paths (untouched) |

Commits in scope:

```text
30a05f0 docs(ai): freeze execution gate Phase A design
6b92cad feat(ai): add Phase B1 execution gate contracts
d1a73f7 feat(ai): add Phase B2 execution audit schema
37f0ec6 feat(ai): add Phase B3 execution gate API
49f81cd feat(ai): add Phase B4 execution pipeline
1fef729 feat(ai): add Phase B5 operations dashboard
```

---

## 3. Phase B architecture summary

```text
B1 contracts (capabilities/action/service/ports/flag/stop/cap)
  → B2 audit tables (requests/events/results)
  → B3 create / get / execute route (ops JWT)
  → B4 deterministic pipeline (claim → collect → report → result)
  → B5 dashboard read (idempotent create → get; no page-load execute)
  → B6 evidence / suite (this document)
```

Fixed pipeline ports: `ops_collector` → `secretary_deepseek` (name only) → `gate_audit_writer`  
`provider_called=false` · `recorded_api_cost=0` · Staging-only Gate · Production fail-closed

---

## 4. B1 evidence

Command: `node scripts/test-ai-exec-gate-phase-b1-constants.mjs`  
Exit: **0** · asserts ≈68 · failures 0

Covers: capability/action/service/ports allowlist · env detection · flag · emergency stop · hard cap · preflight order · redaction.

---

## 5. B2 evidence

Command: `node scripts/test-ai-exec-gate-phase-b2-db.mjs`  
Exit: **0** · asserts ≈55 · failures 0

Covers: 3 tables only · no flag/stop tables · status/decision separation · parent null · event uniqueness · RLS deny-all · B1 reason codes in SQL.

Local migration: assumed applied for live DB probes (B3/B6). Production apply: **no**.

---

## 6. B3 evidence

Command: `node scripts/test-ai-exec-gate-phase-b3-api.mjs`  
Exit: **0** · asserts ≈80 · failures 0

Covers: ops claims · create validation · production blocked · idempotency · event failure 500 · execute stub history · live create/replay when service role present.

HTTP (8788): create no-auth → **401** `auth_required`; fake token → **401**; execute OPTIONS **204**; execute GET **405**.

---

## 7. B4 evidence

Command: `node scripts/test-ai-exec-gate-phase-b4-executor.mjs`  
Exit: **0** · asserts ≈73 · failures 0

Covers: atomic claim · concurrent loser · insert-only result · replay refusal · failure paths · timeout · provider absence · recorded cost 0.

B6 separation mock: dashboard GET leaves `queued`; only `executeGatePipeline` transitions to `succeeded` with `provider_called=false` and `recorded_api_cost=0`.

---

## 8. B5 evidence

Command: `node scripts/test-ai-exec-gate-phase-b5-dashboard.mjs`  
Exit: **0** · asserts ≈63 · failures 0

Covers: no `/execute` in client · textContent rendering · single-flight · JST key boundary · XSS text · assets HTTP 200.

---

## 9. Ops-auth UI E2E

### Real ops JWT (Supabase Auth ops user)

**Not minted / not stored.** No safe long-lived ops browser credential was used in this session.

### What was verified instead

1. **HTTP:** no token / invalid token → 401 (server-side auth)
2. **Claims unit:** `isOpsFromClaims` allow/deny
3. **Live DB service layer:** distinct actors · cross-actor GET **403** · same-key replay
4. **Playwright:** injected session object (redacted placeholder string) + **routed** Gate create/get fixtures  
   - Panel shows sanitized succeeded summary  
   - Network: Gate paths = create + get only · **no execute**  
   - Unauth context: Japanese auth message  
   - Screenshots: `reports/ai-exec-gate-phase-b6-desktop-1280.png`, `...-mobile-390.png`, `...-tablet-768-unauth.png` (no token UI)

### Limitation

End-to-end against live Supabase Auth ops JWT through Pages Functions was **not** completed with a real ops session. Client contract + server auth negative paths + actor isolation via service role cover the Gate boundary; remaining gap is “real ops cookie/session in browser → live create/get”.

---

## 10. Network evidence

| Path | Observation |
| --- | --- |
| Gate create | Called by dashboard client (idempotent) |
| Gate get | Called after create / preferGet refresh |
| Gate execute | **Not** called by dashboard |
| Provider hosts via Gate | **None** |
| Secretary `gemini-chat` | Pre-existing dashboard noise (unrelated to Gate panel) |

---

## 11. Idempotency evidence

| Case | Result |
| --- | --- |
| key length 7 / 201 | reject |
| key length 8 / 200 | accept |
| JST 23:59 vs 00:00 | day keys differ |
| actor A vs B | distinct keys / executions |
| same actor same day key | replay same `execution_id` |
| dashboard reload | no execute; server idempotent create |

---

## 12. Security evidence

- no token → 401 · invalid token → 401 · non-ops claims deny · ops claims allow  
- cross-actor get forbidden  
- no Authorization echo in JSON  
- client: no eval / Function / innerHTML · no execute path · no provider SDK  
- Production Gate env remains fail-closed in B1/B3 tests  

---

## 13. Sanitization evidence

GET `result` allowlist only:  
`summary` · `pending_total` · `provider_called` · `recorded_api_cost` · `output_type` · `completed_at` · `error_code`  

Omitted: `payload_hash` · `idempotency_key` · raw metrics · secrets · hard cap · stacks  
XSS fixture renders as text (no SCRIPT nodes).

---

## 14. Responsive evidence

| Viewport | Result |
| --- | --- |
| 1280×800 | panel visible · no horizontal overflow · screenshot saved |
| 390×844 | no horizontal overflow · screenshot saved |
| 768×1024 unauth | auth message · screenshot saved |

---

## 15. Regression tests

Suite: `node scripts/test-ai-exec-gate-phase-b-suite.mjs`  
Exit: **0** · 6/6 commands PASS

| Command | Exit | ≈PASS marks | FAIL |
| --- | --- | --- | --- |
| `node scripts/test-ai-exec-gate-phase-b1-constants.mjs` | 0 | 68 | 0 |
| `node scripts/test-ai-exec-gate-phase-b2-db.mjs` | 0 | 55 | 0 |
| `node scripts/test-ai-exec-gate-phase-b3-api.mjs` | 0 | 80 | 0 |
| `node scripts/test-ai-exec-gate-phase-b4-executor.mjs` | 0 | 73 | 0 |
| `node scripts/test-ai-exec-gate-phase-b5-dashboard.mjs` | 0 | 63 | 0 |
| `node scripts/test-ai-exec-gate-phase-b6-integration.mjs` | 0 | 80 | 0 |

Also: `node --check` on suite/integration scripts PASS.

---

## 16. Scope audit

**Allowed B6 artifacts:** suite · B6 integration test · this evidence · tickets status · screenshots/meta  

**Forbidden (confirmed absent from B6 change set):** migration · provider · MCP · Cron · Worker · Queue · FREEZE/PLAN meaning change · Production/Staging deploy · Dashboard execute feature  

Unrelated dirty tree: **not modified**.

---

## 17. Known risks

| Risk | Severity | Notes |
| --- | --- | --- |
| B4 `failRunning` transition miss → rare `running` orphan | non-blocking | Logged with `execution_id`; no B6 reaper |
| Real ops browser JWT E2E | gap | Injected session + route fixture used; no token mint |
| Production runtime evidence | not done | Local 8788 only |
| Provider cost control after future enablement | deferred | Currently `provider_called=false` · cost 0 |
| Secretary gemini CORS console noise on dashboard | unrelated | Pre-existing; not Gate panel |

---

## 18. Explicitly unimplemented

- provider connection · live inbox · approval · send  
- MCP · Cron · Worker · Queue  
- Dashboard execute · Production apply · Staging deploy  
- Phase C budget ledger · Diff & Approve · Self Correction  

---

## 19. Production status

**Not applied. Not deployed. Not production-ready claim.**  
Local integration evidence only (`PASS_WITH_KNOWN_RISKS`).

---

## 20. Final verdict

```text
PASS_WITH_KNOWN_RISKS
```

Phase B local vertical slice closed for evidence purposes. Next work requires explicit human instruction (e.g. Staging apply, real ops JWT E2E, or Phase C).
