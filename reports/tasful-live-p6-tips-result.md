# TASFUL LIVE Phase 6 — 投げ銭 stub / ギフト / 履歴 実装結果

| 項目 | 内容 |
|------|------|
| 実行日 | **2026-06-23** |
| スコープ | ギフト UI · live_tips insert · 応援履歴 · 視聴画面連携 |
| 対象外 | Stripe 実決済 · 残高 / 出金 · creator 通知 fanout |

---

## 判定

| 判定 | **Phase 6 完了 — smoke / 回帰 PASS** |
|------|--------------------------------------|
| 意味 | P0 固定ギフトから `live_tips` へ stub insert · 履歴表示 · 視聴画面ギフト導線 |

---

## 1. 実装ファイル一覧

| ファイル | 変更 |
|----------|------|
| [`live/gifts.html`](../live/gifts.html) | **新規** — ギフト選択 |
| [`live/tips.html`](../live/tips.html) | **新規** — 応援履歴 |
| [`live/live-gifts.js`](../live/live-gifts.js) | **新規** — ギフト UI |
| [`live/live-tips.js`](../live/live-tips.js) | **新規** — insert / 履歴 |
| [`live/live-config.js`](../live/live-config.js) | `live_tips` · P0 ギフト定義 · URL ヘルパー |
| [`live/live-broadcasts.js`](../live/live-broadcasts.js) | 視聴画面「ギフト」ボタン |
| [`live/live-profile.js`](../live/live-profile.js) | 応援履歴導線 |
| [`live/live.css`](../live/live.css) | ギフト / 履歴スタイル |
| [`live/index.html`](../live/index.html) | ギフト / 履歴カード |
| [`scripts/verify-live-p6-tips.mjs`](../scripts/verify-live-p6-tips.mjs) | **新規** |
| [`package.json`](../package.json) | `verify:live-p6` |

---

## 2. P0 固定ギフト

| ギフト | price_yen |
|--------|-----------|
| 花 | 100 |
| コーヒー | 300 |
| ギフトBOX | 500 |
| 王冠 | 1000 |
| ロケット | 3000 |

UI に **「stub決済 / テスト用」** を明記。Stripe Checkout / 実決済コードなし。

---

## 3. live_tips insert

スキーマに `gift_name` / `provider` 列はないため、以下でマッピング:

| 要求項目 | 実装 |
|----------|------|
| sender | `tipper_id` = 現在ユーザー |
| creator | `creator_id` |
| broadcast | `target_type: "broadcast"` · `target_id`（stub 時は固定 UUID） |
| gift_name | `message` 先頭 `【花】` 形式、履歴は amount からも復元 |
| amount_yen | ギフト価格 |
| payment_status | **`stub`** |
| provider | DB 列なし · `payment_status=stub` で表現 |
| message | 任意（100文字以内） |
| update | **クライアントから不可**（insert のみ） |

stub 配信 `broadcast_id=stub` の `target_id`: `00000000-0000-4000-8000-0000000000bb`

---

## 4. 画面連携

| 画面 | 連携 |
|------|------|
| `watch.html` | 「ギフト」→ `gifts.html?broadcast_id=…&creator_user_id=…` |
| `profile.html` | 自分: 応援履歴 · 他人: 自分の応援履歴リンク |
| `gifts.html` | ギフト選択 → stub 送信 |
| `tips.html` | 送った / 受け取った履歴 |

---

## 5. 通知（Phase 7 送り）

| 項目 | Phase 6 |
|------|---------|
| creator 向け投げ銭通知 | **未実装** — `talk_notifications` RLS でクライアント cross-user insert 不可 |
| `live_notify_dedupe` | **未使用** |
| 次フェーズ | Edge fanout または RPC（Phase 7 検討） |

---

## 6. 検証結果

### `npm run verify:live-p6`

| PASS | FAIL | SKIP |
|------|------|------|
| 49 | 0 | 0 |

- `live_tips` · `payment_status=stub` 使用確認
- Stripe Checkout 本接続なし
- 390 / 768 / 1280 · console error **0**

### 回帰

| コマンド | 結果 |
|----------|------|
| `verify:live-p5` 〜 `p0-schema` | **PASS** |
| `verify-talk-chat-unify-p1` | **PASS** 22/22 |
| `smoke-match-talk-room` | **PASS** 16 |

---

## 7. 手動確認

```text
http://127.0.0.1:8788/live/watch.html?broadcast_id=stub&talkDev=1
http://127.0.0.1:8788/live/gifts.html?broadcast_id=stub&creator_user_id=u_creator&talkDev=1
http://127.0.0.1:8788/live/tips.html?talkDev=1
```

1. 視聴画面で「ギフト」表示（自分以外の配信）
2. ギフト選択 → stub 送信 → `live_tips` 行追加
3. 応援履歴で送った / 受け取った一覧

---

## 8. Phase 7 への引き継ぎ

| 項目 | 内容 |
|------|------|
| Stripe Live 決済 | 2026年9月以降 |
| 投げ銭通知 fanout | Edge / RPC |
| `gift_name` 専用列 | migration 検討 |
| like / follower 集計 RPC | 継続検討 |

---

## 9. 総括

Phase 6 で **投げ銭 stub（実決済なし）** のギフト UI と `live_tips` 記録・履歴表示が完了した。creator 通知は RLS 制約により Phase 7 へ委譲している。
