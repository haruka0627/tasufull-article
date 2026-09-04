# TASFUL Cursor-native Multi-model Closed Loop V1

**ACTIVE_TASK:** `TASFUL_CURSOR_NATIVE_MULTI_MODEL_CLOSED_LOOP_V1`  
**ORIGINAL_MEMO_ID:** `N/A_CHAT_PASTED`  
**Date:** 2026-09-04

CURRENT_HEAD_BEFORE: `b1dbe803d067689c37851c5d475aae0b0ff3ec42`  
FINAL_HEAD: working tree overlay (not committed)  
BRANCH: `cf-pages-deploy`

LOCAL_WINDOWS_ONLY: YES  
CLOUD_AGENT_USED: NO  
CHATGPT_WEB_RELAY_USED: NO

CURSOR_NATIVE_SUBAGENT_AVAILABLE: YES  
Dispatch path: in-session Cursor `Task` tool with explicit `model` slug. Not Cloud Agent. Not `@cursor/sdk` / `CURSOR_API_KEY`. Not ChatGPT Web.

BUILDER_MODEL: `cursor-grok-4.6-high` (Main Agent)  
REVIEWER_MODEL: `gpt-5.6-sol-medium` (Task `review-agent`)  
JUDGE_MODEL: `claude-sonnet-5-thinking-high` (Task `review-agent`, new conversation)

REVIEWER_SEPARATE_CONTEXT: YES — [GPT Reviewer](2ff3a094-fa1c-4dc9-897d-2cca4025fb96)  
JUDGE_SEPARATE_CONTEXT: YES — [Claude Judge](2c0b75dd-3a5f-4a34-ae7e-e13621d9c371)  
BUILDER_JUDGE_PROVIDER_SEPARATION: YES (Grok Builder ≠ Claude Judge)

REAL_MULTI_MODEL_HANDOFF: PASS  
CONTROL_PLANE_REAUTHORIZATION: PASS  
HUMAN_COPY_PASTE_REQUIRED: NO  
FIXABLE_AUTO_LOOP: PASS  
DETERMINISTIC_VERIFICATION: PASS  
INDEPENDENT_JUDGE: PASS

DIRECT_PAID_API_CALLS: 0  
DIRECT_PAID_API_COST: JPY 0  
CURSOR_USAGE: REPORT_ACTUAL_PATH — Cursor IDE Task subagents (`gpt-5.6-sol-medium`, `claude-sonnet-5-thinking-high`) on local Windows. Plan/metering of Cursor usage is Cursor-side; no TASFUL direct token API.

PRODUCTION_CHANGED: NO

## CURRENT HEAD audit

`.tasful/control-plane/` and `.tasful/executors/` are **absent**. Reused:

- `scripts/lib/ai-control-plane-parallel-agent-contract.mjs` (57/57)
- `scripts/lib/closed-loop-contract.mjs` (`SAME_CAUSE_RETRY_MAX = 1`)
- `scripts/lib/tasful-3bot-operating-model-contract.mjs` `QA_VERDICTS` + `routeAfterQa` (91/91)
- Cursor `Task` as the existing subagent Provider named in Control Plane SSOT
- Existing readonly `review-agent` type for Reviewer and Judge (ROLE ≠ extra BOT; models are providers)

Denied: ChatGPT Web / local UI relay, Cloud Agent, direct OpenAI/Anthropic/Gemini/xAI/OpenRouter APIs.

## Harmless real loop

1. Builder wrote `reports/ops/cursor-native-multi-model/probe-state.json` with `ack: false`
2. GPT Reviewer returned structured `FIXABLE` (no Human copy/paste)
3. Control Plane authorized + `routeAfterQa` → `FIXABLE_AUTO_RETURN`
4. Builder applied `ack: true` only
5. Deterministic tests PASS 23/23
6. Claude Judge (separate context) returned `STATUS: PASS` after re-running the three test commands

## Regression

- `npm run test:cursor-native-multi-model-closed-loop-v1` → PASS 23/23
- `npm run test:ai-control-plane-parallel-agent-v1` → PASS 57/57
- `npm run test:tasful-3bot-operating-model-v1` → PASS 91/91

FINAL_VERDICT: PASS

ORIGINAL_MEMO_STATUS: COMPLETE_CANDIDATE (chat-pasted spec; no October vault memo deleted)
