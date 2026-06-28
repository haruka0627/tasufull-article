# Live Platform — ZEGO Provider Adapter 設計

**版:** 1.0 Phase 0（Adapter Design）  
**最終更新:** 2026-06-28  
**状態:** 設計凍結候補 · **実装未着手**  
**種別:** Platform Live Interface ↔ TLV ZEGO PoC 橋渡し

**関連:** [TLV_LIVE_PROVIDER.md](./TLV_LIVE_PROVIDER.md) · [live-platform-zego-adapter-design.md](../reports/live-platform-zego-adapter-design.md) · [live-platform-zego-integration-readiness.md](../reports/live-platform-zego-integration-readiness.md)

---

## 1. 目的と制約

### 1.1 目的

既存 **TLV ZEGO PoC**（`live/providers/zego-live-provider.js`）を **変更せず**、新規 **Adapter** 層で `PlatformLiveProviderInterface` に適合させる。

```text
TLV ZEGO PoC（TlvZegoLiveProvider）  ← 変更禁止
        ↑ delegate（composition）
ZegoLiveProviderAdapter（新規 · platform-live/provider/adapters/）
        ↑ implements
PlatformLiveProviderInterface  ← 変更禁止
        ↑
LivePlatformService / Broadcast / Viewer / …
```

### 1.2 制約（Phase 0）

| 禁止 | 理由 |
| --- | --- |
| TLV PoC 変更 | 既存 E2E · Phase 1/1.5 資産保護 |
| ZEGO SDK 変更 | Provider 内閉じ込め維持 |
| Platform Interface 変更 | AD-001 境界 · 278 tests 契約 |
| Edge / UI / TLV 接続 | 本 Phase は Adapter 設計のみ |

---

## 2. Adapter 責務

### 2.1 やること

| 責務 | 内容 |
| --- | --- |
| **Interface 適合** | `PlatformLiveProviderInterface` を満たす公開 API |
| **PoC 委譲** | RTC 実処理は `TlvZegoLiveProvider` へ delegate |
| **契約変換** | Platform 引数（`surface` 等）→ PoC 引数（`token` · `videoContainer` 等） |
| **Token 取得** | Adapter 内 `fetchToken` — `/api/tlv-zego-token` 呼出（Service 層と重複可 · Phase 1 で配置確定） |
| **Signal 変換** | PoC 成功/失敗 · SDK イベント（Phase 1）→ `PLATFORM_LIVE_PROVIDER_SIGNALS` |
| **Broadcast Signal** | publish/stop 完了 → `PLATFORM_LIVE_BROADCAST_PROVIDER_SIGNALS` |
| **状態キャッシュ** | `roomId` · `userId` · `role` · `videoContainer` · reconnect 用 |
| **Future スタブ** | chat / recording / monitoring — Stub 互換 noop 返却 |

### 2.2 やらないこと

| 除外 | 担当 |
| --- | --- |
| Session 状態機械 | `TasuLivePlatformSessionManager` |
| Broadcast メタ CRUD | `TasuLivePlatformBroadcastService` + Edge stub |
| CCU 正本 | `live-viewer-ccu-registry` + Edge |
| Chat メッセージ永続 | Chat Gateway + Edge stub |
| UI / DOM（PoC 以外） | Phase 1 PoC ページは別タスク |

---

## 3. 操作対応表（Adapter 内部モデル）

ユーザー向け操作語と PoC / SDK の対応。

| Adapter 操作 | Platform Interface | ZEGO SDK（PoC 内） | TLV PoC メソッド | Adapter 実装方針 |
| --- | --- | --- | --- | --- |
| **initialize** | `initialize(options)` | `new ZegoExpressEngine(appId, server)` · SDK load | `initialize({ appId, server })` | config から appId/server 解決 → delegate |
| **createSession** | Session Manager `createSession`（Provider 外） | — | — | Adapter は **session context** のみ保持（surface/roomId/role）。SM は Service 層 |
| **joinSession** | `joinLive` · `joinViewer` | `loginRoom` | `joinLive({ roomId, userId, token, videoContainer })` | Token fetch（audience）→ delegate joinLive |
| **leaveSession** | `leaveLive` · `leaveViewer` | `stopPlayingStream`* · `logoutRoom` | `leaveLive()` | delegate · emit DISCONNECTED |
| **reconnect** | `reconnectLive` · `reconnectViewer` | 再 `loginRoom`（Phase 1） | **なし** | Adapter のみ: cache から Token 再取得 → leaveLive → joinLive/startLive |
| **publish** | `startLive` · `startBroadcast` | `createStream` · `startPublishingStream` | `startLive(...)` 内包 | Token fetch（host）→ delegate startLive |
| **subscribe** | `joinLive` · `joinViewer` | `loginRoom` · `roomStreamUpdate` → `startPlayingStream` | `joinLive(...)` + 内部 event | delegate joinLive |
| **stopPublish** | `endLive` · `stopBroadcast` | `stopPublishingStream` · `destroyStream` | `endLive()` | delegate endLive · broadcast STOPPED signal |
| **stopSubscribe** | `leaveLive`（viewer） | `stopPlayingStream` | `leaveLive()` 内包 | delegate leaveLive |
| **disconnect** | `dispose` · `endLive`/`leaveLive` | `destroyEngine` | `dispose()` → `endLive` + destroy | delegate dispose · state=disposed |

