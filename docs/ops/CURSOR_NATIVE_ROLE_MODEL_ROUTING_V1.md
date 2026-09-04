# Cursor-native ROLE → MODEL Routing V1

**Status:** Canonical routing overlay on Control Plane / Closed Loop / 3BOT  
**Runtime:** Local Windows Cursor only  
**Engine:** NO · **Product model router:** NO · **Automatic fallback:** DENY  
**ChatGPT Web Local Relay:** SUPERSEDED_BY_CURSOR_NATIVE_MULTI_MODEL

## Authority

The Control Plane / this routing SSOT decides which **role** is invoked and which Cursor-native **model slug** that role may use.

Individual agents must not:

- change their assigned provider/model
- select fallback providers
- start a new role
- start a new ACTIVE_TASK
- bypass Human Gate
- invoke direct OpenAI / Anthropic / Gemini / xAI / OpenRouter APIs
- use Cloud Agent or ChatGPT Web / browser LLM relay

ROLE != PROVIDER. Cursor models are providers, not extra BOTs.

Catalog: `scripts/lib/tasful-cursor-native-role-model-routing.mjs`

## Canonical table (this local Cursor Task allowlist, 2026-09-04)

| Role | Cursor-native model / executor |
| --- | --- |
| SOFTWARE_BUILDER | `cursor-grok-4.6-high` |
| PLANNER_REVIEWER | `gpt-5.6-sol-medium` |
| INDEPENDENT_JUDGE | `claude-sonnet-5-thinking-high` |
| SECOND_OPINION_RED_TEAM | `gemini-3.1-pro` |
| RESEARCHER | `cursor-grok-4.6-high` |
| DETERMINISTIC_VERIFIER | TASFUL local scripts / tests / Playwright · **no LLM authority for machine facts** |

Gemini slug was **discovered** from this session’s Cursor Task `model` allowlist (`gemini-3.1-pro`). Do not bind `gemini-3.7-flash-high` to SECOND_OPINION_RED_TEAM.

If the assigned slug is unavailable: return `MODEL_UNAVAILABLE`. Control Plane may retry only if transient and still the same assigned slug. V1 has **no** pre-authorized fallback table. Otherwise HUMAN_GATE. Silent substitution is forbidden.

## SECOND_OPINION_RED_TEAM

Not mandatory every iteration. Invoke only when policy flags justify it (architecture, Reviewer/Judge disagreement, security, major regression risk, repeated FIXABLE, explicit Human request). Output is advisory until Control Plane authorization.

## ChatGPT Web Local Relay

**CHATGPT_WEB_LOCAL_RELAY: SUPERSEDED_BY_CURSOR_NATIVE_MULTI_MODEL**

Cursor-native multi-model handoff removed Human copy/paste without browser auth, Cloud Agent, or direct paid APIs. Historical evidence is retained. Do not resume its HUMAN_GATE.
