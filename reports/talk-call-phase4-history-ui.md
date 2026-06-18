# TASFUL TALK 通話 Phase4 — 通話履歴 UI

**作成日:** 2026-06-17  
**Epic:** TALK WebRTC 1:1 音声通話 Phase4（履歴 UI）  
**前提:** [Phase3 通知センター着信](talk-call-phase3-notification-center.md) · [Phase2 chat-detail](talk-call-phase2-chat-detail.md)

---

## サマリー

| 項目 | 結果 |
|------|------|
| **chat-detail 通話履歴カード** | ✅ メッセージタイムラインに統合 |
| **TALK 通知センター履歴** | ✅ ended / missed / rejected（通常通知） |
| **ringing 着信カード** | ✅ 重要通知のまま（Phase3 維持） |
| **caller / callee 別文言** | ✅ |
| **重複防止・最大20件** | ✅ |
| **Phase1〜3 回帰** | ✅ PASS |
| **Push / TURN / ビデオ** | ⬜ 対象外 |

---

## 1. 実装範囲

### 1.1 新規モジュール

| ファイル | 責務 |
|----------|------|
| [`scripts/talk-call-history.js`](../scripts/talk-call-history.js) | セッション→履歴アイテム変換 · タイムライン merge · HTML 描画 · 通知 upsert · Realtime 更新 |

### 1.2 chat-detail 履歴表示

- `#chatMessages` タイムラインに `kind: "call_history"` を merge
- 属性: `data-talk-call-history-item`, `data-call-id`, `data-room-id`, `data-call-direction`, `data-call-status`
- 控えめな `.chat-call-history` カード（発信/着信ラベル · 📤/📥 · 通話時間）
- `syncDisplayMessages` → `applyDisplayWithCallHistory` で非同期 merge
- 通話終了時 `tasu:talk-call-history-refresh` で再描画

**文言マッピング（viewer 視点）**

| status | caller | callee |
|--------|--------|--------|
| ended（通話あり） | 通話が終了しました + duration | 同左 |
| ended（未接続） | 音声通話を発信しました | 音声通話の着信がありました |
| missed | 応答されませんでした | 不在着信 |
| rejected | 拒否されました | 通話は拒否されました |

### 1.3 TALK 通知センター

- **ringing** (`subType: incoming_call`) — 重要通知 · 応答/拒否 CTA（Phase3 維持）
- **履歴** (`subType: call_history`) — 通常通知 · 「チャットを開く」ナビゲート
- terminal 時: ringing カード削除 → 履歴通知 upsert

### 1.4 変更ファイル

| ファイル | 変更 |
|----------|------|
| [`scripts/talk-call-signaling.js`](../scripts/talk-call-signaling.js) | `fetchSessionsByRoom(roomId)` |
| [`scripts/talk-call-service.js`](../scripts/talk-call-service.js) | terminal session → `onSessionTerminal` |
| [`scripts/talk-call-notify-bridge.js`](../scripts/talk-call-notify-bridge.js) | incoming 判定厳格化 · `onSessionHistory` |
| [`chat-detail.js`](../chat-detail.js) / [`chat-detail.html`](../chat-detail.html) | 履歴 merge + render 分岐 |
| [`talk-home.html`](../talk-home.html) | history script load |
| [`talk-home.js`](../talk-home.js) / [`talk-notify-tier.js`](../talk-notify-tier.js) | 履歴は通常通知 |
| [`talk-home-data.js`](../talk-home-data.js) | talk_call_v1 recipient フィルタ |
| [`talk-call.css`](../talk-call.css) | 履歴カード · 390px 対応 |

---

## 2. 対象外

| 機能 | 備考 |
|------|------|
| Push 通知 | 未実装 |
| TURN | STUN のみ |
| ビデオ通話 | 未実装 |
| 通話履歴の Supabase messages 永続化 | `talk_call_sessions` を正とする |
| talk-home チャットタブ inline 履歴 | chat-detail 中心（line-room 未対応） |

---

## 3. 検証結果

### Phase4 E2E

```bash
SUPABASE_STRICT=1 node scripts/test-talk-call-history-ui.mjs
```

| チェック | 結果 |
|----------|------|
| 発信→応答→切断 → ended 履歴（A/B） | ✅ |
| 拒否履歴（A/B） | ✅ |
| missed 履歴（不在着信 / 応答なし） | ✅ |
| call_id 重複なし · 再描画でも重複なし | ✅ |
| 他 room 混入なし | ✅ |
| 390px レイアウト | ✅ |
| 履歴件数上限（fetch ≤20） | ✅ |

### 回帰

| テスト | 結果 |
|--------|------|
| `test-talk-webrtc-call-browser.mjs` | ✅ PASS |
| `test-talk-call-chat-detail.mjs` | ✅ PASS |
| `test-talk-call-notification-center.mjs` | ✅ PASS |

---

## 4. 既知の制約

1. **duration** — DB に duration 列なし。`started_at` / `ended_at` から算出。
2. **履歴上限** — room あたり最新 20 セッション（ended/missed/rejected）。
3. **active / ringing** — 履歴には含めず terminal のみ。
4. **通知履歴** — 通常通知。ringing のみ urgent / 重要扱い。

---

## 5. 完了条件

| 条件 | 状態 |
|------|------|
| Phase1 PASS | ✅ |
| Phase2 PASS | ✅ |
| Phase3 PASS | ✅ |
| Phase4 PASS | ✅ |
| 通話専用 E2E FAIL 0 | ✅ |
| レポート | ✅ 本ドキュメント |
