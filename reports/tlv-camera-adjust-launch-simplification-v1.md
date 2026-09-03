# TLV Camera Adjust Launch Simplification

**ACTIVE_TASK:** TLV Camera Adjust Launch Simplification  
**Date:** 2026-09-04  
**HEAD:** `66a08bf` + this working-tree overlay (uncommitted)  
**SSOT audit:** [tlv-beauty-camera-adjust-rationalization-audit-v1.md](./tlv-beauty-camera-adjust-rationalization-audit-v1.md) · VERDICT SIMPLIFY  
**PRODUCTION_CHANGED:** NO  

8788 was **ALIVE** (`probe-pages-dev` HTTP 200). Dist copies only (`Copy-Item`). `build:pages` / `npm run dev` not run. Cursor IDE Browser not used.

---

## TLV_CAMERA_ADJUST_LAUNCH_SIMPLIFICATION_CLOSEOUT

| Field | Result |
| --- | --- |
| CURRENT_HEAD | `66a08bf` + Camera Adjust Launch overlay |
| BEAUTY_PUBLIC_BRANDING | **REMOVED from Launch.** User-visible name is Camera Adjust / カメラ調整 (`golive.beauty`). Internal `data-tlv-beauty-*` and `TasuOneTlvGoLiveBeauty` kept |
| CAMERA_ADJUST_UI | **PASS** — Camera device + Camera Adjust toggle + Brightness + Reset |
| BRIGHTNESS | **PASS** — existing WebGL uniform; Launch identity mix (`smoothing=0`, `skinTone=0`, `intensity=100`) so Brightness is 1:1 |
| RESET | **PASS** — `data-tlv-camera-adjust-reset` zeros brightness and hidden grade params |
| SMOOTHING_PUBLIC | **HIDDEN** — markup kept under `data-tlv-camera-adjust-advanced` (not deleted) |
| SKIN_TONE_PUBLIC | **HIDDEN** — same |
| FACE_BEAUTY_PUBLIC | **0** Playwright-visible Launch (`Face Beauty` / `Smoothing` / `Skin Tone` / lone `Beauty`) |
| TENCENT_PUBLIC | **DEFER** — still `hidden` unless `?tlvBeautyPoc=1` |
| SNAP_BEAUTY_PUBLIC | **DEFER** — Launch panel `hidden`; PoC via `?tlvEffectsQa=1` / `?tlvEffectsDebug=1` only. Markup + `Beauty Candidates` string retained for existing Snap QA |
| DEAD_AV_CONTROLS | **HIDDEN** — Auto Quality / Noise Cancel / Echo Cancel were visual-only (`syncUiOnly`, no media constraint). Wrapped `data-tlv-dead-av-controls`. Resolution/FPS remain honest disabled |
| BASIC_WEBGL_PRESERVED | **YES** — `one-tlv-go-live-beauty.js` not deleted (AD-040) |
| VIRTUAL_CAMERA | **PASS** — any `videoinput`; no vendor allowlist. Fake enumerate listed Integrated + OBS Virtual Camera |
| DOUBLE_BEAUTY_DEFAULT | **OFF** — Camera Adjust default OFF; Virtual Camera does not auto-enable TLV grade |
| USER_VRM_REGRESSION | **PASS** — blob lifecycle 37/37 · upload control intact |
| VROID_HUB_REGRESSION | **PASS** — 47/47 |
| AVATAR_ONLY_GPU_BEHAVIOR | **PASS** — `getOutputStream()` returns null and loop stops when VTuber `enabled && cameraVisMode === "avatar_only"`. VRM shader path unchanged |
| SCENE_REGRESSION | **PASS_STATIC** — `bindCameraSource` still Snap → Tencent PoC → Basic `getOutputStream` → Formal raw |
| LIVEKIT_REGRESSION | **PASS_STATIC** — formal migration + reconnect scripts PASS. START/STOP LIVE: non-destructive cite of existing Real E2E [tlv-vroid-hub-real-live-publish-final-closeout.md](./tlv-vroid-hub-real-live-publish-final-closeout.md) (`tlv-formal-composited` + `tlv-formal-audio`, raw camera not published) |
| RUNTIME_ERRORS | **0** pageerror (Playwright). Known pre-existing 404: `tlv-snap-effects.config.local.js` |
| INDEPENDENT_JUDGE | **PASS** (`scripts/judge-tlv-camera-adjust-launch-simplification-v1.mjs`) |
| MUST_FIX_REMAINING | **NONE** |
| SHOULD_FIX_REMAINING | Contrast / Saturation / Exposure / Color / Background Blur remain **NOT_IMPLEMENTED / DEFER** (no fake UI). Full Japanese i18n product pass is a **separate** ACTIVE_TASK (existing JA/EN keys already updated for Camera Adjust) |
| VERDICT | **PASS** |
| ORIGINAL_MEMO | Filename scan of `１０月までにやるもの` only (`ID　パス系` not read). No memo titled for this Camera Adjust Launch task. Implementer **COMPLETE_CANDIDATE** not asserted. No deletion |

