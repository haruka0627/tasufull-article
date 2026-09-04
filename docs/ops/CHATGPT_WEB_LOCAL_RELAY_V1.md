# ChatGPT Web Local Human Relay V1

**Status:** SUPERSEDED_BY_CURSOR_NATIVE_MULTI_MODEL  
**Canonical successor:** [CURSOR_NATIVE_MULTI_MODEL_CLOSED_LOOP_V1.md](./CURSOR_NATIVE_MULTI_MODEL_CLOSED_LOOP_V1.md) · [CURSOR_NATIVE_ROLE_MODEL_ROUTING_V1.md](./CURSOR_NATIVE_ROLE_MODEL_ROUTING_V1.md)  
**Do not resume HUMAN_GATE.** Historical evidence is retained.

## Authority

ChatGPT Web is an untrusted semantic worker. It is not the Control Plane.

Existing TASFUL Control Plane / Closed Loop / Relay validation remain authoritative for ACTIVE_TASK, scope, Human Gate, permission, retry, circuit breaker, evidence, and next-task prohibition.

## Runtime

| Item | Value |
| --- | --- |
| Cloud Agent | DENY |
| Paid direct LLM APIs | DENY (`api.openai.com` and peers) |
| Cookie / token export | DENY |
| Unofficial `backend-api` with stolen session | DENY (`chatgpt_web`, `chatgpt_cookie`, `chatgpt_unofficial_backend` remain blocked) |
| Allowed destination | `chatgpt_web_local_ui` (L0/L1 Abstract Package only) |
| Browser | Local headed Playwright persistent profile (`%USERPROFILE%\.tasful-local\chatgpt-web-relay-profile`) · `channel: chrome` · `chromiumSandbox: true` (Playwright otherwise injects `--no-sandbox`) |

`.tasful/control-plane/` and `.tasful/executors/` are **not present on CURRENT HEAD**. This overlay reuses:

- `scripts/lib/ai-control-plane-parallel-agent-contract.mjs`
- `scripts/lib/closed-loop-contract.mjs`
- `scripts/lib/cursor-gpt-relay-bridge.mjs` (`validateGptOutput`, lanes, Abstract Package)
- `scripts/lib/tasful-external-transmission-policy-v1.mjs`
- Persistent-context pattern from `scripts/qa-tlv-vroid-hub-real-oauth-resume-v1.mjs`
- Local ChatGPT worker uses `playwright` `chromium.launchPersistentContext` directly (does **not** merge `HEADLESS_LAUNCH_ARGS` / `--no-sandbox`)

`ai-workspace-v0-conversation-adapter.js` is TASFUL AI Workspace, not ChatGPT Web. Do not fork it here.

## Judge

Deterministic machine checks are authoritative for envelope hash, ACTIVE_TASK binding, duplicate/stale, paid-API deny, and gates.

The same ChatGPT Web conversation is **not** an independent Judge.

`INDEPENDENT_JUDGE_RUNTIME: DEFERRED`

## Files

| Path | Role |
| --- | --- |
| `scripts/lib/tasful-chatgpt-web-local-relay.mjs` | Envelope, policy, reauthorization |
| `scripts/lib/tasful-chatgpt-web-local-browser.mjs` | Local headed UI worker |
| `scripts/test-chatgpt-web-local-relay-v1.mjs` | Unit QA |
| `scripts/run-chatgpt-web-local-relay-e2e.mjs` | One real local round trip |

```bash
npm run test:chatgpt-web-local-relay-v1
npm run e2e:chatgpt-web-local-relay-v1
```