\* viewer の stopSubscribe は PoC `leaveLive` に含まれる。

---

## 4. Platform Interface 差分一覧

| Platform Interface | TLV PoC | Adapter 実装（Phase 1） | Future |
| --- | --- | --- | --- |
| `providerId` | `"zego"` | `"zego"`（Adapter も同 ID · `adapter: true` メタ可） | |
| `state` | idle/ready/live/watching/error/disposed | PoC `state` を透過 or 合成 | |
| `initialize` | `{ appId, server }` 必須 | `{ surface, appId?, server? }` → config マージ → delegate | |
| `startLive` | token · videoContainer 必須 | fetchToken(host) · container 注入 → delegate | |
| `joinLive` | token · videoContainer 必須 | fetchToken(audience) → delegate | |
| `leaveLive` | ✓ | delegate + `PROVIDER_DISCONNECTED` | |
| `endLive` | ✓ | delegate + signals | |
| `reconnectLive` | **なし** | cache 再認証パターン + `PROVIDER_RECONNECTING/RECONNECTED` | SDK `roomStateUpdate` 監視 |
| `startBroadcast` | **なし** | `startLive` と同系（publish）+ `BROADCAST_PROVIDER_*` | 独立 stream 制御 |
| `stopBroadcast` | **なし** | `endLive` 委譲 + broadcast signals | |
| `getBroadcastHealth` | **なし** | `state === live` ベース + PoC state | SDK stream quality |
| `updateViewerCount` | **なし** | noop ok（CCU は Edge 正本） | |
| `joinViewer` | **なし** | `joinLive` 委譲（audience token） | |
| `leaveViewer` | **なし** | `leaveLive` 委譲 | |
| `reconnectViewer` | **なし** | `reconnectLive` と同パターン | |
| `viewerHeartbeat` | **なし** | noop ok | |
| `sendChatMessage` | **なし** | noop ok（Gateway Edge 正本） | ZEGO IM |
| `addChatReaction` | **なし** | noop ok | Future |
| `removeChatReaction` | **なし** | noop ok | Future |
| `emitChatSystemEvent` | **なし** | noop ok | Future |
| `startRecording` | **なし** | noop ok + stub storageKey | ZEGO Cloud Recording |
| `stopRecording` | **なし** | noop ok | Future |
| `getRecordingStatus` | **なし** | `{ state: 'idle' }` | Future |
| `getArchiveMetadata` | **なし** | noop ok | Future |
| `getMonitoringProbe` | **なし** | PoC `state` ベース probe | SDK metrics |
| `dispose` | ✓ | delegate | |
| `onSignal` | **なし** | Adapter が保持 · `_emitSignal` 実装 | SDK event → signal |
| `onBroadcastSignal` | **なし** | Adapter が保持 · publish/stop 時に発火 | |

---

## 5. Signal 対応

### 5.1 Session signals（`PLATFORM_LIVE_PROVIDER_SIGNALS`）

| 抽象 Signal | 発火タイミング（Adapter） | ZEGO SDK / PoC 由来 | TLV PoC 現状 |
| --- | --- | --- | --- |
| `PROVIDER_CONNECTING` | Token 取得前 · loginRoom 直前 | — | **未発火** → Adapter が追加 |
| `PROVIDER_CONNECTED` | loginRoom 成功後 | `loginRoom` success | **未発火** → Adapter が追加 |
| `PROVIDER_DISCONNECTED` | leaveLive / endLive / dispose 後 | `logoutRoom` | **未発火** → Adapter が追加 |
| `PROVIDER_RECONNECTING` | reconnect 開始 | — | **なし** → Adapter のみ |
| `PROVIDER_RECONNECTED` | reconnect 成功 | 再 loginRoom | **なし** → Adapter のみ |
| `PROVIDER_CONNECTION_LOST` | SDK 切断イベント（Phase 1+） | `roomStateChanged` 等 | **なし** → Future（PoC 非変更のため Adapter で engine イベント購読は Phase 1 要検討） |
| `PROVIDER_ERROR` | login/publish/play 失敗 | catch → error | PoC は return `{ ok: false }` のみ → Adapter が変換 |

