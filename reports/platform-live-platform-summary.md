# Live Platform Core — 全体サマリー

**日付:** 2026-06-28  
**Status:** **Phase A〜F Complete**  
**TLV:** Pause 維持 · 共通基盤のみ · TLV UI 未接続

---

## モジュール構成

| Phase | モジュール | 主クラス | テスト | PASS |
| --- | --- | --- | --- | --- |
| A | `platform-live/core/` | `TasuLivePlatformSessionManager` | `test:platform-live-core-phase-a` | 53 |
| B | `platform-live/broadcast/` | `TasuLivePlatformBroadcastService` | `test:platform-live-broadcast-phase-b` | 50 |
| C | `platform-live/viewer/` | `TasuLivePlatformViewerService` | `test:platform-live-viewer-phase-c` | 41 |
| D | `platform-live/chat/` | `TasuLivePlatformChatGateway` | `test:platform-live-chat-phase-d` | 39 |
| E | `platform-live/recording/` | `TasuLivePlatformRecordingService` | `test:platform-live-recording-phase-e` | 55 |
| F | `platform-live/monitoring/` | `TasuLivePlatformMonitoringService` | `test:platform-live-monitoring-phase-f` | 40 |

**合計:** 278 Phase テスト PASS（2026-06-28）

---

## Edge Functions（stub · in-memory）

| Function | Phase |
| --- | --- |
| `live-platform-broadcast` | B |
| `live-platform-viewer` | C |
| `live-platform-chat` | D |
| `live-platform-recording` | E |
| `live-platform-monitoring` | F |

DB 本接続なし · TLV 非接続 · 各 Edge client は `localService` fallback 対応。

---

## surface 契約

全 API: `surface: platform | tlv | talk | builder`

MVP テスト対象: **`platform` のみ**  
`tlv` / `talk` / `builder` は予約（検証のみ · 接続なし）

---

## Provider

- `platform-live/provider/stub-live-provider.js` — ZEGO credentials 不要
- `createPlatformLiveProvider("zego", { allowStubFallback: true })` — stub フォールバック
- 実 ZEGO Provider 接続は Post-MVP

---

## 非接続（意図的）

| 対象 | 理由 |
| --- | --- |
| TLV HTML / UI | Pause · FROZEN |
| `live-broadcasts.js` | TLV bridge · 破壊禁止 |
| `live-comments.js` | UI 直結 · Gateway 未接続 |
| `watch-video.html` | VOD UI · 未接続 |
| Wallet / Tip / 30分制度 | AD / Pause |
| VOD Edge (`live-video-*`) | Recording metadata のみ · VOD 本接続なし |

---

## 回帰テスト

```bash
npm run test:platform-live-core-phase-a
npm run test:platform-live-broadcast-phase-b
npm run test:platform-live-viewer-phase-c
npm run test:platform-live-chat-phase-d
npm run test:platform-live-recording-phase-e
npm run test:platform-live-monitoring-phase-f
```

既存 `live/session/*` テスト: **98 PASS**（TLV Session Manager · 変更なし）

---

## 次ステップ（Post-MVP · 別 track）

1. Edge 本番 deploy（Supabase · secrets）
2. `surface=tlv` アダプター層（TLV Complete 後）
3. Talk / Builder surface 接続
4. ZEGO 実 Provider 接続（credentials 解消後）
5. Chat UI / live-comments.js Gateway 接続（TLV 承認後）
6. VOD / Recording 本番ストレージ接続

---

## レポート索引

- [Phase A](./platform-live-core-phase-a.md)
- [Phase B](./platform-live-broadcast-phase-b.md)
- [Phase C](./platform-live-viewer-phase-c.md)
- [Phase D](./platform-live-chat-phase-d.md)
- [Phase E](./platform-live-recording-phase-e.md)
- [Phase F](./platform-live-monitoring-phase-f.md)
- [Foundation plan](./live-platform-common-foundation-plan.md)
