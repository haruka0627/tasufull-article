# Live Platform — ZEGO Adapter Phase 1

**日付:** 2026-06-28  
**Status:** **Phase 1 Complete · Go**  
**テスト:** `npm run test:platform-live-zego-adapter-phase1` — **77/77 PASS**

---

## 変更ファイル

| ファイル | 種別 |
| --- | --- |
| `platform-live/provider/adapters/zego-live-provider-adapter.js` | **新規** |
| `scripts/test-platform-live-zego-adapter-phase1.mjs` | **新規** |
| `platform-live/provider/create-platform-live-provider.js` | 更新 |
| `platform-live/README.md` | 更新 |
| `package.json` | script 追加 |
| `docs/PROJECT_STATUS.md` | 更新 |
| `docs/TODO.md` | 更新 |

**未変更（確認済）:**

- `live/providers/zego-live-provider.js`
- `platform-live/provider/live-provider-interface.js`
- Edge / UI / TLV 接続

---

## Adapter 実装

`ZegoLiveProviderAdapter` extends `PlatformLiveProviderInterface`

- **composition:** `TlvZegoLiveProvider` を `_poc` として delegate
- **Token:** `fetchToken()` → `POST /api/tlv-zego-token`（host/audience role）
- **Config:** `PLATFORM_LIVE_ZEGO_CONFIG` or `TLV_LIVE_ZEGO_CONFIG`
- **RTC:** `startLive`/`startBroadcast` → publish · `joinLive`/`joinViewer` → subscribe
- **reconnect:** session cache → `endLive`/`leaveLive` → Token 再取得 → 再 publish/subscribe
- **Signals:** `PROVIDER_*` · `BROADCAST_PROVIDER_*` を操作前後に合成
- **Future:** chat / recording / monitoring — `{ ok: true, future: true }` noop

---

## Factory

```javascript
createPlatformLiveProvider("zego")
  → ZegoLiveProviderAdapter（PoC + Adapter ロード時）
  → StubLiveProvider + _stubFallbackFrom: "zego"（未ロード時）
```

---

## Token API

| 項目 | 内容 |
| --- | --- |
| Endpoint | `/api/tlv-zego-token`（変更なし） |
| Host | `role: "host"` |
| Audience | `role: "audience"` |
| Manual | `manualToken` 指定時は fetch スキップ |

---

## テスト結果

| スイート | 結果 |
| --- | --- |
| Phase 1 Adapter | **77 PASS** |
| Phase A | PASS（regression） |
| Phase B | PASS |
| Phase C | PASS |
| Phase D | PASS |
| Phase E | PASS |
| Phase F | PASS |

---

## Go / No-Go

| 判断 | 結果 |
| --- | --- |
| **Phase 1 Adapter 実装** | **Go** |
| **Phase 2 E2E 着手** | **Conditional Go** — `.env` ZEGO 3 変数 + Platform PoC ページ |

---

## Phase 2（次）

1. `verify-platform-live-zego-integration-e2e.mjs`（設計済）
2. Platform 専用 PoC ページ（TLV 非変更）
3. `LivePlatformService` — `videoContainer` / `manualToken` 透過（任意）

---

## 参照

- [LIVE_PLATFORM_ZEGO_ADAPTER.md](../docs/LIVE_PLATFORM_ZEGO_ADAPTER.md)
- [live-platform-zego-adapter-design.md](./live-platform-zego-adapter-design.md)