**Phase 1 方針:** PoC メソッドの **戻り値**（ok/error）から Adapter が signal を合成。SDK イベント直購読は PoC 変更なしでは **engine 参照不可** のため、**reconnect は明示 API 呼出**に限定。

### 5.2 Broadcast signals（`PLATFORM_LIVE_BROADCAST_PROVIDER_SIGNALS`）

| 抽象 Signal | 発火タイミング | PoC 対応 |
| --- | --- | --- |
| `BROADCAST_PROVIDER_STARTING` | startLive / startBroadcast 直前 | Adapter 合成 |
| `BROADCAST_PROVIDER_STARTED` | startPublishingStream 成功後 | startLive 成功後 |
| `BROADCAST_PROVIDER_STOPPING` | endLive / stopBroadcast 直前 | Adapter 合成 |
| `BROADCAST_PROVIDER_STOPPED` | endLive 成功後 | Adapter 合成 |
| `BROADCAST_PROVIDER_HEALTH_OK` | getBroadcastHealth ok | state ベース |
| `BROADCAST_PROVIDER_HEALTH_DEGRADED` | health 失敗 | Future |
| `BROADCAST_PROVIDER_VIEWER_COUNT` | updateViewerCount | Adapter noop（Edge 正本） |
| `BROADCAST_PROVIDER_ERROR` | publish 失敗 | error 変換 |

### 5.3 ユーザー要求 Signal 語彙との対応

| 要求語彙 | Platform Signal |
| --- | --- |
| connected | `PROVIDER_CONNECTED` |
| disconnected | `PROVIDER_DISCONNECTED` |
| reconnecting | `PROVIDER_RECONNECTING` |
| error | `PROVIDER_ERROR` |

---

## 6. Secret / Config

### 6.1 サーバー（必須 · `.env`）

| 変数 | 所在 | 公開 | 用途 |
| --- | --- | --- | --- |
| `ZEGO_APP_ID` | `.env` · CF Pages env | Client 可 | Engine · Token payload |
| `ZEGO_SERVER` | `.env` · client config | Client 可 | wss エンドポイント |
| `ZEGO_SERVER_SECRET` | `.env` **のみ** | **禁止** · 32 byte | Token04 署名 |

### 6.2 クライアント（非 Secret）

| 項目 | 所在 | 備考 |
| --- | --- | --- |
| `TLV_LIVE_ZEGO_CONFIG` | `live/live-zego-config.js`（gitignore） | PoC 既存 · **Adapter も読み取り可** |
| `tokenApiPath` | 既定 `/api/tlv-zego-token` | 変更不要 |
| Manual Token | PoC フォーム / E2E | 開発用 · Console 24h |

### 6.3 追加 Secret（Phase 1 時点）

| 変数 | 要否 | 備考 |
| --- | --- | --- |
| 上記 3 つのみ | **必須** | 追加 Secret **不要** |
| Supabase keys | 不要 | Edge stub 維持 |
| Stripe / Wallet | 禁止 | スコープ外 |

**Phase 1 提案:** `PLATFORM_LIVE_ZEGO_CONFIG` を **読み取りエイリアス**として定義（中身は `TLV_LIVE_ZEGO_CONFIG` と同一スキーマ）— PoC config ファイル変更なし。

---

## 7. Token API 利用可否

### 7.1 結論: **そのまま利用可能（Go）**

| 観点 | 判定 |
| --- | --- |
| エンドポイント | `POST /api/tlv-zego-token` — 8788 で稼働 |
| リクエスト | `{ roomId, userId, role: "host"|"audience"|"publisher" }` |
| レスポンス | `{ token, appId, server?, expiresIn, role, configured }` |
| publish 権限 | `role: host` or `publisher` → `canPublish: true` |
| subscribe 権限 | `role: audience` → `canPublish: false` |
| CORS | OPTIONS 対応済 |
| 命名 | パスが `tlv-*` だが **RTC 汎用** · Edge 変更不要 |

### 7.2 Adapter / Service での呼出（設計）

```text
POST /api/tlv-zego-token
Content-Type: application/json
{ "roomId": "...", "userId": "...", "role": "host" | "audience" }
```

- **initialize 時:** Token 不要  
- **publish（startLive）:** `role: host`  
- **subscribe（joinLive）:** `role: audience`  
- **reconnect:** 同一 API 再呼出（有効期限 60〜86400s）

### 7.3 利用不可となる条件（運用）

| 条件 | 結果 |
| --- | --- |
| `.env` 未設定 | HTTP 503 · manual token のみ |
| `ZEGO_SERVER_SECRET` ≠ 32 byte | HTTP 503 |
| `npm run dev` 未起動 | fetch 失敗 |

いずれも **API 変更ではなく環境 blocker**。

---

## 8. E2E シナリオ設計（未実装）

