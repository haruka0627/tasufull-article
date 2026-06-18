# TALK 音声通話 — Web Push（VAPID）本番デプロイ手順

本番 Web Push 実送信の投入・確認・ロールバック手順。**VAPID 秘密鍵を Git / ログ / DB / このドキュメントに記載しないこと。**

関連: [`talk-call-turn-production-checklist.md`](talk-call-turn-production-checklist.md) · Phase7 基盤レポート [`reports/talk-call-phase7-push-foundation.md`](../reports/talk-call-phase7-push-foundation.md)

---

## 1. 前提

| 項目 | 内容 |
|------|------|
| DB | `talk_call_push_events`, `talk_push_subscriptions` 適用済み |
| Phase7.1 migration | `status` (active/inactive), `retry_eligible` |
| Edge Function | `talk-call-push-notify`（web-push 実送信） |
| Service Worker | `/talk-service-worker.js`（scope `/`） |
| クライアント公開鍵 | `TASU_TALK_CALL_CONFIG.webPushVapidPublicKey` のみ |

---

## 2. VAPID 鍵生成

Node.js（`web-push`）または OpenSSL で生成。**秘密鍵はローカル一時ファイルのみ。**

```bash
npx web-push generate-vapid-keys
```

出力例（**本番鍵をコミットしない**）:

- Public Key → Supabase secret `WEB_PUSH_VAPID_PUBLIC_KEY` + クライアント設定
- Private Key → Supabase secret `WEB_PUSH_VAPID_PRIVATE_KEY` のみ
- Subject → `mailto:your-team@example.com` → `WEB_PUSH_VAPID_SUBJECT`

---

## 3. Supabase secrets 設定

Supabase Dashboard → Project Settings → Edge Functions → Secrets、または CLI:

```bash
supabase secrets set WEB_PUSH_VAPID_PUBLIC_KEY="<public-key>"
supabase secrets set WEB_PUSH_VAPID_PRIVATE_KEY="<private-key>"
supabase secrets set WEB_PUSH_VAPID_SUBJECT="mailto:support@example.com"
```

| Secret | 用途 |
|--------|------|
| `WEB_PUSH_VAPID_PUBLIC_KEY` | Edge 送信 + ブラウザ subscribe（公開可） |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | Edge のみ（**絶対にクライアントへ出さない**） |
| `WEB_PUSH_VAPID_SUBJECT` | VAPID subject（mailto: または https: URL） |

secrets 未設定時: Edge は `delivery_status: skipped`（pending を残さない）。

---

## 4. DB migration（Phase7.1）

```bash
node scripts/apply-talk-call-push-supabase.mjs
```

追加カラム:

- `talk_push_subscriptions.status` — `active` / `inactive`
- `talk_call_push_events.retry_eligible` — `failed` 時のみ `true`

---

## 5. Edge Function デプロイ

```bash
supabase functions deploy talk-call-push-notify --no-verify-jwt
```

`--no-verify-jwt` は service role / 内部 invoke 用。本番では DB Webhook または server-side invoke から呼び出す。

### 処理フロー

```
pending → subscription(active) 取得 → session=ringing 確認
  → webpush.sendNotification → sent
  → 410/404 → subscription inactive + failed (retry_eligible)
  → VAPID 未設定 → skipped
```

### 再送防止

| status | 再送 |
|--------|------|
| `sent` | しない |
| `skipped` | しない |
| `failed` | `retry_eligible=true` のみ（別ジョブで再試行可） |
| 同一 `call_id` + `callee_user_id` | UNIQUE で二重 enqueue 防止 |

---

## 6. クライアント設定（公開鍵のみ）

HTML またはビルド設定で **公開鍵だけ** 注入:

```javascript
window.TASU_TALK_CALL_CONFIG = {
  webPushVapidPublicKey: "<WEB_PUSH_VAPID_PUBLIC_KEY と同じ値>",
  pushIncomingEnabled: true,
  pushSubscribeEnabled: true,
};
```

`scripts/talk-push-subscribe.js` は `Notification.permission === 'granted'` のときのみ subscribe し、`talk_push_subscriptions` に `status: active` で upsert する。

---

## 7. 動作確認

### 7.1 自動テスト

```powershell
node scripts/test-talk-call-push-delivery.mjs
$env:SUPABASE_STRICT="1"
node scripts/test-talk-call-push-delivery.mjs
node scripts/test-talk-call-push-notification-design.mjs
node scripts/test-talk-call-service-worker.mjs
```

Phase1〜7 回帰:

```powershell
$env:SUPABASE_STRICT="1"
node scripts/test-talk-webrtc-call-browser.mjs
node scripts/test-talk-call-chat-detail.mjs
node scripts/test-talk-call-notification-center.mjs
node scripts/test-talk-call-history-ui.mjs
node scripts/test-talk-call-turn-config.mjs
node scripts/test-talk-call-relay-candidate.mjs
```

### 7.2 手動 E2E

1. callee 端末で Push 許可（granted）
2. `TasuTalkPushSubscribe.trySyncSubscription()` または talk-home 初期化で subscription 登録
3. caller が ringing セッション作成
4. `talk_call_push_events` に `pending` 行ができる
5. Edge invoke → `delivery_status: sent`
6. callee に通知「**音声通話の着信** / {名前} さんから通話があります」
7. タップ → `chat-detail.html?thread=...&callId=...&from=notify`

### 7.3 セキュリティ確認

- [ ] Edge ログに private key / auth_key なし
- [ ] Push payload に email / token / credential なし
- [ ] summary / レポートに VAPID 秘密鍵なし
- [ ] DB `payload` JSON に秘匿フィールドなし

---

## 8. ロールバック

### 8.1 送信停止（即時）

```bash
supabase secrets unset WEB_PUSH_VAPID_PRIVATE_KEY
```

または Edge Function を前バージョン（skip のみ）に redeploy。未設定 secret 時は全イベント `skipped`。

### 8.2 クライアント

```javascript
window.TASU_TALK_CALL_CONFIG.pushIncomingEnabled = false;
// または webPushVapidPublicKey を削除
```

foreground 着信（Phase3 notify bridge）は影響を受けない。

### 8.3 DB

migration の `status` / `retry_eligible` カラムは残してよい（後方互換）。緊急時のみ:

```sql
-- 任意: pending を一括キャンセル
update talk_call_push_events set delivery_status = 'cancelled', cancelled_at = now()
where delivery_status = 'pending';
```

---

## 9. トラブルシュート

| 症状 | 確認 |
|------|------|
| 常に `skipped` | secrets 3 件すべて設定済みか |
| `failed` + `no_subscription` | callee の `talk_push_subscriptions` に `active` 行があるか |
| `failed` + `invalid_subscription` | 410/404 → `inactive` 化。再 subscribe 必要 |
| Edge 404 | `supabase functions deploy` 済みか |
| 通知が来ないが `sent` | SW `/talk-service-worker.js` 登録、scope `/` |
| foreground のみ着信 | 想定内（Push は background 用）。Phase3 overlay は別経路 |

---

## 10. 判定

- **投入 GO:** secrets 設定 + Edge deploy + Phase7.1 テスト PASS + 実機 1 通知
- **投入 STOP:** payload / ログに credential 漏洩、または private key がクライアントに露出
