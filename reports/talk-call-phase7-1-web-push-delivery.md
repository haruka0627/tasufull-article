# TASFUL TALK 通話 Phase7.1 — Web Push 実送信（VAPID）

**日付:** 2026-06-17  
**本番 VAPID 投入:** **未実施**（secrets 管理のみ設計・実装）  
**総合判定:** **PASS**（単体 + DB integration + Phase1〜7 回帰）

---

## 概要

Phase7 の Push 基盤に **web-push 実送信**を追加。VAPID は Supabase secrets のみ。credential をコード・ログ・DB・summary に平文で残さない。

---

## 実装サマリー

| 領域 | 内容 |
|------|------|
| **Edge** | [`supabase/functions/talk-call-push-notify/index.ts`](../supabase/functions/talk-call-push-notify/index.ts) — `web-push@3.6.7`, pending→ringing→send→sent/failed/skipped |
| **Shared** | [`supabase/functions/_shared/talk-call-push-delivery.ts`](../supabase/functions/_shared/talk-call-push-delivery.ts) — VAPID / payload sanitize / guard |
| **Node mirror** | [`scripts/lib/talk-call-push-delivery.mjs`](../scripts/lib/talk-call-push-delivery.mjs) — テスト用 orchestration |
| **Migration** | [`sql/talk-call-push-phase71-migration.sql`](../sql/talk-call-push-phase71-migration.sql) — `status`, `retry_eligible` |
| **SW** | [`talk-service-worker.js`](../talk-service-worker.js) — 本番文言・notificationclick → `target_url` |
| **Subscribe** | [`scripts/talk-push-subscribe.js`](../scripts/talk-push-subscribe.js) — `WEB_PUSH_VAPID_PUBLIC_KEY` / `status: active` |
| **Enqueue invoke** | [`scripts/talk-call-push-events.js`](../scripts/talk-call-push-events.js) — 本番は mock なし invoke |
| **Deploy doc** | [`docs/talk-call-web-push-deploy.md`](../docs/talk-call-web-push-deploy.md) |

---

## 要件対応

| # | 要件 | 状態 |
|---|------|------|
| 1 | VAPID secrets 未設定 → skipped | ✅ |
| 1 | credential ログ/summary/DB 非保存 | ✅ `safeLog` / sanitize |
| 2 | pending → subscription → ringing → send → sent | ✅ |
| 2 | 410/404 → failed + inactive | ✅ |
| 3 | sent/skipped 再送なし、failed のみ retry_eligible | ✅ |
| 4 | payload 許可フィールドのみ | ✅ |
| 5 | SW 本番文言 + notificationclick | ✅ |
| 6 | subscription cleanup inactive | ✅ |
| 7 | `test-talk-call-push-delivery.mjs` | ✅ |
| 8 | deploy ドキュメント | ✅ |

---

## Secrets（コードに直書きしない）

| 名前 | 用途 |
|------|------|
| `WEB_PUSH_VAPID_PUBLIC_KEY` | Edge + クライアント subscribe |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | Edge のみ |
| `WEB_PUSH_VAPID_SUBJECT` | VAPID subject |

---

## Push payload（送信のみ）

```json
{
  "type": "talk_call_incoming",
  "call_id": "...",
  "room_id": "...",
  "caller_display_name": "...",
  "target_url": "/chat-detail.html?thread=...&callId=...&from=notify"
}
```

禁止: email, phone, token, credential, payment, internal role

---

## Service Worker 表示

- **タイトル:** 音声通話の着信
- **本文:** {caller_display_name} さんから通話があります
- **タップ:** `target_url`（chat-detail deep link）

---

## 検証結果

```powershell
node scripts/test-talk-call-push-delivery.mjs
$env:SUPABASE_STRICT="1"
node scripts/test-talk-call-push-delivery.mjs
node scripts/test-talk-call-push-notification-design.mjs
node scripts/test-talk-call-service-worker.mjs
$env:SUPABASE_STRICT="1"
node scripts/test-talk-webrtc-call-browser.mjs
node scripts/test-talk-call-chat-detail.mjs
node scripts/test-talk-call-notification-center.mjs
node scripts/test-talk-call-history-ui.mjs
node scripts/test-talk-call-turn-config.mjs
node scripts/test-talk-call-relay-candidate.mjs
```

| 確認 | 結果 |
|------|------|
| VAPID 未設定 → skipped | ✅ |
| sendNotification 呼出（unit mock） | ✅ |
| sent / failed / inactive 更新ロジック | ✅ |
| payload 秘匿なし | ✅ |
| SW notificationclick | ✅ |
| Phase1〜7 回帰 | ✅ |
| TURN credential 未変更 | ✅ |
| foreground 着信破壊なし | ✅ |

---

## 本番投入（未実施）

1. `npx web-push generate-vapid-keys`
2. `supabase secrets set WEB_PUSH_VAPID_*`
3. `node scripts/apply-talk-call-push-supabase.mjs`（Phase7.1 migration）
4. `supabase functions deploy talk-call-push-notify`
5. クライアントに **公開鍵のみ** 設定
6. 実機 Push E2E

詳細: [`docs/talk-call-web-push-deploy.md`](../docs/talk-call-web-push-deploy.md)

---

## セキュリティ

- VAPID 秘密鍵: リポジトリ・レポート・DB なし ✅
- TURN credential: 未触 ✅
- ビデオ通話: 未実装 ✅
