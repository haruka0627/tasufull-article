# Live Platform Viewer — Phase C 完了レポート

**日付:** 2026-06-28  
**Priority:** P2 Live Platform 共通基盤  
**TLV:** Pause 維持 · watch-video / live-broadcasts 非接続  
**正本:** [foundation plan](./live-platform-common-foundation-plan.md) · [Phase B](./platform-live-broadcast-phase-b.md)

---

## Executive summary

| 項目 | 結果 |
| --- | --- |
| **Phase C 実装** | **Complete** |
| **Phase C テスト** | **41/41 PASS** |
| **Phase A regression** | **53/53 PASS** |
| **Phase B regression** | **50/50 PASS** |
| **live-broadcasts.js / watch-video** | **未変更 · 未接続** |
| **Go / No-Go** | **Go** |
| **Phase D 開始** | **可**（Chat Gateway） |

---

## 1. 変更ファイル一覧

### 新規

| パス | 内容 |
| --- | --- |
| `platform-live/viewer/live-viewer-states.js` | Viewer 状態定数 |
| `platform-live/viewer/live-viewer-events.js` | Event 定数 |
| `platform-live/viewer/live-viewer-error-codes.js` | Error codes |
| `platform-live/viewer/live-viewer-validation.js` | 入力検証 |
| `platform-live/viewer/live-viewer-permission.js` | MVP permission |
| `platform-live/viewer/live-viewer-ccu-registry.js` | **CCU 正本**（in-memory） |
| `platform-live/viewer/live-viewer-service.js` | `TasuLivePlatformViewerService` |
| `platform-live/viewer/live-viewer-edge-client.js` | Edge クライアント |
| `supabase/functions/live-platform-viewer/index.ts` | Edge stub |
| `scripts/test-platform-live-viewer-phase-c.mjs` | Phase C テスト |
| `reports/platform-live-viewer-phase-c.md` | 本レポート |

### 更新

| パス | 内容 |
| --- | --- |
| `platform-live/provider/live-provider-interface.js` | viewer メソッド |
| `platform-live/provider/stub-live-provider.js` | join/leave/reconnect/heartbeat |
| `platform-live/broadcast/live-broadcast-service.js` | `syncCcuFromViewerRegistry` |
| `platform-live/README.md` | Phase C 追記 |
| `package.json` | `test:platform-live-viewer-phase-c` |
| `docs/PROJECT_STATUS.md` | Phase C Complete |
| `docs/TODO.md` | Phase C 完了 |

### 未変更（意図的）

`live/watch-video.html`、`live/live-broadcasts.js`、`live/session/*`、`live/*.html`

---

## 2. 実装内容

`TasuLivePlatformViewerService` が以下を提供:

- `joinViewer` / `leaveViewer` / `reconnectViewer`
- `heartbeat` — active viewer 更新
- `checkPermission` — join/reconnect 前検証
- `getWatchState` — viewer + broadcast + CCU 合成
- `getCcu` — CCU 正本参照
- `kickViewer` / `banViewer` / `expireStaleViewers`

Optional 連携: `broadcastService`（CCU sync）、`sessionManager`（join/leave/reconnect）、`provider`（stub）

---

## 3. Viewer state 設計

```text
idle → joining → watching → left → idle
                    ↓
              reconnecting → watching
                    ↓
         kicked | expired | failed → idle (reset/kick block)
```

| 状態 | 説明 |
| --- | --- |
| `joining` | 入室処理中 |
| `watching` | 視聴中（heartbeat 対象） |
| `idle` | 未参加 / leave 後 |
| `reconnecting` | 再接続中 |
| `left` | 正常退室 |
| `kicked` | 強制退室（再 join 不可） |
| `expired` | TTL 失効（reconnect 不可） |
| `failed` | 異常終了 |

---

## 4. Permission 設計（MVP）

| チェック | join | reconnect |
| --- | --- | --- |
| valid surface | ✓ | ✓ |
| broadcast `live` | ✓ | ✓ |
| banned viewer | 拒否 | 拒否 |
| kicked viewer | 拒否 | 拒否 |
| expired viewer | — | 拒否 |

**未実装（意図的）:** Wallet · paid · 30分制度

---

## 5. Heartbeat / CCU 設計

| 項目 | 内容 |
| --- | --- |
| **正本** | `TasuLivePlatformViewerCcuRegistry`（in-memory） |
| **TTL** | デフォルト 30s（設定可） |
| **heartbeat** | register 更新 → CCU 再計算 |
| **leave/kick/expire** | unregister → CCU 減算 |
| **broadcast sync** | `_syncCcuToBroadcast` → `broadcastService.updateViewerCount` |
| **DB** | 未接続（Phase C スコープ外） |

---

## 6. Edge（live-platform-viewer）

**stub · in-memory · DB/TLV 非接続**

| action | 内容 |
| --- | --- |
| `join` / `leave` / `reconnect` / `heartbeat` | viewer lifecycle |
| `permission` / `watch_state` / `ccu` / `kick` | 補助 API |
| `set_live` | テスト用 broadcast live フラグ |

---

## 7. テスト結果

```text
npm run test:platform-live-viewer-phase-c     → 41 PASS
npm run test:platform-live-core-phase-a       → 53 PASS
npm run test:platform-live-broadcast-phase-b  → 50 PASS
npm run test:live-session-manager             → 36 PASS
npm run test:live-service-session             → 25 PASS
npm run test:live-broadcasts-session-bridge   → 16 PASS
npm run test:live-session-provider-signals    → 14 PASS
npm run test:live-session-error-policy        → 34 PASS
```

---

## 8. live/watch-video · live-broadcasts.js への影響

| 項目 | 影響 |
| --- | --- |
| ファイル変更 | **なし** |
| import / 配線 | **なし** |
| Session bridge | flag OFF 維持 |

---

## 9. TLV 未接続の確認

- [x] TLV HTML 未変更
- [x] `watch-video.html` 未変更
- [x] `live-broadcasts.js` 未変更
- [x] Wallet / Tip / 30分 未参照
- [x] Edge DB 未接続

---

## 10. Phase C Go / No-Go

**Go** — Viewer Core · permission · CCU 正本 · 全テスト PASS

---

## 11. Phase D 開始可否

**可** — Chat Gateway（`platform-live/chat/` · Edge `live-platform-chat`）に着手可能。UI 非実装 · gateway client のみがスコープ。

---

## 次アクション

1. Phase D Chat Gateway 設計確認 · 着手
2. Edge `live-platform-viewer` staging デプロイ（任意）
3. `live_p0_schema` 適用後 DB CCU 正本化（Post-MVP）
