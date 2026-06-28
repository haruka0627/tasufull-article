# Platform Live ZEGO Integration — Phase 5 P5-1 Connection Audit

**Date:** 2026-06-29  
**Base commit:** `a8a3a20` (P4-6 COMPLETE)  
**Branch:** `cf-pages-deploy`  
**Type:** 接続ポイント調査 · ロジック変更最小  
**Scope:** TLV 本番 UI ↔ Platform Live ↔ ZEGO · dist/deploy なし

---

## 1. 目的

Phase 5 は **Platform Live を TLV 本番から利用可能にする** 統合フェーズ。  
P5-1 では現状の接続点を棚卸しし、P5-2 Adapter / P5-3 Feature Flag / P5-4 スモークの設計入力とする。

**本レポート時点の結論:** TLV 本番ページ（`studio.html` / `watch.html`）は **Supabase 状態管理のみ**。ZEGO RTC は **PoC 経路にのみ存在**。Platform Live Integration（Phase 4 完了）は **TLV UI 未接続**。

---

## 2. アーキテクチャ現状

```mermaid
flowchart TB
  subgraph tlv_prod [TLV 本番 — studio / watch]
    studio[studio.html]
    watch[watch.html]
    bc[live-broadcasts.js]
    comments[live-comments.js]
    bridge[live-broadcasts-session-bridge.js]
    supa[(Supabase broadcasts + messages)]
  end

  subgraph tlv_poc [TLV PoC — ZEGO RTC 完結]
    pocHtml[live-zego-poc.html]
    svc[TlvLiveService]
    tlvProv[createTlvLiveProvider]
    zego[TlvZegoLiveProvider]
    token[/api/tlv-zego-token]
  end

  subgraph plat [Platform Live — Phase 4 完了]
    platPoc[zego-platform-poc.html]
    integ[TasuLivePlatformIntegration]
    adapter[ZegoLiveProviderAdapter]
    platStack[Broadcast / Viewer / Chat / Recording / Monitoring / Retry]
  end

  studio --> bc --> supa
  watch --> bc
  watch --> comments --> supa
  bc -.->|flag OFF| bridge

  pocHtml --> svc --> tlvProv --> zego
  svc --> token
  zego --> token

  platPoc --> integ --> adapter --> zego
  integ --> platStack
  adapter --> token
```

---

## 3. 調査結果

### 3.1 TLV Live Provider（現行）

| 項目 | 内容 |
| --- | --- |
| **Interface** | `live/providers/live-provider-interface.js` → `createTlvLiveProvider(id)` |
| **ZEGO 実装** | `live/providers/zego-live-provider.js` — **`TlvZegoLiveProvider`**（SDK 閉じ込め · **変更禁止**） |
| **Types** | `live/providers/live-provider-types.js` |
| **読み込み元（本番）** | ❌ `studio.html` / `watch.html` 未ロード |
| **読み込み元（PoC）** | ✅ `live-zego-poc.html` → `live-service.js` |

**主要 API（Interface 契約）:**

| Method | 用途 |
| --- | --- |
| `initialize({ appId, server })` | SDK 初期化 |
| `startLive({ roomId, userId, token, videoContainer })` | Host publish |
| `joinLive({ roomId, userId, token, videoContainer })` | Audience subscribe |
| `leaveLive()` / `endLive()` | 退出 / 配信終了 |
| `toggleCamera` / `toggleMic` / `switchCamera` | デバイス制御 |

---

### 3.2 Broadcast 開始処理

#### 本番（studio）

| 段階 | ファイル | 処理 |
| --- | --- | --- |
| UI | `live/studio.html` | Session bridge scripts のみ · Provider/Service **なし** |
| クリック | `live/live-broadcasts.js` `bindStudioActions` | `[data-live-studio-start]` |
| DB | `updateBroadcastStatus(id, "live")` | Supabase `broadcasts.status` PATCH |
| 通知 | `TasuTlvNotificationService` / `TasuLiveNotify` | live_started 通知 |
| Bridge | `runSessionBridge("onStudioStart", …)` | **`liveSessionManagerEnabled=false` → スキップ** |
| 映像 | `renderStreamPlayer` | `stream_provider: "stub"` プレースホルダ |

**コード上の明示:** *「P0: 配信開始は status を live に更新するのみ（実映像未接続）」*

#### PoC / Service 経路

```
live-zego-poc.js handleStartLive
  → TlvLiveService.startLive({ roomId, userId, videoContainer })
    → fetchToken(role: host)
    → TlvZegoLiveProvider.startLive
    → TlvLiveSessionManager.start()
```

#### Platform Live 経路（Phase 4）

```
PlatformZegoPoc / Integration.startPublish
  → TasuLivePlatformBroadcastService.startBroadcast
  → ZegoLiveProviderAdapter.startBroadcast
  → TlvZegoLiveProvider.startLive
  → (+ P4-2 edge sync · P4-4 recording candidate · P4-5 monitoring · P4-6 retry)
```

**P5-2 接続候補:** `bindStudioActions` 内、`updateBroadcastStatus` 成功後に Platform Integration `startPublish({ surface: "tlv", … })` を **flag ガード付き**で挿入。

