# TALK Voice Server Migration Readiness

**Date:** 2026-07-26  
**Scope:** Audit only — **no provider switch · no Production change**  
**Prerequisite:** Phase 3-A P1 security unblock PASS  
**Local verify base:** `http://127.0.0.1:8788`

---

## Executive summary

TALK 1:1 音声通話の正本は **ブラウザ WebRTC（STUN/TURN）＋ Supabase Realtime シグナリング** です。  
**ZEGO は TALK 通話経路ではありません**（TLV / Platform Live 用）。  
次回の「通話サーバー切替」は、現状 WebRTC/TURN スタックを **provider-adapter** へ隔離したうえで、別 Provider または自前 SFU へ差し替える設計が妥当です。

**Verdict:** `READY`（可視化完了 · 実装切替は次 Phase）

---

## 1–3. Provider / SDK / token

| Item | Current |
| --- | --- |
| Provider | Native **WebRTC** (`RTCPeerConnection`) |
| Media | Audio-only（1:1） |
| Signaling | `scripts/talk-call-signaling.js` via Supabase Realtime |
| ICE | Google STUN default · optional TURN via `scripts/talk-call-ice-config.js` |
| SDK version | Browser built-in WebRTC（ZEGO SDK 不使用） |
| Token endpoint | **なし**（ZEGO token API は Live 専用 `/api/tlv-zego-token`） |

---

## 4–7. Room / user / auth / membership

| Item | Rule |
| --- | --- |
| Room ID | TALK thread / chat room id（`room_id` on call session） |
| User ID | Supabase auth subject via signaling `getMeId()` |
| Auth | Client session · signaling channel membership |
| Thread gate | `talk-call-service.js` rejects official / group / system threads for voice call |
| ZEGO room tokens | N/A for TALK · Live path now JWT + room_forbidden / fixture / owned / `live_broadcasts` |

---

## 8–14. Call lifecycle

| Step | Module / behavior |
| --- | --- |
| Start | `TasuTalkCallService` · caller creates session + WebRTC offer |
| Incoming | Signaling event · overlay via `talk-call-ui.js` |
| Answer | Callee accept · answer SDP |
| Reject | Decline signal · UI dismiss |
| Hangup | `leave` / dispose peer connection |
| Reconnect | Limited — ICE restart / re-offer patterns in WebRTC module; TURN improves NAT |
| Timeout | Ring timeout in `talk-call-service.js` |

Primary files:

- `scripts/talk-call-service.js`
- `scripts/talk-call-webrtc.js`
- `scripts/talk-call-signaling.js`
- `scripts/talk-call-ui.js`
- `scripts/talk-call-chat-detail.js`
- `scripts/talk-call-history.js`
- `scripts/talk-call-ice-config.js`
- `scripts/talk-call-notify-bridge.js`
- `scripts/talk-call-push-events.js`
- Docs: `docs/talk-call-turn-config.md`, `docs/talk-call-web-push-deploy.md`

---

## 15–17. Usage / free allowance / billing

| Concern | Status |
| --- | --- |
| Usage meter | **Not centralized** as a paid call-meter service in call modules |
| Free allowance | Product free/paid for TALK call minutes **not** enforced in `talk-call-*.js` |
| Billing boundary | Push/VAPID/TURN ops exist; **call-minute entitlement is a migration blocker** if Provider introduces per-minute cost |

**Blocker for paid Provider switch:** define TASFUL-owned entitlement + meter **before** wiring a metered media Provider.

---

## 18–25. Secrets / env / Functions / DB

| Layer | Notes |
| --- | --- |
| Secrets | TURN username/credential may be injected to client (documented as non-secret-but-protected) · VAPID keys for push |
| Env | `TASU_TALK_CALL_CONFIG` / `TASFUL_TURN_*` · see turn config doc |
| Functions | Talk push / notify Functions (not ZEGO) |
| Tables | Call history / sessions via existing TALK / notification paths · Supabase Realtime channels |
| RLS | Thread membership must remain source of truth for who can signal |
| Production | TURN production checklist in `docs/talk-call-turn-production-checklist.md` |
| Staging / local | 8788 wrangler · STUN-only OK for local |

---

## 26–28. Failover / rollback / monitoring

| Item | Notes |
| --- | --- |
| Failover | STUN-only fallback when TURN missing |
| Rollback | Keep WebRTC modules; feature-flag any new adapter |
| Monitoring | Connection summary helpers · no full APM for call QoS yet |

---

## 29–33. Switch targets / compatibility / order / blockers / next Phase

### Provider switch candidate files

```text
scripts/talk-call-service.js
scripts/talk-call-webrtc.js          ← isolate as provider-adapter
scripts/talk-call-signaling.js
scripts/talk-call-ice-config.js
scripts/talk-call-ui.js
scripts/talk-call-chat-detail.js
scripts/talk-call-history.js
scripts/talk-call-notify-bridge.js
scripts/talk-call-push-events.js
docs/talk-call-turn-*.md
```

**Do not** reuse `/api/tlv-zego-token` for TALK without a dedicated talk voice token Function and thread-membership checks.

### Recommended adapter shape (next Phase)

```text
talk-voice-core
├─ auth
├─ permission (thread participants)
├─ room / session
├─ usage / entitlement
└─ provider-adapter
   ├─ webrtc-p2p (current)
   └─ <future provider>
```

### Recommended switch order

1. Extract `talk-call-webrtc.js` behind adapter interface (no behavior change)
2. Add server entitlement + usage hooks (fail-closed)
3. Add Staging Provider behind flag
4. Dual-run smoke · rollback flag off
5. Production only after REL-P0 cleared

### Blockers before implementation switch

1. Existing **REL-P0** (tree / prod alias / secretary secret / TLV payment ops)
2. Call **usage / free allowance** product rules undefined in code
3. No talk-specific token Function yet (if moving off P2P)
4. Full browser E2E (`test-talk-webrtc-call-browser.mjs`) can flake without fixtures — stabilize before cutover

### Out of scope (unchanged)

Video · group call · recording · screen share · public rooms · arbitrary dial-out

---

## Rollback

Leave WebRTC adapter as default. New Provider behind env/flag. No Production deploy in Phase 3-A.
