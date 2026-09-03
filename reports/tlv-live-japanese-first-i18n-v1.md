# TLV LIVE Japanese-First UI + Language Switch Foundation

**ACTIVE_TASK:** TLV LIVE Japanese-First UI + Language Switch Foundation  
**Date:** 2026-09-04  
**HEAD (start):** `66a08bf`  
**PRODUCTION_CHANGED:** NO  

## TLV_LIVE_JAPANESE_FIRST_I18N_CLOSEOUT

| Field | Result |
| --- | --- |
| CURRENT_HEAD | `66a08bf` (uncommitted i18n overlay on working tree) |
| DEFAULT_LANGUAGE | Japanese (`ja-JP`) |
| SUPPORTED_LANGUAGES | `ja-JP`, `en` (selector). Shared TASFUL store also knows `ko-KR` / `zh-TW`; Go Live displays Japanese until those dicts exist, without overwriting storage |
| LANGUAGE_SELECTOR | Header top-right `<select data-sv-ui-locale>` · 日本語 / English · visible on Desktop and 390 |
| LANGUAGE_PERSISTENCE | Reuses `tasful.shortVideo.uiLocale` via `TasuShortVideoI18n` (no TLV-only store) |
| JA_UI_COMPLETENESS | PASS for public Go Live chrome (nav, devices, preview, scene labels, VTuber, VRoid Hub, START/STOP, permission, errors) |
| EN_UI_COMPLETENESS | PASS (JA/EN key parity, no duplicate keys) |
| UNTRANSLATED_USER_VISIBLE_STRINGS | Telemetry abbreviations kept (LATENCY / BITRATE / FPS). Proper nouns kept (TLV, VRoid Hub, VRM, LiveKit, TASFUL, Beauty, VTuber). Dev/PoC panels (`?tlvLiveKitPoc=1`, `?tlvBeautyPoc=1`, SNOW) left in English/codes by design |
| TECHNICAL_CODES_USER_VISIBLE | PASS — `UNKNOWN_FAIL_CLOSED` / `BLOCKED_LIVEKIT_CREDENTIALS` mapped to natural copy; codes stay on return objects / logs |
| DESKTOP_QA | PASS · HTTP 200 · 1280 Playwright · default JA · EN switch · reload persist · switch-back JA |
| MOBILE_390X844_QA | PASS · selector not clipped · no horizontal overflow · sticky CTA intact |
| CAMERA_REGRESSION | PASS_STATIC — device selectors / preview / permission copy only; pipeline unchanged |
| VIRTUAL_CAMERA_REGRESSION | PASS_STATIC — still any `videoinput`; no device filter change |
| USER_VRM_REGRESSION | PASS — Hub 47/47 · blob lifecycle 37/37 · user VRM upload control intact |
| VROID_HUB_REGRESSION | PASS 47/47 · OAuth / License Gate / START LIVE revalidate unchanged |
| SCENE_REGRESSION | PASS_STATIC — Scene editor still uses `TasuTlvGoLiveLabelsJa.t`; LiveKit formal scripts preserved |
| LIVEKIT_START_STOP_REGRESSION | PASS_STATIC — `startHost` / stop / reconnect contracts PASS |
| RUNTIME_ERRORS | pageerror 0 (Playwright). Known pre-existing console: missing `tlv-snap-effects.config.local.js` 404 |
| INDEPENDENT_JUDGE | PASS (`scripts/judge-tlv-golive-i18n-v1.mjs`) |
| VERDICT | **PASS** |
| ORIGINAL_MEMO | NOT_FOUND in `１０月までにやるもの` (filename scan only; `ID　パス系` not read). Implementer status **COMPLETE_CANDIDATE** is not asserted against a live memo. No deletion |

## First-language rule

1. If `tasful.shortVideo.uiLocale` is `en` → English  
2. If stored is `ja-JP` or missing → Japanese  
3. If stored is `ko-KR` / `zh-TW` → display Japanese on Go Live, do not overwrite until the user picks 日本語 or English  
4. Browser `Accept-Language` / `navigator.language` never auto-switches to English  

## Implementation

- `live/tlv-go-live-labels-ja.js` — JA+EN dict, `registerDict` into `TasuShortVideoI18n`, selector (ja/en only), `userMessage(code)`  
- `one-tlv-go-live.html` — `lang="ja"`, Japanese first paint, `data-i18n`, header selector, `data-tlv-go-live-cta`  
- `one-tlv-go-live-data-adapter.js` / `one-tlv-go-live-service.js` / `one-tlv-vroid-hub-client.js` — user copy via `t()` / `userMessage()`  
- Dist copy only (`Copy-Item`). 8788 was ALIVE; not restarted. `build:pages` not run  

## QA commands

```
node scripts/test-tlv-golive-i18n-v1.mjs
node scripts/judge-tlv-golive-i18n-v1.mjs
node scripts/test-tlv-broadcaster-ux-v1.mjs
node scripts/test-tlv-vroid-hub-v1.mjs
node scripts/test-tlv-vtuber-vrm-blob-lifecycle-v1.mjs
node scripts/verify-tlv-livekit-formal-migration-v1.mjs
node scripts/verify-tlv-livekit-formal-reconnect-v1.mjs
```

## Human visual (isolation)

Cursor IDE Browser not used. Confirm in external Chrome:

- http://127.0.0.1:8788/one-tlv-go-live.html  
- Desktop 1280 and Mobile 390×844  

## FINDINGS

1. Dev/PoC docks (LiveKit PoC, Beauty/SNOW PoC) remain English + capability codes. Hidden unless QA query flags.  
2. Stream Health telemetry labels (LATENCY/BITRATE/FPS) kept as technical abbreviations.  
3. Scene overlay labels refresh on next Scene action after language switch (uses `t()` at render).  
4. Pre-existing 404 for `tlv-snap-effects.config.local.js` (optional local Snap config).  

## Constraints honored

- Production unchanged  
- No TLV feature/spec change  
- No pricing change  
- No VRoid Hub OAuth/License redesign  
- No LIVE pipeline change  
- Beauty rationalization not mixed in  
- No next ACTIVE_TASK started  
