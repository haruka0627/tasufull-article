# TASFUL AI Core — Phase 8 Final Integration Report

**Status:** **CONDITIONAL PASS (Staging paused)**  
**Scope:** Static final-integration verification only. No Staging, Production, migration, or provider operation was performed.

---

## Start state

- Git start: `HEAD` was `7cbae61`; branch `cf-pages-deploy`; staged files: `0`.
- Approximately 800 pre-existing dirty/unrelated files were preserved. This phase edits only its report, AI documentation, Phase 8 static tests, and the requested static-output mirrors.

## Route inventory

| Route class | Final-integration result |
| --- | --- |
| Workspace Chat / Gateway | JWT-bearing Edge calls; Manual selection is honored and does not silently fall back. |
| Workspace quota / plan | Feature and quota entrypoints are fail-closed when the usage guard is unavailable. |
| OCR / Vision / Character | Authenticated guard coverage retained; Character analysis records usage once. |
| Media / Search / TTS | Authenticated feature guard coverage retained; Media records usage once. |
| OpenRouter PoC | Isolated from general Workspace UI and normal Gateway routing. |
| Voice Live | Separate surface boundary; not a Workspace release blocker while flags are OFF. |

## Integration matrix summary

| Concern | Static result | Live result |
| --- | --- | --- |
| Gateway token propagation | PASS — `resolveAccessToken()` and `accessToken \|\| anonKey` are present | Pending Staging |
| Manual model policy | PASS — deny is retained as `plan_model_denied`; provider fallback excludes Manual | Pending Staging |
| Workspace remote behavior | PASS — chat requests prefer remote and guard failures do not silently use mock success | Pending Staging |
| Quota enforcement | PASS — `enforceWorkspaceQuotaEntry` and `enforceAiUsageGuard` fail closed with `usage_guard_unavailable` | Pending Staging |
| Usage observability | PASS — Media and Character use `createUsageLogOnce()` | Pending Staging DB / log inspection |
| UI terminology | PASS — settings use “テキスト利用枠” | Pending browser validation |
| OpenRouter isolation | PASS — absent from `ai-workspace.html` | PoC only; not a Workspace route |

## Fixes applied in Phase 8

- Gateway honors explicit Manual deny decisions.
- Gateway uses JWT from `resolveAccessToken()` for `postEdge`; anonymous key remains only the fallback transport credential.
- Provider fallback is disabled for Manual selections; it cannot silently substitute another provider/model.
- Workspace chat uses `preferRemote`; a remote failure does not silently return a mock completion.
- `enforceWorkspaceQuotaEntry` is fail-closed with `usage_guard_unavailable`.
- Media generation and Character Vision analysis use `createUsageLogOnce()` for request-local usage-log idempotency.
- Usage gauge/settings copy identifies the quota as **“テキスト利用枠”**.

## Boundaries and retained code

- **OpenRouter isolation:** OpenRouter remains a limited PoC, excluded from `ai-workspace.html`, normal Workspace model lists, and normal Gateway routing.
- **Voice Live boundary:** Voice Live is not a Workspace blocker while its feature flags are OFF. If enabled, `VOICE_REALTIME_REQUIRE_JWT=1` is required before live use.
- **Dead code retained and documented:** GCV integration is absent; the dual TTS Edge paths remain; OpenRouter PoC remains retained for its isolated test harness. None is promoted to a general Workspace route by this phase.

## Staging status and next gate

Staging live verification is pending because Staging is paused. Do **not** run the live checklist while paused, and do not perform Production operations.

**Next:** Phase 9 — Staging Live Verification, following `docs/AI/TASFUL_AI_STAGING_LIVE_CHECKLIST.md`.

