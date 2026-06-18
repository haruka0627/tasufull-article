# TASFUL TALK 通話 Phase7 — Push 実接続 基盤実装

**日付:** 2026-06-17  
**本番 VAPID / TURN credential 投入:** **未実施**  
**総合判定:** **PASS**

---

## 概要

Phase7 Preflight の指摘を反映し、Push 着信の**実接続基盤**（DB / RLS / Edge ガード / Service Worker / subscription helper）を実装。本番 VAPID 鍵は未投入のため、Edge は mock/skip 動作。

---

## 実装サマリー

| 領域 | 内容 |
|------|------|
| **DB** | `talk_call_push_events`, `talk_push_subscriptions` 適用済み |
| **RLS** | callee のみ SELECT、caller INSERT、participant UPDATE、subscription 本人のみ |
| **Edge** | ringing / expires_at ガード、pending のみ、skipped/failed 更新 |
| **SW** | [`talk-service-worker.js`](../talk-service-worker.js) — push + notificationclick |
| **Subscribe** | [`scripts/talk-push-subscribe.js`](../scripts/talk-push-subscribe.js) — granted + VAPID 時のみ |
| **呼び出し** | talk-home notify-bridge init / chat-detail init |

---

## DB / RLS

```bash
node scripts/apply-talk-call-push-supabase.mjs
```

- `UNIQUE(call_id, callee_user_id)` 維持
- 本番 SELECT: **callee + admin のみ**（caller 可読を廃止）
- `talk_push_subscriptions`: 本人のみ ALL

---

## Edge Function ガード

[`supabase/functions/talk-call-push-notify/index.ts`](../supabase/functions/talk-call-push-notify/index.ts)

| チェック | 動作 |
|----------|------|
| pending のみ | ✅ |
| session 存在 | ✅ なければ `failed` |
| status=ringing | ✅ それ以外 `skipped` |
| expires_at 超過 | ✅ `skipped` (session_expired) |
| VAPID 未設定 | ✅ `skipped`、pending 残さない |
| credential ログ | ✅ `safeLog` で除去 |

※ Edge Function のデプロイは別途 `supabase functions deploy talk-call-push-notify`。未デプロイ時はクライアント invoke が 404（DB integration は PASS）。

---

## Service Worker

- パス: `/talk-service-worker.js`、scope: `/`
- Builder SW（`/builder/`）と最長一致で**衝突なし**
- `notificationclick` → `chat-detail.html?thread=...&callId=...`

---

## subscription helper

- `Notification.permission === 'granted'` のみ subscribe
- `default` / `denied` → **requestPermission しない**
- VAPID public key 未設定 → skip
- `talk_push_subscriptions` に upsert

設定例（VAPID 投入時）:

```javascript
window.TASU_TALK_CALL_CONFIG = {
  vapidPublicKey: "<base64-url-public-key>",
};
```

---

## 検証結果

```powershell
$env:SUPABASE_STRICT="1"
node scripts/test-talk-call-push-notification-design.mjs   # PASS (DB integration)
node scripts/test-talk-call-service-worker.mjs             # PASS
node scripts/test-talk-webrtc-call-browser.mjs             # PASS
node scripts/test-talk-call-chat-detail.mjs                # PASS
node scripts/test-talk-call-notification-center.mjs        # PASS
node scripts/test-talk-call-history-ui.mjs                 # PASS
node scripts/test-talk-call-turn-config.mjs                # PASS
node scripts/test-talk-call-relay-candidate.mjs          # SKIP PASS
```

| 必須確認 | 結果 |
|----------|------|
| DB integration PASS（SKIP なし） | ✅ |
| ringing → callee push event | ✅ |
| caller / terminal / active enqueue 不可 | ✅ |
| Edge ringing ガード | ✅（unit + source） |
| VAPID 未設定 → skipped | ✅（Edge デプロイ後に E2E 再確認） |
| payload 秘匿なし | ✅ |
| SW → chat-detail + callId | ✅ |
| permission default/denied → subscribe しない | ✅ |
| Phase1〜6 回帰 | ✅ |

---

## Phase7.1 以降（VAPID 投入後）

1. VAPID 鍵生成 + Supabase secrets (`TALK_VAPID_PUBLIC_KEY`, `TALK_VAPID_PRIVATE_KEY`)
2. `supabase functions deploy talk-call-push-notify`
3. Edge に web-push 送信本体実装 → `delivery_status: sent`
4. DB Webhook: push_events INSERT → Edge 自動 invoke
5. 実機 Push 着信 E2E

---

## セキュリティ

- 本番 VAPID 未投入 ✅
- TURN credential 未投入 ✅
- payload / ログに token・credential なし ✅
- foreground 着信（Phase3）破壊なし ✅