---

### 3.3 Viewer 参加処理

#### 本番（watch）

| 段階 | ファイル | 処理 |
| --- | --- | --- |
| ページ | `live/watch.html`（canonical）· `watch-live.html`（重複） | 同一スクリプト構成 |
| マウント | `mountWatchPage` | broadcast fetch → player + comments |
| Player | `renderStreamPlayer` | stub / Cloudflare Stream placeholder のみ |
| Bridge | `runSessionBridge("onWatchJoin", …)` | flag OFF → スキップ |
| Chat | `TasuLiveComments.mountComments` | Supabase `live_broadcast_messages` |

#### PoC / Service 経路

```
live-zego-poc.js handleJoinLive
  → TlvLiveService.joinLive
    → fetchToken(role: audience)
    → TlvZegoLiveProvider.joinLive
    → TlvLiveSessionManager.join()
```

#### Platform Live 経路

| API | 用途 |
| --- | --- |
| `joinLive` | 別クライアント audience（broadcast ローカル LIVE 不要） |
| `joinAsViewer` | 同一プロセス coordinated viewer（broadcast LIVE 必須） |

**P5-2 接続候補:** `mountWatchPage` で `<video>` コンテナを確保し、`usePlatformLive=true` 時 `Integration.joinLive({ surface: "tlv", … })` を `onWatchJoin` 前後に呼ぶ。

---

### 3.4 Chat 接続

| 経路 | 実装 | TLV 本番 |
| --- | --- | --- |
| **TLV Supabase comments** | `live/live-comments.js` | ✅ watch ページで利用 |
| **Platform Chat Gateway** | `platform-live/chat/live-chat-gateway.js` | ❌ 未ロード |
| **P4-3 Edge watching** | `Integration.joinLive` → `set_watching` | ❌ TLV 未接続 |

**統合方針（P5-2 以降）:** Phase 5 では **Supabase comments を維持**（DB/API 変更禁止）。Platform Chat は **opt-in 並行**または P5-4 以降で段階接続。本番 chat UX 変更は Phase 5 スコープ外。

---

### 3.5 Recording

| 層 | 状態 |
| --- | --- |
| TLV `live/` | **Recording API なし** |
| Platform | `TasuLivePlatformRecordingService` · Edge `live-platform-recording` |
| Integration P4-4 | publish → `recording:candidate` · explicit `startRecording` / `stopRecording` |
| Adapter | `startRecording` 等 → **future noop stub** |

**P5-2:** Platform Integration 経由で stub まで配線可能。本番 studio からの自動 start は **Phase 5 非目標**。

---

### 3.6 Monitoring

| 層 | 状態 |
| --- | --- |
| TLV `live/` | **Monitoring service なし** |
| TLV dev | `live-session-debug-panel.js`（bridge flag 連動） |
| Platform | `TasuLivePlatformMonitoringService` · P4-5 diagnostics feed + edge patch |
| Adapter | `getMonitoringProbe()` → provider state ベース stub |

**P5-2:** Integration 初期化時の `_feedMonitoringDiagnostics` を TLV surface で再利用可能。UI 表示は Phase 5 非目標。

---

### 3.7 Token 取得経路

```text
Browser POST /api/tlv-zego-token
  { roomId, userId, role: "host"|"audience" }
    ↓
deploy/cloudflare/functions/api/tlv-zego-token.js
    ↓
deploy/cloudflare/functions/_shared/zego-token04.mjs
    ↓
.env / .dev.vars: ZEGO_APP_ID · ZEGO_SERVER_SECRET
```

| 呼び出し元 | 関数 |
| --- | --- |
| `TlvLiveService.fetchToken` | `cfg.tokenApiPath` デフォルト `/api/tlv-zego-token` |
| `ZegoLiveProviderAdapter.fetchToken` | 同一 endpoint |
| TLV 本番 studio/watch | **未呼び出し** |

**制約:** Token 仕様変更は Phase 5 **禁止**。既存 API をそのまま利用。

---

## 4. Feature Flag 現状

**ファイル:** `live/tlv-feature-flags.js`

| Flag | Default | 意味 |
| --- | --- | --- |
| `publicEnabled` | `false` | 一般公開 |
| `privateTestEnabled` | `true` | 非公開本番テスト |
| `allowedTestEmails` | `[…]` | Access 許可リスト |
| `liveSessionManagerEnabled` | **`false`** | broadcasts ↔ Session Manager（**Provider 非接触**） |

**P5-3 追加予定:** `usePlatformLive: false` — true 時のみ Platform Integration 経由。false は現状挙動完全維持。

---

## 5. Platform Live vs TLV スタック比較

| 観点 | TLV | Platform Live |
| --- | --- | --- |
| Session | `live/session/live-session-manager.js` | `platform-live/core/live-session-manager.js` |
| Service | `TlvLiveService`（薄い窓口） | `TasuLivePlatformIntegration`（フル orchestration） |
| Provider IF | 最小 RTC | 拡張（broadcast/viewer/chat/recording/monitoring） |
| ZEGO SDK | `TlvZegoLiveProvider` 直接 | `ZegoLiveProviderAdapter` → 同一 Provider |
| Surface | 暗黙 TLV | 明示 `surface`（`platform` · 将来 `tlv`） |
| Phase 4 機能 | なし | edge sync · chat · recording · monitoring · retry |