---

## Launch camera story (as shipped)

1. **Normal Camera** — existing device `<select>` / Formal `getUserMedia`  
2. **External / Virtual Camera** — any `videoinput`  
3. **Camera Adjust** — Brightness, default OFF, Reset  
4. **VTuber** — User VRM + VRoid Hub (unchanged engine)

Face Beauty is not a Launch product. External Beauty = Virtual Camera path. No Banuba / BytePlus. No new Beauty API/SDK.

---

## Implementation

| File | Change |
| --- | --- |
| `one-tlv-go-live.html` | Camera Adjust label/icon; hide Smoothing/Skin Tone/Intensity; Reset; hide Snap Effects; hide dead A/V; Tencent/SNOW remain hidden |
| `live/tlv-go-live-labels-ja.js` | Existing keys: Camera Adjust / カメラ調整, Reset / リセット, status lines. No new i18n engine |
| `one-tlv-go-live-data-adapter.js` | Launch identity grade; Reset; Snap UI only with QA query; VTuber vis-mode resync |
| `one-tlv-go-live-beauty.js` | Keep module. Default identity grade. `avatar_only` skips camera GPU. `resyncProcessing` |

Internal ids (`data-tlv-beauty-*`, storage `tlv_go_live_beauty_v1`) were **not** renamed.

---

## QA

```
node scripts/test-tlv-camera-adjust-launch-simplification-v1.mjs   # 31/31 PASS
node scripts/judge-tlv-camera-adjust-launch-simplification-v1.mjs  # INDEPENDENT_JUDGE: PASS
node scripts/test-tlv-snap-beauty-curation-v1.mjs                  # 10/10 PASS
node scripts/test-tlv-vroid-hub-v1.mjs                             # 47/47 PASS
node scripts/test-tlv-vtuber-vrm-blob-lifecycle-v1.mjs             # 37/37 PASS
node scripts/verify-tlv-livekit-formal-migration-v1.mjs            # PASS
node scripts/verify-tlv-livekit-formal-reconnect-v1.mjs            # PASS
node scripts/test-tlv-broadcaster-ux-v1.mjs                        # PASS
node scripts/test-tlv-golive-i18n-v1.mjs                           # PASS (label keys still parity)
```

| Required check | Result |
| --- | --- |
| Normal Camera | PASS (device select + Formal path unchanged) |
| Camera Adjust OFF | PASS |
| Brightness | PASS |
| Reset | PASS |
| External / Virtual Camera | PASS (any videoinput; mock OBS listed) |
| Virtual Camera + Adjust OFF | PASS (default OFF, no auto-enable) |
| Preview | PASS_STATIC (preview host / Scene compositor contract unchanged) |
| Scene | PASS_STATIC |
| User VRM | PASS 37/37 |
| VRoid Hub | PASS 47/47 |
| avatar_only | PASS (GPU skip) |
| LiveKit compositedStream | PASS_STATIC |
| START LIVE | Existing Real E2E evidence · not re-run this task |
| STOP LIVE | Existing Real E2E evidence · not re-run this task |
| raw camera accidental publish | NO (contract unchanged) |
| Runtime errors | 0 |
| Face Beauty user-visible launch UI | 0 |
| Dead A/V controls | 0 on Launch (unwired Formal) |

HTTP Status: **200** · Viewport Playwright **1280** and **390×844** · Console pageerror **0**

---

## Human visual (isolation)

Confirm in external Chrome (not Cursor IDE Browser):

- http://127.0.0.1:8788/one-tlv-go-live.html  
- Desktop 1280 and Mobile 390×844  

Expect: Camera, Camera Adjust, Brightness (when ON), Reset. No Smoothing / Skin Tone / Snap Beauty / Tencent / Auto Quality / Noise / Echo.

---

## Constraints honored

- AD-040 Basic WebGL not deleted  
- No new Beauty API/SDK  
- Tencent/Snap not promoted to Launch Face Beauty  
- VTuber engine not rewritten  
- VRoid Hub spec unchanged  
- LiveKit architecture unchanged  
- Production unchanged  
- Japanese i18n product task not started (existing keys updated only so `applyStaticDom` does not restore “Beauty”)  
- No next ACTIVE_TASK started  

---

## FINDINGS

1. Snap Camera Kit still **boots** on Go Live (architecture unchanged). Launch **UI** is hidden. Token/catalog network may still occur; not a Face Beauty Launch surface.  
2. Contrast / Saturation / Exposure / Color / Background Blur remain unimplemented — no dummy sliders.  
3. Pre-existing optional Snap local config 404.
