# TASFUL AI — Release Readiness

**Current decision:** **CONDITIONAL** — Phase 8 code/static integration passes; Staging is paused and Phase 9 live verification remains required.  
**Production operation is forbidden** until explicit human approval after Staging evidence is complete.

## Criteria

| Status | Meaning |
| --- | --- |
| **PASS** | Static and required Staging evidence are complete; no unresolved release blocker exists. |
| **CONDITIONAL** | Code evidence is complete, but a non-skippable environment gate (currently Staging live verification) is pending. |
| **BLOCKED** | A required environment, approval, credential, or dependency prevents validation. |
| **FAIL** | A security, policy, correctness, or regression check fails. |

## Current production-candidate list

These code paths are production candidates only after the Phase 9 gate:

- Gateway access-token forwarding, Manual deny handling, and Manual no-fallback behavior.
- Workspace remote-first chat behavior and no-silent-mock failure behavior.
- Workspace quota/usage guard fail-closed enforcement.
- Media and Character usage-log idempotency.
- Usage gauge/settings copy identifying **テキスト利用枠**.
- Existing isolated OpenRouter PoC and Voice Live boundaries, with their flags disabled unless separately approved.

## Known limitations

- Staging is paused; no live provider, JWT, quota, migration, or usage-event verification has been performed in this phase.
- GCV is absent.
- Dual TTS Edge implementations remain.
- OpenRouter is retained as an isolated PoC, not a general Workspace provider.
- Voice Live is outside Workspace scope. If it is enabled, `VOICE_REALTIME_REQUIRE_JWT=1` is mandatory.
- This document does not authorize Production migration, deployment, credential changes, or live provider activation.

## Blockers

**Code-side blockers:** none identified by the Phase 8 static suite.  
**Release gate:** Phase 9 Staging Live Verification is mandatory before production candidacy can be marked PASS.

## Non-blockers

- Dead-code/documentation retention for absent GCV, dual TTS Edge, and OpenRouter PoC.
- Voice Live while its flags remain OFF.
- UI wording change to “テキスト利用枠”.
- Existing unrelated dirty working-tree files; they are outside this phase and preserved.

## Phase 9 gate

When Staging is unpaused, execute and record every applicable item in [TASFUL_AI_STAGING_LIVE_CHECKLIST.md](./TASFUL_AI_STAGING_LIVE_CHECKLIST.md):

1. Staging DB/migration and read-only verification.
2. JWT, Manual-deny, and provider-path verification.
3. Quota fail-closed and usage-log idempotency verification.
4. Secret-exposure and guard-unavailable checks.
5. Latency baseline and guard-overhead evidence.

Any FAIL changes this readiness state to **FAIL**; any unmet prerequisite remains **CONDITIONAL** or **BLOCKED** until resolved.

