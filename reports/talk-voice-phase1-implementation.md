# TALK Voice Phase 1 — Implementation

**Date:** 2026-07-26  
**Start HEAD:** `65e1a6c`  
**Scope:** Extract `talk-voice-core` · WebRTC adapter · permissions · session usage foundation  
**Provider switch:** NOT PERFORMED  
**Production Deploy / Push:** NOT PERFORMED

---

## Verdict

```text
TALK Voice Phase 1:
PASS WITH FOLLOW-UP

Voice Core: PASS
Current WebRTC Adapter: PASS
Thread Permission: PASS
Voice Session Lifecycle: PASS
Usage Tracking: PASS (server compute + heartbeat helpers)
Entitlement Foundation: PASS (legacy_unmetered default · fail-closed when enforced)
Browser Voice Fixture: PASS (module + wiring smoke · full STRICT WebRTC E2E optional)
Provider Migration Foundation: READY
```

### Existing unrelated blockers

- REL-P0-01 unclean tree  
- REL-P0-02 TLV Payment ops  
- REL-P0-03 AI 秘書 Production secret  
- REL-P0-04 Production alias undeployed  

---

## 1. Code map (pre-change)

| Layer | Entry |
| --- | --- |
| UI | `talk-home.html` call button · `talk-call-ui.js` overlay |
| Control | `scripts/talk-call-service.js` · `talk-call-webrtc.js` |
| Signaling | `talk-call-signaling.js` → `talk_call_sessions` / `talk_call_signals` |
| Gap found | **talk-call scripts were not loaded by talk-home.html** (modules existed under `scripts/` only) — restored wiring in this phase |

---

## 2. Core structure

```text
scripts/talk-voice-core/
  errors.js
  state-machine.js
  permissions.js
  entitlement.js
  usage.js
  provider-interface.js
  webrtc-adapter.js
  index.js
```

### Provider interface

`initialize` · `createOutgoingConnection` · `acceptIncomingConnection` · `applyRemoteDescription` · `addIceCandidate` · `setMuted` · `getConnectionState` · `disconnect` · `dispose`  
Events: `onLocalSignal` · `onRemoteTrack` · `onConnected` · `onDisconnected` · `onReconnecting` · `onError`

### State machine

`idle` · `authorizing` · `ringing_outgoing` · `ringing_incoming` · `connecting` · `connected` · `reconnecting` · `ending` · `ended` · `failed`

### Entitlement defaults (preserve existing calls)

| Key | Default |
| --- | --- |
| `voice_feature_enabled` | `true` |
| `voice_entitlement_enforced` | `false` → `legacy_unmetered` |
| When enforced + no limits | `configuration_unavailable` (**deny**) |

Config: `window.TASU_TALK_VOICE_CONFIG`

---

## 3. Session / usage

- Existing table `talk_call_sessions` remains SSOT  
- Optional columns (migration, not Production-applied):  
  `sql/talk-voice-phase1-session-usage.sql`  
  → `provider` · `last_heartbeat_at` · `duration_seconds` · `billable_seconds` · `end_reason` · `session_limit_seconds`  
- Client `duration` ignored · server computes from `started_at`/`ended_at`  
- Heartbeat interval ~45s · `reconcileStaleSessions()` for tests/ops (no cron)

---

## 4. UI wiring (allowlist addition)

| File | Why |
| --- | --- |
| `talk-home.html` | Load core + call scripts + CSS |
| `talk-line-room.js` | Call button enable + `initiateCall` · `getActiveThread` |

---

## 5. Tests

| Command | Result |
| --- | --- |
| `node scripts/test-talk-voice-core.mjs` | **31/31 PASS** |
| `node scripts/test-talk-voice-webrtc-adapter.mjs` | **8/8 PASS** |
| `node scripts/test-talk-voice-browser-smoke.mjs` | Desktop/Mobile module + button wiring |
| `test-talk-call-turn-config.mjs` | ALL PASS |
| `test-phase3a-api-auth-guards.mjs` | 34/34 |
| `test-tasful-ai-final-phase.mjs` | 31/31 |
| `test-platform-finish-phase.mjs` | 38/38 |
| `test-platform-next-phase.mjs` | 37/37 |
| `test-platform-live-zego-adapter-phase1.mjs` | 77 PASS |
| `verify-live-zego-poc.mjs` | 29 PASS |

Full dual-browser WebRTC (`SUPABASE_STRICT=1`) remains Staging-fixture dependent — prior timeout on wrong BASE (8765) noted; smoke uses **8788**.

---

## 6. Rollback

1. Keep WebRTC adapter as default (`TasuTalkVoiceWebRtcAdapter.getDefault`)  
2. Revert service to direct WebRtc calls if needed  
3. Drop optional columns via migration rollback notes  
4. No Production deploy in this phase  

---

## 7. Next Phase

1. Apply usage migration on Staging  
2. Edge JWT gate for session create (optional hardening)  
3. STRICT 1:1 fixture E2E on 8788  
4. Extract signaling into talk-voice-core/session store  
5. Provider switch only after REL-P0 + metering product rules  