**スクリプト名（案）:** `verify-platform-live-zego-integration-e2e`  
**対象:** platform-live stack 専用 PoC ページ（**TLV `live-zego-poc.html` は使用しない**）  
**前提:** `.env` ZEGO 3 変数 · `http://127.0.0.1:8788` · Playwright · fake media

### 8.1 シナリオ一覧

| Step | ID | 操作 | 検証 |
| --- | --- | --- | --- |
| 1 | `env:zego-configured` | `readZegoEnv()` | 3 変数存在 |
| 2 | `config:platform-zego` | dist config 生成（既存 script 流用可） | appId/server 非空 |
| 3 | `token:host` | POST token API · role=host | 200 + token |
| 4 | `token:audience` | POST token API · role=audience | 200 + token |
| 5 | **create** | Host: `initialize(zego)` + Session `createSession` | provider=ready · stubFallback=false |
| 6 | **publish** | Host: `startLive`（platform-live service） | session=live · local preview DOM |
| 7 | **join** | Viewer: 別 context · `initialize` + `joinLive` | session=watching |
| 8 | **play** | Viewer: remote stream 要素出現 | `[data-stream-id]` or video count ≥ 1 · 90s timeout |
| 9 | **reconnect** | Host: `reconnectLive`（Adapter） | RECONNECTING → RECONNECTED signal or state 復帰 |
| 10 | **leave** | Viewer: `leaveLive` | watching → ready |
| 11 | **cleanup** | Host: `endLive` + `dispose` | disposed · console error 0 |
| 12 | `http:platform-poc-page` | PoC URL 200 | 新規ページのみ |

### 8.2 ブラウザ構成

```text
Browser A (1280) — Host — publish
Browser B (390)  — Viewer — play
同一 roomId · 異なる userId
```

### 8.3 回帰との関係

- 既存 `verify:live-zego-poc-e2e` — **TLV PoC · 変更なし · 継続 PASS 必須**
- 新 E2E — **platform-live + Adapter** 専用 · 追加

---

## 9. Phase 1 実装（Complete · 2026-06-28）

| ファイル | 状態 |
| --- | --- |
| `platform-live/provider/adapters/zego-live-provider-adapter.js` | ✅ |
| `platform-live/provider/create-platform-live-provider.js` | ✅ factory → Adapter |
| `scripts/test-platform-live-zego-adapter-phase1.mjs` | ✅ 77 PASS |

**レポート:** [live-platform-zego-adapter-phase1.md](../reports/live-platform-zego-adapter-phase1.md)

---

## 10. Phase 2 プレビュー（参考）

| ファイル | 内容 |
| --- | --- |
| `platform-live/provider/adapters/zego-live-provider-adapter.js` | 本設計の実装 |
| `platform-live/provider/create-platform-live-provider.js` | `zego` → Adapter 返却（1 行変更） |
| `platform-live/lib/platform-live-zego-token.js`（案） | fetchToken 共通化（TlvLiveService からパターン移植 · PoC 非変更） |

**LivePlatformService Phase 1 追加（Interface 変更なし）:**

- `startLive` / `joinLive` へ `videoContainer` · `manualToken` オプション透過
- または Token/container を Adapter 内完結（Service は現状維持可）

---

## 10. 実装ブロッカー

| # | Blocker | 種別 | Phase 1 対応 |
| --- | --- | --- | --- |
| B1 | `.env` ZEGO 3 変数未設定 | Env | 人間設定 |
| B2 | Adapter ファイル未作成 | Code | Phase 1 |
| B3 | `createPlatformLiveProvider` が raw PoC を返す | Code | factory 差替 |
| B4 | `LivePlatformService` が token/container 未渡し | Code | Service 拡張 or Adapter 内 fetch のみ |
| B5 | `reconnectLive` PoC 未実装 | Design | Adapter 再認証パターン |
| B6 | SDK イベント → signal（connection_lost） | Design | Future · engine 非公開 |
| B7 | Platform 専用 PoC ページ未作成 | UI | Phase 1（TLV ページは触らない） |
| B8 | E2E スクリプト未作成 | Test | Phase 1 |

---

## 11. Go / No-Go

| 判断 | 結果 |
| --- | --- |
| **Phase 0 Adapter Design** | **Go** |
| **Phase 1 Adapter 実装** | **Go**（2026-06-28 · 77 tests PASS） |
| **Phase 2 E2E Go** | **No-Go**（`.env` ZEGO + Platform PoC ページ前） |

---

## 参照

- `live/providers/zego-live-provider.js`
- `platform-live/provider/live-provider-interface.js`
- `platform-live/core/live-provider-signals.js`
- `deploy/cloudflare/functions/api/tlv-zego-token.js`
- `live/live-service.js`（`fetchToken` パターン参考 · **変更しない**）