**P5-2 推奨:** TLV UI から **`TasuLivePlatformIntegration` + `surface: "tlv"`** を呼ぶ Adapter 層を新設。`TlvLiveService` を置換せず、bridge 拡張または thin wrapper で接続。

---

## 6. 既存ブリッジ（Phase 2-03）

**ファイル:** `live/live-broadcasts-session-bridge.js`

| Export | 本番呼び出し | Provider 接続 |
| --- | --- | --- |
| `onStudioStart` | `bindStudioActions` 配信開始後 | ❌ Session only |
| `onStudioEnd` | 配信終了後 | ❌ |
| `onWatchJoin` | `mountWatchPage` | ❌ |
| `onWatchLeave` | `beforeunload` | ❌ |

**テスト:** `scripts/test-live-broadcasts-session-bridge.mjs`

---

## 7. P5-2〜P5-4 へのギャップ一覧

| # | ギャップ | P5-x 対応 |
| --- | --- | --- |
| 1 | 本番 HTML に Provider/Integration script なし | P5-2 Adapter + 条件付き script load |
| 2 | `renderStreamPlayer` が stub のみ | P5-2 video container + joinLive |
| 3 | studio に host preview コンテナなし | P5-2 最小 DOM 追加（全面 UI 変更禁止） |
| 4 | `stream_provider` 列が `"stub"` 固定 | P5-2 以降 `zego` 設定（DB 変更は Phase 5 禁止 → runtime のみ） |
| 5 | 二重 Session スタック | P5-2 Platform Integration を orchestrator に統一 |
| 6 | Chat 二系統（Supabase vs Platform） | P5-4 スモークで並行確認 · 本番は Supabase 維持 |
| 7 | Recording/Monitoring TLV 未存在 | P5-4 Integration diagnostics で Phase 4 同等確認 |
| 8 | `usePlatformLive` flag 未存在 | P5-3 |
| 9 | `watch-live.html` vs `watch.html` URL  drift | P5-2 以降整理（通知リンク確認） |
| 10 | Token env 未設定時 E2E ブロック | 既知 · deploy 禁止のため Phase 5 ローカル検証のみ |

---

## 8. P5-2 Adapter 設計メモ（調査 derived · 未実装）

```
live/tlv-platform-live-adapter.js（新規候補）
  ├─ isEnabled() → TLV_FEATURE_FLAGS.usePlatformLive
  ├─ getIntegration() → TasuLivePlatformIntegration singleton
  ├─ onStudioStart({ broadcastId, creatorId, videoContainer })
  │    → initialize({ surface: "tlv", providerId: "zego" })
  │    → startPublish({ roomId: broadcastId, userId: creatorId, … })
  ├─ onWatchJoin({ broadcastId, userId, videoContainer })
  │    → joinLive({ surface: "tlv", roomId: broadcastId, … })
  └─ onStudioEnd / onWatchLeave → stopPublish / leaveLive
```

**原則:**
- TLV → Platform Interface のみ（ZEGO 直接 import 禁止）
- `TlvZegoLiveProvider` / Token API は Adapter 内部（既存 Phase 3 経路）
- `false` flag 時は bridge 現行どおり no-op

---

## 9. 変更ファイル（P5-1）

| 種別 | ファイル |
| --- | --- |
| **A** | `reports/live-platform-zego-phase5-p5-1-connection-audit.md` |
| **A** | `scripts/test-platform-live-zego-integration-phase5-p5-1-audit.mjs` |
| **M** | `package.json`（audit script） |
| **M** | `docs/TODO.md`（Phase 5 タスク追記） |

**ロジック変更:** なし（本番コード untouched）

---

## 10. テスト（P5-1）

| スイート | 内容 | 結果 |
| --- | --- | --- |
| P5-1 audit | 接続点ファイル存在 · flag · bridge · 本番未接続確認 | **PASS**（静的） |
| Phase 4 P4-6 regression | 既存 Integration 非退行 | **PASS**（npm script 経由） |

---

## 11. P5-1 完了判定

| 項目 | 判定 |
| --- | --- |
| 接続ポイント調査完了 | ✅ |
| レポート化 | ✅ |
| 本番ロジック無変更 | ✅ |
| P5-2 設計入力 | ✅ |
| dist/deploy 触らず | ✅ |

### **Phase 5-1: GO**

P5-2（Platform Live Adapter 作成）へ進行可能。

---

## 12. 未対応事項（P5-2 以降）

- [ ] P5-2 TLV Platform Live Adapter 実装
- [ ] P5-3 `usePlatformLive` feature flag
- [ ] P5-4 統合スモーク（Host/Viewer/Chat/Recording/Monitoring/Retry/Diagnostics）
- [ ] studio/watch への条件付き script 配線
- [ ] `surface=tlv` Integration 検証
- [ ] watch URL 正規化（`watch.html` canonical）
