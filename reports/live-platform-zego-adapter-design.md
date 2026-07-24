# Live Platform — ZEGO Adapter Design（Phase 0）

**日付:** 2026-06-28  
**Priority:** P3 Live API · **Phase 0 Adapter Design**  
**種別:** 設計のみ — **コード変更なし**  
**正本:** [docs/LIVE_PLATFORM_ZEGO_ADAPTER.md](../docs/LIVE_PLATFORM_ZEGO_ADAPTER.md)

---

## Executive summary

| 項目 | 判定 |
| --- | --- |
| **Phase 0 Adapter Design** | **Go** |
| **Phase 1 実装** | **Go**（本設計承認後） |
| **PoC 変更** | **なし**（composition のみ） |
| **Token API** | `/api/tlv-zego-token` **そのまま利用可** |

新規ファイル（Phase 1）: `platform-live/provider/adapters/zego-live-provider-adapter.js`

---

## 1. Adapter 責務

```text
┌─────────────────────────────────────────┐
│  LivePlatformService / Broadcast / Viewer │
└──────────────────┬──────────────────────┘
                   │ PlatformLiveProviderInterface
┌──────────────────▼──────────────────────┐
│  ZegoLiveProviderAdapter（新規）            │
│  · Interface 適合 · Token fetch            │
│  · Signal 合成 · 契約変換 · Future noop     │
└──────────────────┬──────────────────────┘
                   │ delegate（変更禁止）
┌──────────────────▼──────────────────────┐
│  TlvZegoLiveProvider（TLV PoC）           │
│  · ZEGO Express SDK 3.12.0               │
└─────────────────────────────────────────┘
```

| 責務 | 説明 |
| --- | --- |
| Interface 適合 | 24 メソッド中 RTC 関連を delegate / noop 分岐 |
| PoC 委譲 | `initialize` · `startLive` · `joinLive` · `leaveLive` · `endLive` · `dispose` |
| Token | Adapter 内 `POST /api/tlv-zego-token`（host/audience） |
| Signal | PoC 戻り値 + 操作タイミングから `PROVIDER_*` / `BROADCAST_*` 合成 |
| createSession | Session Manager 管轄 · Adapter は context キャッシュのみ |
| Future | chat / recording / monitoring → Stub 互換 noop |

---

## 2. Interface 対応表

### 2.1 操作語彙（Adapter 内部モデル）

| Adapter 操作 | Platform Interface | ZEGO SDK | TLV PoC |
| --- | --- | --- | --- |
| initialize | `initialize` | `ZegoExpressEngine` 生成 | `initialize({ appId, server })` |
| createSession | Session Manager（Provider 外） | — | — |
| joinSession | `joinLive` / `joinViewer` | `loginRoom` | `joinLive` |
| leaveSession | `leaveLive` / `leaveViewer` | `logoutRoom` · `stopPlayingStream` | `leaveLive` |
| reconnect | `reconnectLive` / `reconnectViewer` | 再 `loginRoom` | **なし** → Adapter 再認証 |
| publish | `startLive` / `startBroadcast` | `startPublishingStream` | `startLive` |
| subscribe | `joinLive` / `joinViewer` | `startPlayingStream` | `joinLive` + `roomStreamUpdate` |
| stopPublish | `endLive` / `stopBroadcast` | `stopPublishingStream` | `endLive` |
| stopSubscribe | `leaveLive` | `stopPlayingStream` | `leaveLive` 内包 |
| disconnect | `dispose` | `destroyEngine` | `dispose` |

### 2.2 完全差分表

| Platform Interface | TLV PoC | Adapter 実装 | Future |
| --- | --- | --- | --- |
| `initialize` | `{ appId, server }` | config マージ + delegate | |
| `startLive` | token · videoContainer 必須 | fetchToken(host) + delegate | |
| `joinLive` | 同上 | fetchToken(audience) + delegate | |
| `leaveLive` | ✓ | delegate + DISCONNECTED | |
| `endLive` | ✓ | delegate + signals | |
| `reconnectLive` | ✗ | 再認証パターン + RECONNECTING/RECONNECTED | SDK イベント |
| `startBroadcast` | ✗ | publish 委譲 + BROADCAST signals | |
| `stopBroadcast` | ✗ | endLive 委譲 | |
| `getBroadcastHealth` | ✗ | state ベース | SDK quality |
| `updateViewerCount` | ✗ | noop ok | |
| `joinViewer` | ✗ | joinLive 委譲 | |
| `leaveViewer` | ✗ | leaveLive 委譲 | |
| `reconnectViewer` | ✗ | reconnect 委譲 | |
| `viewerHeartbeat` | ✗ | noop ok | |
| `sendChatMessage` | ✗ | noop ok | ZEGO IM |
| `addChatReaction` | ✗ | noop ok | |
| `removeChatReaction` | ✗ | noop ok | |
| `emitChatSystemEvent` | ✗ | noop ok | |
| `startRecording` | ✗ | noop ok | Cloud Recording |
| `stopRecording` | ✗ | noop ok | |
| `getRecordingStatus` | ✗ | idle 返却 | |
| `getArchiveMetadata` | ✗ | noop ok | |
| `getMonitoringProbe` | ✗ | state probe | SDK metrics |
| `dispose` | ✓ | delegate | |
| `onSignal` | ✗ | Adapter 実装 | |
| `onBroadcastSignal` | ✗ | Adapter 実装 | |

---

## 3. Signal 対応

### Session

