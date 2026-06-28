# platform-live

TASFUL 全サービス共通 Live Platform 基盤（TLV 非依存）。

## Phase A（Session Core）✅

| パス | 責務 |
| --- | --- |
| `core/live-session-manager.js` | Session lifecycle · surface 必須 |
| `core/live-platform-service.js` | Manager + Provider 配線 |
| `provider/stub-live-provider.js` | ZEGO なし lifecycle 検証 |

**テスト:** `npm run test:platform-live-core-phase-a`

## Phase B（Broadcast Core）✅

| パス | 責務 |
| --- | --- |
| `broadcast/live-broadcast-service.js` | create/start/stop/health/viewer count |
| `broadcast/live-broadcast-edge-client.js` | Edge クライアント · local fallback |
| `provider/stub-live-provider.js` | broadcast メソッド拡張 |

**Edge（stub · in-memory）:** `supabase/functions/live-platform-broadcast`

**テスト:** `npm run test:platform-live-broadcast-phase-b`

## Phase C（Viewer Core）✅

| パス | 責務 |
| --- | --- |
| `viewer/live-viewer-service.js` | join/leave/reconnect/heartbeat/permission/watch state |
| `viewer/live-viewer-ccu-registry.js` | CCU 正本（in-memory） |
| `viewer/live-viewer-permission.js` | MVP permission |
| `viewer/live-viewer-edge-client.js` | Edge クライアント · local fallback |

**Edge（stub · in-memory）:** `supabase/functions/live-platform-viewer`

**テスト:** `npm run test:platform-live-viewer-phase-c`

## Phase D（Chat Gateway）✅

| パス | 責務 |
| --- | --- |
| `chat/live-chat-gateway.js` | message / reaction / system event |
| `chat/live-chat-moderation-hook.js` | allow / block / flag hook |
| `chat/live-chat-rate-limit-hook.js` | allow / throttle / deny hook |
| `chat/live-chat-edge-client.js` | Edge クライアント · local fallback |

**Edge（stub · in-memory）:** `supabase/functions/live-platform-chat`

**テスト:** `npm run test:platform-live-chat-phase-d`

**UI:** 非実装 · `live-comments.js` 未接続

## Phase E（Recording Core）✅

| パス | 責務 |
| --- | --- |
| `recording/live-recording-service.js` | start/stop/status/metadata/archive |
| `recording/live-recording-edge-client.js` | Edge クライアント · local fallback |
| `provider/stub-live-provider.js` | recording stub メソッド |

**Edge（stub · in-memory）:** `supabase/functions/live-platform-recording`

**テスト:** `npm run test:platform-live-recording-phase-e`

**VOD / watch-video:** 非接続 · `live-video-upload` 未接続

**surface:** `platform` \| `tlv` \| `talk` \| `builder` — MVP は `platform` のみ。

**TLV 接続:** なし（`live/session/*` · `live-broadcasts.js` · `watch-video` · `live-comments.js` は参照元として維持）。

## Phase F（Monitoring Core）✅

| パス | 責務 |
| --- | --- |
| `monitoring/live-monitoring-service.js` | health / metrics / service status |
| `monitoring/live-monitoring-metrics-store.js` | in-memory 集計 |
| `monitoring/live-monitoring-smoke-runner.js` | Phase A〜E 横断 smoke |
| `monitoring/live-monitoring-edge-client.js` | Edge クライアント · local fallback |

**Edge（stub · in-memory）:** `supabase/functions/live-platform-monitoring`

**テスト:** `npm run test:platform-live-monitoring-phase-f`

**Live Platform Core:** Phase A〜F 完了（Session · Broadcast · Viewer · Chat · Recording · Monitoring）

## ZEGO Adapter（Phase 1）✅

| パス | 責務 |
| --- | --- |
| `provider/adapters/zego-live-provider-adapter.js` | Platform Interface 適合 · TLV PoC delegate |
| `provider/create-platform-live-provider.js` | `zego` → Adapter · 未ロード時 stub fallback |

**テスト:** `npm run test:platform-live-zego-adapter-phase1` · Phase A〜F regression 含む

**TLV PoC:** `live/providers/zego-live-provider.js` — **変更なし**

## ZEGO Integration Phase 2 ✅

| パス | 責務 |
| --- | --- |
| `zego-platform-poc.html` | Platform 専用 PoC（Adapter 経由 E2E） |
| `zego-platform-poc.js` | TasuLivePlatformService UI |
| `platform-live-zego-config.example.js` | Client config テンプレ |

**テスト:** `npm run verify:platform-live-zego-integration-e2e` · Phase 1 + A〜F regression 含む

**TLV PoC:** `live/live-zego-poc.html` · `live/providers/zego-live-provider.js` — **変更なし**
