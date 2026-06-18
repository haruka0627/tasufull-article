# TASFUL TALK Push 本番接続結果

**実施日:** 2026-06-17  
**目的:** Phase7.1 Web Push 実送信をリンク DB / Supabase Edge / クライアント公開鍵で実接続  
**対象 DB:** linked Supabase `ddojquacsyqesrjhcvmn`  
**関連:** [`docs/talk-call-web-push-deploy.md`](../docs/talk-call-web-push-deploy.md) · [`talk-call-phase7-1-web-push-delivery.md`](talk-call-phase7-1-web-push-delivery.md)

---

## 1. 総合判定: **WARNING**

| 領域 | 結果 |
|------|------|
| DB migration Phase7.1 | ✅ 完了 |
| VAPID secrets | ✅ 3 件設定済み |
| Edge deploy | ✅ 404 解消 |
| クライアント公開鍵 | ✅ `chat-supabase-config.js` に注入 |
| 自動テスト / 回帰 | ✅ 全 PASS |
| セキュリティ静的確認 | ✅ PASS |
| **実機 Push E2E（PC Chrome / Android Chrome）** | ⚠️ **未確認**（本環境からブラウザ実機検証不可） |

**解釈:** 本番接続の **インフラ・コード・Edge 経路は接続完了**。実機で通知着信を目視確認するまで **限定公開可（WARNING）** とする。

---

## 2. 実行コマンド

```powershell
cd C:\Users\rubih\tasufull-article

# 1. DB
node scripts/apply-talk-call-push-supabase.mjs

# 2. VAPID secrets（新規生成 → Supabase secrets へ投入 · private key はログ非出力）
#    WEB_PUSH_VAPID_PUBLIC_KEY / WEB_PUSH_VAPID_PRIVATE_KEY / WEB_PUSH_VAPID_SUBJECT

# 3. Edge
npx supabase functions deploy talk-call-push-notify --no-verify-jwt

# 4. クライアント公開鍵 — chat-supabase-config.js（ローカル · gitignore 推奨）

# 5. 回帰
node scripts/test-talk-call-push-delivery.mjs
$env:SUPABASE_STRICT="1"; node scripts/test-talk-call-push-delivery.mjs
$env:SUPABASE_STRICT="1"; node scripts/test-talk-call-push-notification-design.mjs
node scripts/test-talk-call-service-worker.mjs
$env:SUPABASE_STRICT="1"; node scripts/test-talk-webrtc-call-browser.mjs
$env:SUPABASE_STRICT="1"; node scripts/test-talk-call-chat-detail.mjs
$env:SUPABASE_STRICT="1"; node scripts/test-talk-call-notification-center.mjs
$env:SUPABASE_STRICT="1"; node scripts/test-talk-call-history-ui.mjs
node scripts/test-talk-call-turn-config.mjs
node scripts/probe-talk-call-phase72-review.mjs
```

---

## 3. DB migration（Phase7.1）

| 確認項目 | 結果 |
|----------|------|
| `apply-talk-call-push-supabase.mjs` | ✅ exit 0（schema + phase71 + RLS prod） |
| `talk_call_push_events.retry_eligible` | ✅ カラム存在 |
| `talk_push_subscriptions.status` | ✅ カラム存在 |
| RLS | ✅ prod 維持（dev DROP 済み状態） |
| `probe-talk-call-phase72-review.mjs` DB | ✅ 両表 reachable |

---

## 4. VAPID secrets

| Secret | 状態 |
|--------|------|
| `WEB_PUSH_VAPID_PUBLIC_KEY` | ✅ 設定済み |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | ✅ 設定済み（**値は本レポート非掲載**） |
| `WEB_PUSH_VAPID_SUBJECT` | ✅ `mailto:support@tasuful.local` |

- private key は CLI ログ・チャット・レポートに **出力していない**
- 公開鍵長: **87 文字**（URL-safe base64）

---

## 5. Edge Function deploy

| 確認項目 | 結果 |
|----------|------|
| `talk-call-push-notify` deploy | ✅ 成功 |
| 404 解消 | ✅ probe `deployed: true`, status **200** |
| VAPID 未設定時 skipped | ✅ 単体テストで確認（`vapid_unconfigured`） |
| VAPID 設定時 delivery 更新 | ✅ 実 DB プローブ: `failed` / `no_subscription`（subscription なし · **skipped ではない**） |

**Edge プローブ（service role · 存在しない call_id）:**

- status 200 · `skipped: true` · reason 付き — 想定内

**Edge 実イベントプローブ（ringing session + pending event · mock なし）:**

| 項目 | 値 |
|------|-----|
| Edge `delivery_status` | `failed` |
| Edge `reason` | `no_subscription` |
| DB `delivery_status` | `failed` |
| DB `retry_eligible` | `true` |
| VAPID 経路 | ✅ `vapid_unconfigured` ではない |

