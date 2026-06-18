# TASFUL TALK 通話 Phase3 — TALK通知センター着信

**作成日:** 2026-06-17  
**Epic:** TALK WebRTC 1:1 音声通話 Phase3（通知センター着信）  
**前提:** [Phase2 chat-detail 連携](talk-call-phase2-chat-detail.md) · [Phase1 実装状況](talk-call-feature-status.md)

---

## サマリー

| 項目 | 結果 |
|------|------|
| **TALKホーム着信検知（フォアグラウンド）** | ✅ Realtime + poll fallback |
| **通知センター着信カード** | ✅ 重要通知 · 応答/拒否 CTA |
| **応答 → chat-detail 遷移** | ✅ `callId` query 連携 |
| **拒否 → rejected 反映** | ✅ 発信側セッション更新 |
| **重複防止** | ✅ call_id / room 単位 |
| **Phase1 / Phase2 回帰** | ✅ PASS |
| **Push / TURN / ビデオ / 通話履歴 UI** | ⬜ 対象外 |

---

## 1. 実装範囲

### 1.1 新規モジュール

| ファイル | 責務 |
|----------|------|
| [`scripts/talk-call-notify-bridge.js`](../scripts/talk-call-notify-bridge.js) | ringing 検知 · 通知 upsert/remove · poll · reject API · chat-detail URL 生成 |

### 1.2 通知センター UI（talk-home.js）

- `isTalkCallIncomingNotify` / `renderTalkCallIncomingActionsHtml`
- カード属性: `data-talk-call-notification`, `data-call-id`, `data-room-id`
- 文言: **音声通話の着信** / **{相手名}さんから通話リクエストがあります**
- CTA: **応答する** (`call-accept`) · **拒否** (`call-reject`)
- `isNotifyNavigateCard` から通話着信を除外（専用 dual-action カードを使用）
- `talk-home.html` に bridge script 追加

### 1.3 コア拡張

| ファイル | 変更 |
|----------|------|
| [`scripts/talk-call-service.js`](../scripts/talk-call-service.js) | `onSessionChange` → bridge 通知 · overlay は **同一 room / chat タブのみ** · `rejectCallSession` · `prepareIncomingForCallId` |
| [`scripts/talk-call-chat-detail.js`](../scripts/talk-call-chat-detail.js) | `callId` query で着信 overlay 優先表示 |
| [`talk-notify-tier.js`](../talk-notify-tier.js) | 通話着信を **重要通知** に分類 |
| [`talk-notify-content-type.js`](../talk-notify-content-type.js) | ラベル「通話」 |
| [`talk-notifications-store.js`](../talk-notifications-store.js) | `callSessionId` フィールド |
| [`talk-home-data.js`](../talk-home-data.js) | `talk_call_v1` を recipientUserId でフィルタ |
| [`talk-call.css`](../talk-call.css) | 390px 向け dual-action レイアウト |

### 1.4 フロー

```
A: chat-detail 発信
  → talk_call_sessions (ringing)

B: talk-home（通知タブ）
  → Realtime / poll → bridge upsert 通知
  → 通知センターに着信カード（overlay は出さない）

B: 「応答する」
  → chat-detail.html?thread=roomId&callId=sessionId
  → prepareIncomingForCallId → overlay → accept → active

B: 「拒否」（通知タブ）
  → rejectCallSession → rejected → カード削除 · A に反映
```

---

## 2. 対象外

| 機能 | 備考 |
|------|------|
| Web Push / バックグラウンド着信 | フォアグラウンドのみ |
| TURN | Phase1 同様 STUN のみ |
| ビデオ通話 | 未実装 |
| 通話履歴 UI | 未実装 |
| ANPI 通知導線 | 既存コード変更なし（着信カードは独立 source） |

---

## 3. 検証結果

### 3.1 Phase3 E2E

```bash
SUPABASE_STRICT=1 node scripts/test-talk-call-notification-center.mjs
```

| チェック | 結果 |
|----------|------|
| talk-home モジュール load | ✅ |
| A chat-detail 発信 → B 通知カード | ✅ |
| タイトル / 本文 / roomId / data 属性 | ✅ |
| 同一 call 重複なし | ✅ |
| 390px カードレイアウト | ✅ |
| 応答 → chat-detail → 通話成立 | ✅ |
| 通知拒否 → A rejected | ✅ |
| ended / reject 後カード削除 | ✅ |
| 他ユーザー宛非表示 | ✅ |

### 3.2 回帰

| テスト | 結果 |
|--------|------|
| `SUPABASE_STRICT=1 test-talk-call-chat-detail.mjs` | ✅ PASS |
| `SUPABASE_STRICT=1 test-talk-webrtc-call-browser.mjs` | ✅ PASS |
| `test-talk-anpi-notify.mjs` | ✅ PASS（ANPI 通知 smoke） |

---

## 4. 既知の制約

1. **通知タブでは overlay 非表示** — 着信 UI は通知カード。overlay は chat-detail または talk-home **チャットタブ同一 room** のみ。
2. **フォアグラウンド限定** — アプリ非起動時の Push 着信なし。
3. **localStorage 通知** — 着信カードは `tasful_talk_notifications` に保存。ended 後は bridge が reconcile で削除。

---

## 5. 変更ファイル一覧

| 種別 | パス |
|------|------|
| 新規 | `scripts/talk-call-notify-bridge.js` |
| 新規 | `scripts/test-talk-call-notification-center.mjs` |
| 新規 | `reports/talk-call-phase3-notification-center.md` |
| 変更 | `talk-home.html` / `talk-home.js` / `talk-home-data.js` |
| 変更 | `talk-notify-tier.js` / `talk-notify-content-type.js` |
| 変更 | `talk-notifications-store.js` |
| 変更 | `scripts/talk-call-service.js` / `scripts/talk-call-chat-detail.js` |
| 変更 | `talk-call.css` |

---

## 6. 完了条件

| 条件 | 状態 |
|------|------|
| Phase1 PASS | ✅ |
| Phase2 PASS | ✅ |
| Phase3 PASS | ✅ |
| 通話専用 E2E FAIL 0 | ✅ |
| TALK 通知 smoke（ANPI） | ✅ |
| レポート | ✅ 本ドキュメント |
