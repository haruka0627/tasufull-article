# Cursor-native Multi-model Closed Loop V1

**Status:** Overlay on existing Control Plane / Closed Loop / 3BOT  
**Runtime:** Local Windows Cursor only  
**Engine:** NO · **4th BOT:** NO · **ChatGPT Web relay:** DENY · **Cloud Agent:** DENY · **Direct paid LLM APIs:** DENY

## Authority

TASFUL Control Plane remains authoritative for ACTIVE_TASK, scope, Human Gate, retry, circuit breaker, evidence, and next-task prohibition.

Cursor models are **providers**, not extra BOTs.

| Role | 3BOT map | Cursor-native provider (this environment) |
| --- | --- | --- |
| Builder | EXECUTOR | Main Agent · `cursor-grok-4.6-high` |
| Reviewer | QA semantic overlay | Task `review-agent` · `gpt-5.6-sol-medium` |
| Independent Judge | QA independent verifier | Task `review-agent` (separate context) · `claude-sonnet-5-thinking-high` |

Deterministic tests remain factual authority. Reviewer/Judge output is untrusted until Control Plane authorization.

`.tasful/control-plane/` and `.tasful/executors/` are **absent on CURRENT HEAD**. Reuse:

- `scripts/lib/ai-control-plane-parallel-agent-contract.mjs`
- `scripts/lib/closed-loop-contract.mjs` (`SAME_CAUSE_RETRY_MAX = 1`)
- `scripts/lib/tasful-3bot-operating-model-contract.mjs` (`QA_VERDICTS`, `routeAfterQa`)
- Cursor `Task` tool as the native subagent Provider (Control Plane SSOT already names it)

Do not use ChatGPT Web, Cloud Agent (`environment=cloud`), or `CURSOR_API_KEY` / OpenAI / Anthropic / Gemini / xAI / OpenRouter direct APIs.

## Dispatch

Programmatic handoff in this V1 is the **in-session Cursor Task tool** with an explicit `model` slug. That is Cursor-native. It is not a browser relay and not a new dispatcher product.

If Task cannot reach a selected model: fail-closed. Do not invent an API bridge.

Canonical ROLE → MODEL table: [CURSOR_NATIVE_ROLE_MODEL_ROUTING_V1.md](./CURSOR_NATIVE_ROLE_MODEL_ROUTING_V1.md)

## Verdicts

`PASS` · `FIXABLE` · `HUMAN_GATE` · `FAIL`

FIXABLE → Control Plane `routeAfterQa` → same ACTIVE_TASK Builder correction → deterministic verify → Judge.
