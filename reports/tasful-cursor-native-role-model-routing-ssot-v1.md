# TASFUL Cursor-native ROLE → MODEL Routing SSOT V1

**ACTIVE_TASK:** `TASFUL_CURSOR_NATIVE_ROLE_MODEL_ROUTING_SSOT_V1`  
**ORIGINAL_MEMO_ID:** `N/A_CHAT_PASTED`  
**Date:** 2026-09-04

CURRENT_HEAD_BEFORE: `b1dbe803d067689c37851c5d475aae0b0ff3ec42`  
FINAL_HEAD: `95b6459`  
BRANCH: `cf-pages-deploy`

SOFTWARE_BUILDER_MODEL: `cursor-grok-4.6-high`  
PLANNER_REVIEWER_MODEL: `gpt-5.6-sol-medium`  
INDEPENDENT_JUDGE_MODEL: `claude-sonnet-5-thinking-high`  
SECOND_OPINION_RED_TEAM_MODEL: `gemini-3.1-pro`  
RESEARCHER_MODEL: `cursor-grok-4.6-high`  
DETERMINISTIC_VERIFIER: TASFUL_LOCAL_TOOLING

GPT_REAL_HANDOFF: PASS_FROM_PRIOR_E2E  
CLAUDE_REAL_JUDGE: PASS_FROM_PRIOR_E2E  
GEMINI_REAL_PROBE: PASS  

ROLE_MODEL_ROUTING: PASS  
MODEL_SUBSTITUTION_FAIL_CLOSED: PASS  
HUMAN_COPY_PASTE_REQUIRED: NO  
CHATGPT_WEB_LOCAL_RELAY: SUPERSEDED  
CLOUD_AGENT_USED: NO  
DIRECT_PAID_API_CALLS: 0  
DIRECT_PAID_API_COST: JPY 0  
PRODUCTION_CHANGED: NO

## Discovery

Gemini 3.1 Pro slug was taken from this local Cursor session Task tool allowlist, not guessed:

`inherit` · `claude-sonnet-5-thinking-high` · `composer-2.5` · `composer-2.5-fast` · `cursor-grok-4.6-high` · **`gemini-3.1-pro`** · `gemini-3.7-flash-high` · `gpt-5.6-sol-medium`

`gemini-3.7-flash-high` is a different model and is **not** bound to SECOND_OPINION_RED_TEAM.

Real probe: [Gemini Second Opinion](a4f9f377-fc48-4364-9bec-04d2f9056d82) · `STATUS: PASS` · `SOURCE_MUTATED: NO` · separate Task context.

## Policy

- Automatic provider fallback: DENY (empty `PREAUTHORIZED_FALLBACKS`)
- `MODEL_UNAVAILABLE` → HUMAN_GATE unless same-slug transient retry
- Agents cannot self-select model, role, or ACTIVE_TASK
- DETERMINISTIC_VERIFIER has no LLM authority for machine facts
- SECOND_OPINION_RED_TEAM is not mandatory every iteration

## QA

- `node scripts/test-cursor-native-role-model-routing-v1.mjs` PASS 33/33
- `node scripts/test-cursor-native-multi-model-closed-loop-v1.mjs` PASS 23/23
- `node scripts/test-ai-control-plane-parallel-agent-v1.mjs` PASS 57/57
- `node scripts/test-tasful-3bot-operating-model-v1.mjs` PASS 91/91

## Commit note

Scoped commit of overlay / routing SSOT / tests / evidence only.  
Not committed (mixed dirty): `package.json` · `docs/TODO.md` · `docs/PROJECT_STATUS.md` · `docs/CHANGELOG.md` (updated in working tree). npm scripts remain runnable via `node scripts/test-*.mjs`.

FINAL_VERDICT: PASS

ORIGINAL_MEMO_STATUS: COMPLETE_CANDIDATE (chat-pasted; no October vault delete)