→ VAPID 設定後は **skipped（未設定）ではなく failed（subscription 不足）** に遷移。本番 subscribe 後は `sent` 経路へ。

---

## 6. クライアント公開鍵注入

**ファイル:** `chat-supabase-config.js`（`talk-home.html` / `chat-detail.html` 等が参照）

```javascript
window.TASU_TALK_CALL_CONFIG = {
  webPushVapidPublicKey: "<WEB_PUSH_VAPID_PUBLIC_KEY と同一 · 87 文字>",
  pushIncomingEnabled: true,
  pushSubscribeEnabled: true,
};
```

- **private key はクライアントに未注入**（ソース静的確認 PASS）
- TURN credential は **未変更**

---

## 7. 実機 Push E2E

| 項目 | PC Chrome | Android Chrome |
|------|-----------|----------------|
| permission granted | ⚠️ 未確認 | ⚠️ 未確認 |
| `talk_push_subscriptions` active upsert | ⚠️ 未確認 | ⚠️ 未確認 |
| A 発信 → B Web Push 着信 | ⚠️ 未確認 | ⚠️ 未確認 |
| Push tap → `chat-detail?thread=...&callId=...` | ⚠️ 未確認 | ⚠️ 未確認 |
| Phase2 overlay 応答 | ⚠️ 未確認 | ⚠️ 未確認 |
| 拒否/終了で pending 残存なし | ⚠️ 未確認 | ⚠️ 未確認 |

**手動 E2E 手順（[`docs/talk-call-web-push-deploy.md` §7.2](../docs/talk-call-web-push-deploy.md)）:**

1. callee 端末で Push 許可 → `TasuTalkPushSubscribe.trySyncSubscription()`
2. caller が ringing セッション作成
3. Edge invoke または DB webhook → `delivery_status: sent`
4. 通知「**音声通話の着信** / {名前} さんから通話があります」
5. タップ → `chat-detail.html?thread=...&callId=...&from=notify`

---

## 8. 回帰テスト結果

| スクリプト | 結果 |
|------------|------|
| `test-talk-call-push-delivery.mjs` | ✅ ALL PASS |
| `test-talk-call-push-delivery.mjs`（`SUPABASE_STRICT=1`） | ✅ ALL PASS |
| `test-talk-call-push-notification-design.mjs`（`SUPABASE_STRICT=1`） | ✅ ALL PASS |
| `test-talk-call-service-worker.mjs` | ✅ ALL PASS |
| `test-talk-webrtc-call-browser.mjs`（`SUPABASE_STRICT=1`） | ✅ PASS |
| `test-talk-call-chat-detail.mjs`（`SUPABASE_STRICT=1`） | ✅ PASS |
| `test-talk-call-notification-center.mjs`（`SUPABASE_STRICT=1`） | ✅ PASS |
| `test-talk-call-history-ui.mjs`（`SUPABASE_STRICT=1`） | ✅ PASS |
| `test-talk-call-turn-config.mjs` | ✅ ALL PASS |
| `probe-talk-call-phase72-review.mjs` | ✅ DB + Edge + security OK |

---

## 9. セキュリティ確認

| 項目 | 結果 |
|------|------|
| payload に email / phone / token / credential / payment / internal role なし | ✅ 単体 + ソース guard |
| Edge logs に private key なし | ✅ `safeLog` · `edge_no_console_log_body` |
| DB に private key 保存なし | ✅ スキーマに VAPID private カラムなし |
| クライアントソースに `WEB_PUSH_VAPID_PRIVATE` なし | ✅ probe PASS |
| レポートに private key 記載なし | ✅ |

---

## 10. スコープ外（未変更）

- TURN credential / ICE 設定
- ビデオ通話
- RLS SQL
- UI 変更

---

## 11. 次にやるべきこと

1. **実機 E2E** — PC Chrome + Android Chrome で上表 7 項目を手動確認
2. **本番ホスト** — デプロイ環境の `chat-supabase-config.js` に同一公開鍵を反映（ローカルのみ更新済みの場合）
3. **DB Webhook / Cron** — `talk_call_push_events` pending → Edge invoke の本番トリガー配線（現状は service role 手動 invoke で検証）
4. **実機 `sent` 確認** — subscribe 後に `delivery_status: sent` と通知表示を確認
5. JWT 期限切れ時 — 安否 verify とは別 · Push は VAPID 鍵ローテ時のみ secrets 再設定

---

**Verdict:** TALK Push **本番接続（DB · VAPID · Edge · 公開鍵 · 自動検証）は完了**。実機着信未確認のため総合 **WARNING** — 実機 1 通知確認後 **PASS** に昇格可能。