| 要求 | Platform Signal | Adapter 発火条件 |
| --- | --- | --- |
| connected | `PROVIDER_CONNECTED` | loginRoom 成功（delegate 後） |
| disconnected | `PROVIDER_DISCONNECTED` | leaveLive / endLive / dispose 後 |
| reconnecting | `PROVIDER_RECONNECTING` | reconnect API 開始時 |
| error | `PROVIDER_ERROR` | `{ ok: false }` or throw |

追加（Platform 正本）: `PROVIDER_CONNECTING`（login 前）· `PROVIDER_RECONNECTED` · `PROVIDER_CONNECTION_LOST`（Future）

### Broadcast

| 操作 | Signal |
| --- | --- |
| publish 開始 | `BROADCAST_PROVIDER_STARTING` → `STARTED` |
| stop publish | `BROADCAST_PROVIDER_STOPPING` → `STOPPED` |
| health check | `BROADCAST_PROVIDER_HEALTH_OK` |

### Future（chat · recording · monitoring）

| 領域 | Phase 0 | Future |
| --- | --- | --- |
| chat | Interface noop · Gateway Edge 正本 | ZEGO IM Provider |
| recording | Interface noop | ZEGO Cloud Recording + webhook |
| monitoring | state ベース probe のみ | SDK stats · egress |

---

## 4. Secret 一覧

| 名前 | 種別 | 必須 | 備考 |
| --- | --- | --- | --- |
| `ZEGO_APP_ID` | Server + Client | ✅ | Token レスポンスにも含む |
| `ZEGO_SERVER` | Server + Client | ✅ | wss URL |
| `ZEGO_SERVER_SECRET` | Server only | ✅ | 32 byte · Token 署名 |
| Manual Token | Dev only | — | Console 24h · E2E fallback |
| `TLV_LIVE_ZEGO_CONFIG` | Client file | — | gitignore · PoC/Adapter 共有 |

**追加 Secret: なし**（Phase 1 時点）

---

## 5. Token 利用可否

### **利用可能（Go）— コード変更不要**

| 項目 | 内容 |
| --- | --- |
| Endpoint | `POST /api/tlv-zego-token` |
| Host publish | `{ role: "host" }` |
| Viewer subscribe | `{ role: "audience" }` |
| 8788 | `npm run dev` + `.env` で 200 |
| 制限 | パス名が `tlv-*` だが RTC 汎用 · surface 非依存 |

**利用不可になるのは環境のみ:** `.env` 未設定 · secret 長不正 · dev server 未起動

---

## 6. E2E シナリオ（`verify-platform-live-zego-integration-e2e` · 設計のみ）

| # | Step | Actor | Action |
| --- | --- | --- | --- |
| A | env + config | node | ZEGO 3 変数 · dist config |
| B | token | node | host + audience token API |
| C | **create** | host browser | initialize(zego) + createSession |
| D | **publish** | host | startLive → publish |
| E | **join** | viewer browser | initialize + joinLive |
| F | **play** | viewer | remote stream DOM 出現 |
| G | **reconnect** | host | reconnectLive |
| H | **leave** | viewer | leaveLive |
| I | **cleanup** | host | endLive + dispose |
| J | report | node | JSON · console error 0 |

**除外:** TLV `live-zego-poc.html` · Chat UI · VOD · Wallet

---

## 7. 実装ブロッカー

| # | Blocker | 解消 |
| --- | --- | --- |
| 1 | ZEGO `.env` 未設定 | 人間 |
| 2 | Adapter 未実装 | Phase 1 |
| 3 | factory が raw PoC を返す | Phase 1 factory |
| 4 | Service が token/container 未透過 | Phase 1 Service or Adapter 内完結 |
| 5 | reconnect PoC なし | Adapter 再認証（設計済） |
| 6 | Platform PoC ページなし | Phase 1 新規（TLV 非変更） |
| 7 | E2E 未実装 | Phase 1 |

---

## 8. Go / No-Go

| 判断 | 結果 | 次アクション |
| --- | --- | --- |
| **Phase 0 Adapter Design** | **Go** | — |
| **Phase 1 Adapter 実装** | **Go** | `zego-live-provider-adapter.js` 作成 |
| **Phase 1 E2E PASS** | **No-Go** | B1–7 解消後 |
| **TLV PoC 変更** | **No-Go** | 維持 |
| **Platform Interface 変更** | **No-Go** | 維持 |

---

## 完了報告（8 項目）

1. **Adapter 責務** — Interface 適合 · PoC delegate · Token · Signal 合成 · Future noop（§1）
2. **Interface 対応表** — 操作語彙表 + 24 メソッド差分表（§2）
3. **Signal 対応** — connected/disconnected/reconnecting/error + broadcast signals（§3）
4. **Secret 一覧** — ZEGO 3 変数 + config · 追加なし（§4）
5. **Token 利用可否** — `/api/tlv-zego-token` **そのまま利用可**（§5）
6. **E2E シナリオ** — create/join/publish/play/reconnect/leave/cleanup（§6）
7. **実装ブロッカー** — 7 項（§7）
8. **Go / No-Go** — Design **Go** · Phase 1 実装 **Go** · E2E **No-Go**（§8）

---

## 参照

- [LIVE_PLATFORM_ZEGO_ADAPTER.md](../docs/LIVE_PLATFORM_ZEGO_ADAPTER.md)
- [live-platform-zego-integration-readiness.md](./live-platform-zego-integration-readiness.md)
- [platform-live-platform-summary.md](./platform-live-platform-summary.md)
